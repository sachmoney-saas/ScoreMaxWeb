import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";

export class FrontalStrategy implements PoseStrategy {
  readonly poseId = "frontal" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Regardez droit devant");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez votre visage");
    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange) +
        rangeProgress(frame.headPose.roll, pose.rollRange) +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio)) /
      4;
    return { ok: hints.length === 0, hints, progress };
  }
}
