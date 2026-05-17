import type { OnboardingScanStatus } from "@shared/schema";

/** Phase dérivée côté client (étape 0 capture) — pas une nouvelle source de vérité serveur. */
export type OnboardingCapturePhase =
  | "loading"
  | "needs_capture"
  | "ready_to_finalize"
  /** Scan déjà finalisé côté profil : ne plus proposer la capture « froide ». */
  | "post_onboarding";

/** Session prête pour finalisation (API / teaser), y compris si `is_ready` RPC traîne. */
export function isOnboardingScanSessionComplete(
  scanStatus: OnboardingScanStatus | undefined,
): boolean {
  if (!scanStatus) return false;
  if (scanStatus.is_ready) return true;
  const req = scanStatus.required_asset_count;
  return req > 0 && scanStatus.completed_asset_count >= req;
}

export function canSkipCapture(
  scanStatus: OnboardingScanStatus | undefined,
): boolean {
  return isOnboardingScanSessionComplete(scanStatus);
}

export function hasPartialOnboardingUpload(
  scanStatus: OnboardingScanStatus | undefined,
): boolean {
  if (!scanStatus) return false;
  return (
    scanStatus.completed_asset_count > 0 &&
    !isOnboardingScanSessionComplete(scanStatus)
  );
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
    return "post_onboarding";
  }

  if (isScanStatusLoading || (!scanStatus && !isScanStatusError)) {
    return "loading";
  }

  if (isOnboardingScanSessionComplete(scanStatus)) {
    return "ready_to_finalize";
  }

  return "needs_capture";
}
