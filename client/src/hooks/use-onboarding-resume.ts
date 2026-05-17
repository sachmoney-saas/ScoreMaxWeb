import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import { completeOnboardingApi } from "@/lib/onboarding-complete-flow";
import {
  deriveOnboardingCapturePhase,
  hasPartialOnboardingUpload,
  type OnboardingCapturePhase,
} from "@/lib/onboarding-resume";
import { writeOnboardingFlowState } from "@/lib/onboarding-flow-storage";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { OnboardingScanStatus } from "@shared/schema";

export function useOnboardingResume(options: {
  captureStepActive: boolean;
  language: AppLanguage;
}) {
  const { user, profile } = useAuth();
  const hasCompletedOnboarding = profile?.has_completed_onboarding === true;

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({
    enabled: options.captureStepActive && !!user?.id,
  });

  const [isFinalizing, setIsFinalizing] = React.useState(false);

  const phase: OnboardingCapturePhase = deriveOnboardingCapturePhase({
    hasCompletedOnboarding,
    scanStatus,
    isScanStatusLoading,
    isScanStatusError,
  });

  const hasPartialUpload = hasPartialOnboardingUpload(scanStatus);

  const finalizeFromServer = React.useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    if (hasCompletedOnboarding) {
      writeOnboardingFlowState({ userId: user.id, step: 2, v: 2 });
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-potential-image", user.id],
      });
      return true;
    }

    if (!scanStatus?.is_ready || !scanStatus.session_id) {
      return false;
    }

    setIsFinalizing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(
          i18n(options.language, {
            en: "Supabase session not found",
            fr: "Session Supabase introuvable",
          }),
        );
      }

      await completeOnboardingApi({
        accessToken,
        language: options.language,
      });

      writeOnboardingFlowState({ userId: user.id, step: 2, v: 2 });
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-potential-image", user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-scan-status", user.id],
      });
      return true;
    } catch (error) {
      console.error("Unable to finalize onboarding from server:", error);
      throw error;
    } finally {
      setIsFinalizing(false);
    }
  }, [
    hasCompletedOnboarding,
    options.language,
    scanStatus?.is_ready,
    scanStatus?.session_id,
    user?.id,
  ]);

  return {
    phase,
    scanStatus: scanStatus as OnboardingScanStatus | undefined,
    isScanStatusLoading,
    isScanStatusError,
    isFinalizing,
    hasPartialUpload,
    finalizeFromServer,
    hasCompletedOnboarding,
  };
}
