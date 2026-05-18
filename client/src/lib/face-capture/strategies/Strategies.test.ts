import { describe, expect, it } from "vitest";
import { CAPTURE_POSES, type FaceFrame, type LandmarkPoint, type PoseId } from "../types";
import { POSE_STRATEGIES } from "./index";

function buildLandmarks(faceWidth = 0.24): LandmarkPoint[] {
  const lms: LandmarkPoint[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  lms[33] = { x: 0.35, y: 0.45, z: 0, visibility: 1 };
  lms[263] = { x: 0.65, y: 0.45, z: 0, visibility: 1 };
  lms[234] = { x: 0.5 - faceWidth / 2, y: 0.5, z: 0, visibility: 1 };
  lms[454] = { x: 0.5 + faceWidth / 2, y: 0.5, z: 0, visibility: 1 };
  lms[10] = { x: 0.5, y: 0.25, z: 0, visibility: 1 };
  lms[152] = { x: 0.5, y: 0.75, z: 0, visibility: 1 };
  lms[13] = { x: 0.5, y: 0.58, z: 0, visibility: 1 };
  lms[14] = { x: 0.5, y: 0.65, z: 0, visibility: 1 };
  lms[61] = { x: 0.4, y: 0.6, z: 0, visibility: 1 };
  lms[291] = { x: 0.6, y: 0.6, z: 0, visibility: 1 };
  lms[159] = { x: 0.5, y: 0.46, z: 0, visibility: 1 };
  lms[145] = { x: 0.5, y: 0.53, z: 0, visibility: 1 };
  lms[107] = { x: 0.43, y: 0.33, z: 0, visibility: 1 };
  lms[336] = { x: 0.57, y: 0.33, z: 0, visibility: 1 };
  return lms;
}

function frameForPose(poseId: PoseId): FaceFrame {
  const defaults: Record<PoseId, FaceFrame["headPose"]> = {
    frontal: { yaw: 0, pitch: 0, roll: 0 },
    "profile-right": { yaw: -50, pitch: 0, roll: 0 },
    "profile-left": { yaw: 50, pitch: 0, roll: 0 },
    "jaw-up": { yaw: 0, pitch: -35, roll: 0 },
    "crown-down": { yaw: 0, pitch: 34, roll: 0 },
    "closeup-smile": { yaw: 0, pitch: 0, roll: 0 },
    "closeup-eye": { yaw: 0, pitch: 0, roll: 0 },
  };
  const blendshapes: Record<string, number> =
    poseId === "closeup-smile"
      ? {
          mouthSmileLeft: 0.55,
          mouthSmileRight: 0.55,
          jawOpen: 0.14,
        }
      : {};
  return {
    timestamp: 0,
    landmarks: buildLandmarks(),
    headPose: defaults[poseId],
    confidence: 1,
    frameWidth: 1280,
    frameHeight: 720,
    blendshapes,
  };
}

describe("closeup-eye blink behaviour", () => {
  const strategy = POSE_STRATEGIES.find((s) => s.poseId === "closeup-eye")!;
  const poseDef = CAPTURE_POSES.find((p) => p.id === "closeup-eye")!;

  it("hints when blink is strong before hold", () => {
    const frame = frameForPose("closeup-eye");
    frame.landmarks = buildLandmarks();
    frame.landmarks[234] = { x: 0.12, y: 0.5, z: 0, visibility: 1 };
    frame.landmarks[454] = { x: 0.82, y: 0.5, z: 0, visibility: 1 };
    frame.blendshapes = { eyeBlinkLeft: 0.72, eyeBlinkRight: 0.68 };
    const result = strategy.evaluate(frame, poseDef, { holding: false });
    expect(result.ok).toBe(false);
    expect(result.hints.some((h) => h.includes("ouvert"))).toBe(true);
  });

  it("does not add blink hints during holding", () => {
    const frame = frameForPose("closeup-eye");
    frame.landmarks = buildLandmarks();
    frame.landmarks[234] = { x: 0.12, y: 0.5, z: 0, visibility: 1 };
    frame.landmarks[454] = { x: 0.82, y: 0.5, z: 0, visibility: 1 };
    frame.blendshapes = { eyeBlinkLeft: 0.72, eyeBlinkRight: 0.68 };
    const result = strategy.evaluate(frame, poseDef, { holding: true });
    expect(result.hints.some((h) => h.includes("ouvert"))).toBe(false);
    expect(result.ok).toBe(true);
  });
});

describe("pose strategies", () => {
  const frontalStrategy = POSE_STRATEGIES.find((s) => s.poseId === "frontal")!;
  const frontalPoseDef = CAPTURE_POSES.find((p) => p.id === "frontal")!;

  it("asks the user to step back when the frontal face is too close", () => {
    const frame = frameForPose("frontal");
    frame.landmarks = buildLandmarks(0.36);

    const result = frontalStrategy.evaluate(frame, frontalPoseDef);

    expect(result.ok).toBe(false);
    expect(result.hints).toContain("Reculez légèrement");
  });

  for (const strategy of POSE_STRATEGIES) {
    it(`evaluates ${strategy.poseId}`, () => {
      const poseDef = CAPTURE_POSES.find((p) => p.id === strategy.poseId)!;
      const result = strategy.evaluate(frameForPose(strategy.poseId), poseDef);
      expect(result.progress).toBeGreaterThan(0.2);
    });
  }
});
