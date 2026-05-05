import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";

export class CrownDownStrategy implements PoseStrategy {
  readonly poseId = "crown-down" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    const forehead = frame.landmarks[10];
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) {
      hints.push('Baissez un peu plus la tête.');
    }
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Revenez face caméra");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (!forehead) hints.push("Sommet du crâne non détecté");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez votre visage");
    const progress = rangeProgress(frame.headPose.pitch, pose.pitchRange, 18);
    return { ok: hints.length === 0, hints, progress };
  }
}
