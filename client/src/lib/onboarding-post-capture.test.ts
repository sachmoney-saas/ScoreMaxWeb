import { describe, expect, it } from "vitest";
import { shouldSkipOnboardingGeometryPrelude } from "./onboarding-post-capture";

describe("shouldSkipOnboardingGeometryPrelude", () => {
  it("returns false when image is missing", () => {
    expect(shouldSkipOnboardingGeometryPrelude(undefined)).toBe(false);
    expect(shouldSkipOnboardingGeometryPrelude(null)).toBe(false);
  });

  it("returns false for pending", () => {
    expect(
      shouldSkipOnboardingGeometryPrelude({
        status: "pending",
        signed_url: null,
      }),
    ).toBe(false);
  });

  it("returns false for completed without URL", () => {
    expect(
      shouldSkipOnboardingGeometryPrelude({
        status: "completed",
        signed_url: null,
      }),
    ).toBe(false);
  });

  it("returns true for completed with URL (reconnect / cache)", () => {
    expect(
      shouldSkipOnboardingGeometryPrelude({
        status: "completed",
        signed_url: "https://example.com/a.png",
      }),
    ).toBe(true);
  });

  it("returns true for failed (terminal, no generation to wait)", () => {
    expect(
      shouldSkipOnboardingGeometryPrelude({
        status: "failed",
        signed_url: null,
      }),
    ).toBe(true);
  });
});
