import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";

export class JawUpStrategy implements PoseStrategy {
  readonly poseId = "jaw-up" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    const chin = frame.landmarks[152];
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) {
      hints.push('Levez un peu plus le menton.');
    }
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Revenez face caméra");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (!chin) hints.push("Menton non détecté");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez votre visage");
    const progress =
      (rangeProgress(frame.headPose.pitch, pose.pitchRange, 25) +
        rangeProgress(frame.headPose.yaw, pose.yawRange, 15) +
        rangeProgress(frame.headPose.roll, pose.rollRange, 15) +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio)) /
      4;
    return { ok: hints.length === 0, hints, progress };
  }
}
