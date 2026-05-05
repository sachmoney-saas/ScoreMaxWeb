import type { FaceFrame, PoseDefinition } from "../types";
import {
  PoseStrategy,
  StrategyOptions,
  faceRatio,
  inRange,
  rangeProgress,
  widenRange,
} from "./PoseStrategy";
import { hairlineProgress } from "./helpers";

/**
 * Hairline closeup is shot zoomed-in: MediaPipe landmark stability degrades
 * (face fills the frame, edges get clipped, lighting changes). Once the
 * user has *already* satisfied the strict criteria and we've started the
 * scan, we widen the angle ranges and lower the framing/hairline thresholds
 * so a brief detection wobble doesn't kick them out. We DON'T loosen at the
 * entry: that would let users start the hold from a clearly wrong pose.
 */
const HOLDING_ANGLE_EXPAND_DEG = 10;
const HOLDING_FACE_RATIO_FACTOR = 0.85;
/** Un peu plus tolérant quand le visage est plus petit dans le cadre (prise un peu plus loin). */
const HOLDING_HAIRLINE_THRESHOLD = 0.46;
const STRICT_HAIRLINE_THRESHOLD = 0.64;

export class HairlineStrategy implements PoseStrategy {
  readonly poseId = "closeup-hairline" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition, opts?: StrategyOptions) {
    const holding = opts?.holding === true;
    const yawRange = holding ? widenRange(pose.yawRange, HOLDING_ANGLE_EXPAND_DEG) : pose.yawRange;
    const pitchRange = holding
      ? widenRange(pose.pitchRange, HOLDING_ANGLE_EXPAND_DEG)
      : pose.pitchRange;
    const rollRange = holding
      ? widenRange(pose.rollRange, HOLDING_ANGLE_EXPAND_DEG)
      : pose.rollRange;
    const minFaceRatio = holding ? pose.minFaceRatio * HOLDING_FACE_RATIO_FACTOR : pose.minFaceRatio;
    const hairlineThreshold = holding ? HOLDING_HAIRLINE_THRESHOLD : STRICT_HAIRLINE_THRESHOLD;

    const hints: string[] = [];
    const hairline = hairlineProgress(frame);
    if (!inRange(frame.headPose.yaw, yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pitchRange)) hints.push("Penchez moins la tête");
    if (!inRange(frame.headPose.roll, rollRange)) hints.push("Redressez la tête");
    if (hairline < hairlineThreshold) hints.push("Dégagez davantage le front");
    if (faceRatio(frame) < minFaceRatio) hints.push("Rapprochez-vous un peu ou inclinez pour le front");
    const progress =
      (rangeProgress(frame.headPose.yaw, yawRange, 10) +
        rangeProgress(frame.headPose.pitch, pitchRange, 10) +
        rangeProgress(frame.headPose.roll, rollRange, 10) +
        hairline +
        Math.min(1, faceRatio(frame) / minFaceRatio)) /
      5;
    return { ok: hints.length === 0, hints, progress };
  }
}
