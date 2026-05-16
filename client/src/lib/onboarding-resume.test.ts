import { describe, expect, it } from "vitest";
import type { OnboardingScanStatus } from "@shared/schema";
import {
  canSkipCapture,
  deriveOnboardingCapturePhase,
  hasPartialOnboardingUpload,
} from "./onboarding-resume";

const readyStatus: OnboardingScanStatus = {
  session_id: "sess-1",
  required_asset_count: 7,
  completed_asset_count: 7,
  is_ready: true,
  missing_asset_types: [],
};

const partialStatus: OnboardingScanStatus = {
  session_id: "sess-1",
  required_asset_count: 7,
  completed_asset_count: 5,
  is_ready: false,
  missing_asset_types: ["Repère frontal : ovale"],
};

describe("onboarding-resume", () => {
  it("canSkipCapture when is_ready", () => {
    expect(canSkipCapture(readyStatus)).toBe(true);
    expect(canSkipCapture(partialStatus)).toBe(false);
    expect(canSkipCapture(undefined)).toBe(false);
  });

  it("hasPartialOnboardingUpload when some assets but not ready", () => {
    expect(hasPartialOnboardingUpload(partialStatus)).toBe(true);
    expect(hasPartialOnboardingUpload(readyStatus)).toBe(false);
    expect(
      hasPartialOnboardingUpload({
        ...partialStatus,
        completed_asset_count: 0,
      }),
    ).toBe(false);
  });

  it("deriveOnboardingCapturePhase returns loading while fetching", () => {
    expect(
      deriveOnboardingCapturePhase({
        hasCompletedOnboarding: false,
        scanStatus: undefined,
        isScanStatusLoading: true,
        isScanStatusError: false,
      }),
    ).toBe("loading");
  });

  it("deriveOnboardingCapturePhase returns ready_to_finalize when is_ready", () => {
    expect(
      deriveOnboardingCapturePhase({
        hasCompletedOnboarding: false,
        scanStatus: readyStatus,
        isScanStatusLoading: false,
        isScanStatusError: false,
      }),
    ).toBe("ready_to_finalize");
  });

  it("deriveOnboardingCapturePhase returns needs_capture when incomplete", () => {
    expect(
      deriveOnboardingCapturePhase({
        hasCompletedOnboarding: false,
        scanStatus: partialStatus,
        isScanStatusLoading: false,
        isScanStatusError: false,
      }),
    ).toBe("needs_capture");
  });
});
