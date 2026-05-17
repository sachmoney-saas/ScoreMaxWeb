import { describe, expect, it } from "vitest";
import type { OnboardingScanStatus } from "@shared/schema";
import { resolveOnboardingCaptureInitialStep } from "./onboarding-flow-storage";

const ready: OnboardingScanStatus = {
  session_id: "s1",
  required_asset_count: 7,
  completed_asset_count: 7,
  is_ready: true,
  missing_asset_types: [],
};

describe("resolveOnboardingCaptureInitialStep", () => {
  it("returns wait while scan is loading", () => {
    expect(
      resolveOnboardingCaptureInitialStep({
        persistedStep: 0,
        hasCompletedOnboarding: false,
        scanStatus: undefined,
        isScanLoading: true,
        isScanError: false,
      }),
    ).toBe("wait");
  });

  it("returns 2 when onboarding already completed on profile", () => {
    expect(
      resolveOnboardingCaptureInitialStep({
        persistedStep: 0,
        hasCompletedOnboarding: true,
        scanStatus: undefined,
        isScanLoading: false,
        isScanError: false,
      }),
    ).toBe(2);
  });

  it("returns 2 when RPC reports full scan (even if sessionStorage was cleared)", () => {
    expect(
      resolveOnboardingCaptureInitialStep({
        persistedStep: null,
        hasCompletedOnboarding: false,
        scanStatus: { ...ready, is_ready: false },
        isScanLoading: false,
        isScanError: false,
      }),
    ).toBe(2);
  });

  it("returns 1 when partial uploads exist", () => {
    expect(
      resolveOnboardingCaptureInitialStep({
        persistedStep: 0,
        hasCompletedOnboarding: false,
        scanStatus: {
          session_id: "s1",
          required_asset_count: 7,
          completed_asset_count: 2,
          is_ready: false,
          missing_asset_types: [],
        },
        isScanLoading: false,
        isScanError: false,
      }),
    ).toBe(1);
  });
});
