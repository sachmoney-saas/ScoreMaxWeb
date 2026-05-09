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
/**
 * Pendant le hold, on tolère ~15 % de moins en taille de visage (le gros plan
 * dérive un peu quand l'utilisateur incline la tête pour exposer le front).
 * Le seuil d'entrée (`minFaceRatio` élevé dans `types`) reste strict ;
 * en hold on assouplit légèrement la taille / le hairline pour le wobble détection.
 */
const HOLDING_FACE_RATIO_FACTOR = 0.85;
/** Un peu plus tolérant quand le visage est plus petit dans le cadre (prise un peu plus loin). */
const HOLDING_HAIRLINE_THRESHOLD = 0.5;
const STRICT_HAIRLINE_THRESHOLD = 0.68;

export class HairlineStrategy implements PoseStrategy {
  readonly poseId = "closeup-hairline" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition, opts?: StrategyOptions) {
    const holding = opts?.holding === true;

    if (
      !holding &&
      pose.requirePullBackBeforeAlign &&
      opts?.pullBackSatisfied === false
    ) {
      const maxR = pose.requirePullBackBeforeAlign.maxFaceRatio;
      const fr = faceRatio(frame);
      const pullProg =
        fr < maxR ? 0.5 : Math.max(0, 1 - (fr - maxR) / Math.max(0.2, 0.75 - maxR)) * 0.42;
      return {
        ok: false,
        hints: [
          "Éloignez un instant l'appareil, puis rapprochez-le fortement pour cadrer le front.",
        ],
        progress: pullProg,
      };
    }

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
    if (faceRatio(frame) < minFaceRatio) hints.push("Rapprochez davantage l'appareil du front");
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
