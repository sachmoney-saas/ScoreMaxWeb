import type { FaceFrame, PoseDefinition } from "../types";
import {
  PoseStrategy,
  faceRatio,
  faceRatioRangeProgress,
  inRange,
  rangeProgress,
} from "./PoseStrategy";

export class FrontalStrategy implements PoseStrategy {
  readonly poseId = "frontal" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Regardez droit devant");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    const framingRatio = faceRatio(frame);
    if (framingRatio < pose.minFaceRatio) hints.push("Rapprochez votre visage");
    if (pose.maxFaceRatio !== undefined && framingRatio > pose.maxFaceRatio) {
      hints.push("Reculez légèrement");
    }
    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange) +
        rangeProgress(frame.headPose.roll, pose.rollRange) +
        faceRatioRangeProgress(framingRatio, pose.minFaceRatio, pose.maxFaceRatio)) /
      4;
    return { ok: hints.length === 0, hints, progress };
  }
}
