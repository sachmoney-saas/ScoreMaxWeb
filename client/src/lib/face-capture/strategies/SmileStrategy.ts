import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";
import { smileProgress } from "./helpers";

/**
 * Threshold tuned for MediaPipe blendshapes (`mouthSmileLeft` + `mouthSmileRight`):
 * - neutral closed mouth: ~0.05
 * - polite closed-mouth smile: ~0.20–0.35
 * - clear smile (closed or open): ~0.40+
 */
const SMILE_THRESHOLD = 0.3;

export class SmileStrategy implements PoseStrategy {
  readonly poseId = "closeup-smile" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    const smile = smileProgress(frame);
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Regardez droit devant");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (smile < SMILE_THRESHOLD) {
      hints.push('Souriez davantage.');
    }
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez votre visage");
    const smileNormalized = Math.min(1, smile / SMILE_THRESHOLD);
    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange, 12) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange, 12) +
        rangeProgress(frame.headPose.roll, pose.rollRange, 12) +
        smileNormalized +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio)) /
      5;
    return { ok: hints.length === 0, hints, progress };
  }
}
