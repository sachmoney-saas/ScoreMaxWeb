import { describe, expect, it } from "vitest";
import type { FaceFrame, LandmarkPoint } from "../types";
import { smileProgress, SMILE_BLENDSHAPE_THRESHOLD } from "./helpers";

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
  it("returns high score when both corners smile strongly", () => {
    const s = smileProgress(
      frameWithBlendshapes({ mouthSmileLeft: 0.58, mouthSmileRight: 0.56 }),
    );
    expect(s).toBeGreaterThanOrEqual(SMILE_BLENDSHAPE_THRESHOLD);
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
