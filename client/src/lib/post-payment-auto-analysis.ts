/**
 * Déclenchement automatique de l’analyse complète juste après un paiement.
 *
 * Flux :
 *  1. Attendre que le webhook Dodo bascule l’abonnement (`is_subscriber`) côté serveur.
 *  2. Vérifier qu’aucune analyse `standard` n’est déjà `queued`/`running` (idempotence).
 *  3. Récupérer l’`onboarding session_id` (mêmes images que le scan d’onboarding).
 *  4. Lancer `POST /v1/analyses` en tier `standard`.
 *  5. Persister un marqueur sessionStorage pour éviter tout re-lancement sur reload.
 */

import { supabase } from "@/lib/supabase";
import { fetchBillingState } from "@/lib/billing-api";
import {
  fetchAnalysisHistory,
  runFaceAnalysis,
  type AnalysisHistoryItem,
} from "@/lib/face-analysis";
import type { AppLanguage } from "@/lib/i18n";
import { reportClientError } from "@/lib/report-client-error";

const GUARD_STORAGE_KEY = "sm_post_payment_auto_analysis_v1";
const POLL_INTERVAL_MS = 1500;
const PREMIUM_POLL_MAX_MS = 45_000;

export type PostPaymentLaunchOutcome =
  | { status: "launched"; jobId: string }
  | { status: "already_running"; jobId: string }
  | { status: "skipped_no_session"; reason: "missing_session" | "missing_assets" }
  | { status: "skipped_already_kicked"; jobId: string | null }
  | { status: "premium_not_ready" }
  | { status: "error"; message: string };

type GuardRecord = {
  jobId: string | null;
  ts: number;
};

function readGuard(userId: string): GuardRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${GUARD_STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuardRecord>;
    if (typeof parsed?.ts !== "number") return null;
    return {
      jobId: typeof parsed.jobId === "string" ? parsed.jobId : null,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

function writeGuard(userId: string, record: GuardRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${GUARD_STORAGE_KEY}:${userId}`,
      JSON.stringify(record),
    );
  } catch {
    /* sessionStorage indisponible ou plein — pas critique */
  }
}

export function clearPostPaymentAutoAnalysisGuard(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${GUARD_STORAGE_KEY}:${userId}`);
  } catch {
    /* ignore */
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

async function waitForPremiumAccess(maxWaitMs: number): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const state = await fetchBillingState();
      if (state.is_subscriber) return true;
    } catch {
      /* on retente tant que la deadline n’est pas atteinte */
    }
    if (Date.now() + POLL_INTERVAL_MS >= deadline) break;
    await delay(POLL_INTERVAL_MS);
  }
  return false;
}

function findInflightStandardJob(
  history: AnalysisHistoryItem[],
): AnalysisHistoryItem | null {
  return (
    history.find(
      (item) => item.status === "queued" || item.status === "running",
    ) ?? null
  );
}

async function fetchOnboardingSessionId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_onboarding_scan_status");
  if (error || !data || data.length === 0) return null;
  const [row] = data as Array<{ session_id: string | null }>;
  return row?.session_id ?? null;
}

/**
 * Lance — si nécessaire — une analyse complète juste après un paiement réussi.
 * Idempotent par `userId` via sessionStorage.
 */
export async function kickPostPaymentAnalysis(params: {
  userId: string;
  language: AppLanguage;
}): Promise<PostPaymentLaunchOutcome> {
  const { userId, language } = params;

  const guard = readGuard(userId);
  if (guard) {
    return { status: "skipped_already_kicked", jobId: guard.jobId };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "error", message: "Supabase session not found" };
  }

  const isPremium = await waitForPremiumAccess(PREMIUM_POLL_MAX_MS);
  if (!isPremium) {
    return { status: "premium_not_ready" };
  }

  let history: AnalysisHistoryItem[] = [];
  try {
    history = await fetchAnalysisHistory(userId, {
      Authorization: `Bearer ${accessToken}`,
    });
  } catch (error) {
    reportClientError({
      source: "post_payment_auto_analysis.history_fetch_failed",
      message: error instanceof Error ? error.message : String(error),
      payload: { userId },
    });
  }

  const inflight = findInflightStandardJob(history);
  if (inflight) {
    writeGuard(userId, { jobId: inflight.id, ts: Date.now() });
    return { status: "already_running", jobId: inflight.id };
  }

  const sessionId = await fetchOnboardingSessionId();
  if (!sessionId) {
    return { status: "skipped_no_session", reason: "missing_session" };
  }

  writeGuard(userId, { jobId: null, ts: Date.now() });

  try {
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const result = await runFaceAnalysis({
      requestId,
      sessionId,
      userId,
      accessToken,
      tier: "standard",
      lang: language,
    });

    writeGuard(userId, { jobId: result.job.id, ts: Date.now() });
    return { status: "launched", jobId: result.job.id };
  } catch (error) {
    clearPostPaymentAutoAnalysisGuard(userId);
    const message = error instanceof Error ? error.message : String(error);
    reportClientError({
      source: "post_payment_auto_analysis.launch_failed",
      message,
      payload: { userId },
    });
    if (/missing required image|noScanAssets/i.test(message)) {
      return { status: "skipped_no_session", reason: "missing_assets" };
    }
    return { status: "error", message };
  }
}
