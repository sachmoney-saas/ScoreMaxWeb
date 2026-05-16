import type { OnboardingScanStatus } from "@shared/schema";

/** Phase dérivée côté client (étape 0 capture) — pas une nouvelle source de vérité serveur. */
export type OnboardingCapturePhase =
  | "loading"
  | "needs_capture"
  | "ready_to_finalize";

export function canSkipCapture(
  scanStatus: OnboardingScanStatus | undefined,
): boolean {
  return scanStatus?.is_ready === true;
}

export function hasPartialOnboardingUpload(
  scanStatus: OnboardingScanStatus | undefined,
): boolean {
  if (!scanStatus) return false;
  return scanStatus.completed_asset_count > 0 && !scanStatus.is_ready;
}

export function deriveOnboardingCapturePhase(params: {
  hasCompletedOnboarding: boolean;
  scanStatus: OnboardingScanStatus | undefined;
  isScanStatusLoading: boolean;
  isScanStatusError: boolean;
}): OnboardingCapturePhase {
  const {
    hasCompletedOnboarding,
    scanStatus,
    isScanStatusLoading,
    isScanStatusError,
  } = params;

  if (hasCompletedOnboarding) {
    return "needs_capture";
  }

  if (isScanStatusLoading || (!scanStatus && !isScanStatusError)) {
    return "loading";
  }

  if (scanStatus?.is_ready) {
    return "ready_to_finalize";
  }

  return "needs_capture";
}
