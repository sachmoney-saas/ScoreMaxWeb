import { describe, expect, it } from "vitest";
import {
  pickPreferredPotentialGeneration,
  shouldStartNewPotentialImageGeneration,
} from "./onboarding-potential-image-policy";

describe("shouldStartNewPotentialImageGeneration", () => {
  it("starts when no prior generation exists", () => {
    expect(shouldStartNewPotentialImageGeneration(null)).toBe(true);
  });

  it("does not start when a completed image is stored", () => {
    expect(
      shouldStartNewPotentialImageGeneration({
        status: "completed",
        hasOneshotJob: true,
        hasStoredResult: true,
      }),
    ).toBe(false);
  });

  it("does not start when a job is already pending", () => {
    expect(
      shouldStartNewPotentialImageGeneration({
        status: "pending",
        hasOneshotJob: true,
        hasStoredResult: false,
      }),
    ).toBe(false);
  });

  it("allows retry after failure", () => {
    expect(
      shouldStartNewPotentialImageGeneration({
        status: "failed",
        hasOneshotJob: true,
        hasStoredResult: false,
      }),
    ).toBe(true);
  });
});

describe("pickPreferredPotentialGeneration", () => {
  it("prefers completed over newer failed rows", () => {
    const picked = pickPreferredPotentialGeneration([
      { status: "failed", createdAtMs: 300 },
      { status: "completed", createdAtMs: 100 },
    ]);
    expect(picked?.status).toBe("completed");
  });
});
