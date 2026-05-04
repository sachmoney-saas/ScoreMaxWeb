import type { FaceFrame, PoseDefinition } from "../types";
import { PoseStrategy, faceRatio, inRange, rangeProgress } from "./PoseStrategy";

/**
 * Eye-closeup validation focuses purely on framing (head angles + face
 * proximity). We deliberately do NOT measure eye openness: there is no
 * reliable scalar in normalized landmark space that captures it (the naive
 * height/inter-ocular ratio is dominated by inter-ocular distance, not
 * eyelid opening), and asking the user to "open more" when their eye is
 * already wide open leads to the dead-end the user reported.
 */
export class EyeCloseupStrategy implements PoseStrategy {
  readonly poseId = "closeup-eye" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition) {
    const hints: string[] = [];
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Regardez vers la caméra");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez encore l'oeil");
    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange, 12) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange, 12) +
        rangeProgress(frame.headPose.roll, pose.rollRange, 12) +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio)) /
      4;
    return { ok: hints.length === 0, hints, progress };
  }
}
