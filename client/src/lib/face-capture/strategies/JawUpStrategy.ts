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
    /** Score d’alignement : uniquement le pitch (angle tête haut/bas). */
    const progress = rangeProgress(frame.headPose.pitch, pose.pitchRange, 25);
    return { ok: hints.length === 0, hints, progress };
  }
}
