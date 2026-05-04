import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";

export type OnboardingGateStatus =
  | "loading"
  | "anon"
  | "needs_onboarding"
  | "ok";

/**
 * Single source of truth for “should the user see the app shell or onboarding?”.
 * - Missing profile or `has_completed_onboarding` → onboarding.
 * - Flag set but no completed persisted analysis (API returns null / non-completed)
 *   → onboarding (admin drift, deleted jobs, failed pipeline).
 * - While determining: `loading`.
 */
export function useOnboardingGate(): { status: OnboardingGateStatus } {
  const { user, profile, isLoading: authLoading } = useAuth();
  const onboardingFlag = profile?.has_completed_onboarding ?? false;

  const latestEnabled = Boolean(user?.id && onboardingFlag);
  const latestQuery = useLatestFaceAnalysis({
    enabled: latestEnabled,
  });

  if (authLoading) {
    return { status: "loading" };
  }

  if (!user) {
    return { status: "anon" };
  }

  if (!profile || !onboardingFlag) {
    return { status: "needs_onboarding" };
  }

  if (latestQuery.isLoading) {
    return { status: "loading" };
  }

  if (latestQuery.isError) {
    return { status: "ok" };
  }

  const latest = latestQuery.data;
  if (!latest || latest.job.status !== "completed") {
    return { status: "needs_onboarding" };
  }

  return { status: "ok" };
}
