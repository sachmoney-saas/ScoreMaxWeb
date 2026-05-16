import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import {
  resolveUserAccess,
  type UserAccessSnapshot,
} from "@/lib/user-access";

/**
 * Point d'entrée unique pour le routing et les garde-fous UI (premium / lapsed / funnel).
 */
export function useUserAccess(): UserAccessSnapshot {
  const { user, profile, hasPremiumAccess, isAdmin, isLoading: authLoading } =
    useAuth();
  const { status: onboardingGateStatus } = useOnboardingGate();

  const gateLoading =
    authLoading || (Boolean(user) && onboardingGateStatus === "loading");

  return useMemo(
    () =>
      resolveUserAccess({
        isLoading: gateLoading,
        userId: user?.id,
        hasCompletedOnboarding: profile?.has_completed_onboarding === true,
        hasEverSubscribed: profile?.has_ever_subscribed === true,
        hasPremiumAccess,
        isAdmin,
      }),
    [
      gateLoading,
      user?.id,
      profile?.has_completed_onboarding,
      profile?.has_ever_subscribed,
      hasPremiumAccess,
      isAdmin,
    ],
  );
}
