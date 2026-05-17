import { clearOnboardingMeshReplay } from "./onboarding-mesh-replay-storage";
import type { OnboardingScanStatus } from "@shared/schema";
import {
  hasPartialOnboardingUpload,
  isOnboardingScanSessionComplete,
} from "./onboarding-resume";

const STORAGE_KEY = "sm_onb_flow";

export type OnboardingFlowStorage = {
  userId: string;
  /** 0–1 = avant scan, 2 = teaser potentiel, 3 = legacy paywall plein écran (normalisé → 2 + modale). */
  step: number;
  /** 2 = schéma 4 étapes ; absent = ancien schéma 3 étapes (migration à la lecture). */
  v?: number;
};

function scrubMalformedOrForeignState(
  raw: string,
  forUserId: string,
): OnboardingFlowStorage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("step" in parsed) ||
    typeof (parsed as { step: unknown }).step !== "number"
  ) {
    return null;
  }

  const rec = parsed as { userId?: unknown; step: number; v?: unknown };

  /** Ancien format sans `userId` : ne pas le réutiliser (risque de fuite entre comptes). */
  if (typeof rec.userId !== "string" || rec.userId.length === 0) {
    return null;
  }

  if (rec.userId !== forUserId) {
    return null;
  }

  let step = rec.step;
  const v = rec.v === 2 ? 2 : undefined;
  /** Migration 3→4 étapes : ancien 1 (teaser)→2, ancien 2 (paywall)→3. */
  if (v !== 2) {
    if (step >= 2) step += 1;
    else if (step === 1) step = 2;
  }

  return { userId: rec.userId, step, v: 2 };
}

/** Lit l’étape persistée pour cet utilisateur uniquement (sessionStorage par onglet). */
export function readOnboardingFlowState(
  forUserId: string | null | undefined,
): OnboardingFlowStorage | null {
  if (typeof window === "undefined" || !forUserId) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const valid = scrubMalformedOrForeignState(raw, forUserId);
    if (valid) {
      return valid;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function writeOnboardingFlowState(state: OnboardingFlowStorage): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearOnboardingFlowState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  clearOnboardingMeshReplay();
}

/** @param forUserId utilisateur courant (sinon false). */
export function isOnboardingPotentialTeaserActive(
  forUserId: string | null | undefined,
): boolean {
  const s = readOnboardingFlowState(forUserId);
  return s !== null && s.step >= 2;
}

/** @param forUserId utilisateur courant (sinon false). */
export function isOnboardingBillingStepActive(
  forUserId: string | null | undefined,
): boolean {
  const s = readOnboardingFlowState(forUserId);
  return s !== null && s.step >= 3;
}

/** Étape d’entrée pour un utilisateur encore en capture (profil non finalisé). */
export function resolveOnboardingCaptureInitialStep(options: {
  persistedStep: number | null;
  hasCompletedOnboarding: boolean;
  scanStatus: OnboardingScanStatus | undefined;
  isScanLoading: boolean;
  isScanError: boolean;
}): number | "wait" {
  if (options.hasCompletedOnboarding) {
    if ((options.persistedStep ?? 0) >= 3) return 3;
    return 2;
  }

  if (
    options.isScanLoading ||
    (!options.scanStatus && !options.isScanError)
  ) {
    return "wait";
  }

  if (
    options.scanStatus &&
    isOnboardingScanSessionComplete(options.scanStatus)
  ) {
    if ((options.persistedStep ?? 0) >= 3) return 3;
    return 2;
  }

  if (hasPartialOnboardingUpload(options.scanStatus)) {
    return 1;
  }

  return Math.min(1, Math.max(0, options.persistedStep ?? 0));
}

/** Étape initiale pour un utilisateur déjà onboardé sans abonnement. */
export function resolveOnboardingInitialStepForReturningUser(options: {
  persistedStep: number | null;
  hasPotentialImage: boolean;
}): number {
  const persisted = options.persistedStep ?? 0;
  if (persisted >= 3) return 3;
  if (persisted >= 2) return 2;
  if (persisted >= 1) return 1;
  if (options.hasPotentialImage) return 2;
  /** Teaser / chargement image : évite d’atterrir sur le paywall sans passage par l’aperçu. */
  return 2;
}
