import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";

export class ProfileRightStrategy implements PoseStrategy {
  readonly poseId = "profile-right" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    if (!inRange(frame.headPose.yaw, pose.yawRange)) {
      hints.push('Tournez davantage la tête vers la droite.');
    }
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Gardez la tête horizontale");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Restez bien cadré");
    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange, 25) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange, 15) +
        rangeProgress(frame.headPose.roll, pose.rollRange, 15) +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio)) /
      4;
    return { ok: hints.length === 0, hints, progress };
  }
}
