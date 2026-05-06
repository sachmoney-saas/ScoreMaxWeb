import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";
import { getPremiumAccessState } from "./subscriptions";

/** Fenêtre glissante entre deux analyses « standard » pour les abonnés (hors admin). */
export const SUBSCRIBER_STANDARD_ANALYSIS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type SubscriberStandardQuotaWire = {
  weekly_limit_applies: boolean;
  can_launch_standard_now: boolean;
  next_available_at: string | null;
  has_standard_in_flight: boolean;
};

/**
 * Quota hebdo : uniquement pour les comptes avec abonnement actif (`is_subscriber`).
 * Les admins ne sont pas plafonnés. Les analyses `freemium` (onboarding) ne comptent pas.
 */
export async function getSubscriberStandardAnalysisQuota(
  userId: string,
): Promise<SubscriberStandardQuotaWire> {
  const access = await getPremiumAccessState(userId);

  if (!access.is_subscriber || access.is_admin) {
    return {
      weekly_limit_applies: false,
      can_launch_standard_now: true,
      next_available_at: null,
      has_standard_in_flight: false,
    };
  }

  const { data: inflightRows, error: inflightError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("tier", "standard")
    .in("status", ["queued", "running"])
    .limit(1);

  if (inflightError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to check in-flight standard analyses",
      details: inflightError,
    });
  }

  const hasStandardInFlight = (inflightRows?.length ?? 0) > 0;

  const { data: lastCompleted, error: lastError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("tier", "standard")
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load last completed standard analysis",
      details: lastError,
    });
  }

  const completedMs = lastCompleted?.completed_at
    ? new Date(lastCompleted.completed_at as string).getTime()
    : null;
  const cooldownEndsAt =
    completedMs !== null && Number.isFinite(completedMs)
      ? completedMs + SUBSCRIBER_STANDARD_ANALYSIS_COOLDOWN_MS
      : null;

  const now = Date.now();

  let nextAvailableAt: string | null = null;
  let canLaunch = true;

  if (hasStandardInFlight) {
    canLaunch = false;
  } else if (cooldownEndsAt !== null && now < cooldownEndsAt) {
    canLaunch = false;
    nextAvailableAt = new Date(cooldownEndsAt).toISOString();
  }

  return {
    weekly_limit_applies: true,
    can_launch_standard_now: canLaunch,
    next_available_at: nextAvailableAt,
    has_standard_in_flight: hasStandardInFlight,
  };
}

export async function assertSubscriberStandardAnalysisAllowed(userId: string): Promise<void> {
  const quota = await getSubscriberStandardAnalysisQuota(userId);
  if (!quota.weekly_limit_applies || quota.can_launch_standard_now) {
    return;
  }

  throw new ApiError({
    code: "ANALYSIS_WEEKLY_LIMIT",
    status: 429,
    message: quota.has_standard_in_flight
      ? "A standard analysis is already queued or running."
      : "Weekly standard analysis limit reached. Try again after the cooldown.",
    details: {
      next_available_at: quota.next_available_at,
      has_standard_in_flight: quota.has_standard_in_flight,
    },
  });
}
