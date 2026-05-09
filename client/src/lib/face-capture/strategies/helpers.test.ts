import { describe, expect, it } from "vitest";
import type { FaceFrame, LandmarkPoint } from "../types";
import { smileProgress, SMILE_BLENDSHAPE_THRESHOLD, eyeBlinkMax, eyeNotBlinkingBlendScore } from "./helpers";

function frameWithBlendshapes(blendshapes: Record<string, number>): FaceFrame {
  return {
    timestamp: 0,
    landmarks: [] as LandmarkPoint[],
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    confidence: 1,
    frameWidth: 720,
    frameHeight: 1280,
    blendshapes,
  };
}

describe("smileProgress", () => {
  it("returns high score when corners smile strongly and jaw opens enough", () => {
    const s = smileProgress(
      frameWithBlendshapes({
        mouthSmileLeft: 0.58,
        mouthSmileRight: 0.56,
        jawOpen: 0.14,
      }),
    );
    expect(s).toBeGreaterThanOrEqual(SMILE_BLENDSHAPE_THRESHOLD);
  });

  it("rejects strong mouthSmile with closed jaw (no visible open mouth)", () => {
    const s = smileProgress(
      frameWithBlendshapes({
        mouthSmileLeft: 0.56,
        mouthSmileRight: 0.55,
        jawOpen: 0.03,
      }),
    );
    expect(s).toBeLessThan(SMILE_BLENDSHAPE_THRESHOLD);
  });

  it("damps asymmetric one-sided spikes", () => {
    const s = smileProgress(
      frameWithBlendshapes({ mouthSmileLeft: 0.55, mouthSmileRight: 0.08 }),
    );
    expect(s).toBeLessThan(SMILE_BLENDSHAPE_THRESHOLD);
  });

  it("damps large jaw open with weak smile (false positive guard)", () => {
    const s = smileProgress(
      frameWithBlendshapes({
        mouthSmileLeft: 0.22,
        mouthSmileRight: 0.2,
        jawOpen: 0.75,
      }),
    );
    expect(s).toBeLessThan(0.35);
  });

  it("keeps clear open smile when average is high", () => {
    const s = smileProgress(
      frameWithBlendshapes({
        mouthSmileLeft: 0.52,
        mouthSmileRight: 0.5,
        jawOpen: 0.55,
      }),
    );
    expect(s).toBeGreaterThanOrEqual(SMILE_BLENDSHAPE_THRESHOLD);
  });
});

describe("eye blink blendshapes", () => {
  it("eyeNotBlinkingBlendScore is 1 when blendshapes missing", () => {
    expect(
      eyeNotBlinkingBlendScore(frameWithBlendshapes({})),
    ).toBe(1);
  });

  it("drops when blink is strong", () => {
    const low = eyeNotBlinkingBlendScore(
      frameWithBlendshapes({ eyeBlinkLeft: 0.05, eyeBlinkRight: 0.04 }),
    );
    const high = eyeNotBlinkingBlendScore(
      frameWithBlendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.85 }),
    );
    expect(low).toBeGreaterThan(0.95);
    expect(high).toBeLessThan(0.15);
  });

  it("eyeBlinkMax returns max of both eyes", () => {
    expect(eyeBlinkMax({ eyeBlinkLeft: 0.2, eyeBlinkRight: 0.6 })).toBe(0.6);
    expect(eyeBlinkMax({ eyeBlinkLeft: 0.3 })).toBe(0.3);
  });
});
