import { describe, expect, it } from "vitest";
import {
  mergePartialSampling,
  normalizeMeritWeights,
  resolveHoldBestFrameTuning,
} from "./holdBestFrameTuning";

describe("holdBestFrameTuning", () => {
  it("normalizeMeritWeights produit une somme ~1", () => {
    const w = normalizeMeritWeights({
      validationScore: 1,
      geometry: 2,
      detectorConfidence: 3,
      readinessBonus: 4,
    });
    expect(
      w.validationScore + w.geometry + w.detectorConfidence + w.readinessBonus,
    ).toBeCloseTo(1);
  });

  it("balanced 60 FPS (sans adaptation device) : gap ≥ borne base et max clichés défini", () => {
    const r = resolveHoldBestFrameTuning({
      mediaPipeTargetFps: 60,
      options: { preset: "balanced", deviceAdaptation: false },
    });
    expect(r.sampling.minGapMs).toBeGreaterThanOrEqual(108);
    expect(r.preset).toBe("balanced");
    expect(r.sampling.maxSnapshotsPerHold).toBe(15);
  });

  it("performance allonge l’intervalle et l’epsilon par rapport à accuracy", () => {
    const accuracy = resolveHoldBestFrameTuning({
      mediaPipeTargetFps: 60,
      options: { preset: "accuracy", deviceAdaptation: false },
    });
    const performance = resolveHoldBestFrameTuning({
      mediaPipeTargetFps: 60,
      options: { preset: "performance", deviceAdaptation: false },
    });
    expect(performance.sampling.minGapMs).toBeGreaterThan(accuracy.sampling.minGapMs);
    expect(performance.sampling.meritEpsilon).toBeGreaterThan(accuracy.sampling.meritEpsilon);
    expect(performance.meritWeights.geometry).toBeLessThan(accuracy.meritWeights.geometry);
  });

  it("FPS bas augmente au minimum gap×intervalle détecteur", () => {
    const thirty = resolveHoldBestFrameTuning({
      mediaPipeTargetFps: 30,
      options: { deviceAdaptation: false },
    });
    const sixty = resolveHoldBestFrameTuning({
      mediaPipeTargetFps: 60,
      options: { deviceAdaptation: false },
    });
    expect(thirty.sampling.minGapMs).toBeGreaterThanOrEqual(sixty.sampling.minGapMs);
  });

  it("mergePartialSampling conserve les champs non fournis", () => {
    const base = { minGapMs: 100, meritEpsilon: 0.01, maxSnapshotsPerHold: 12 };
    expect(mergePartialSampling(base, { meritEpsilon: 0.02 })).toEqual({
      minGapMs: 100,
      meritEpsilon: 0.02,
      maxSnapshotsPerHold: 12,
    });
  });
});
