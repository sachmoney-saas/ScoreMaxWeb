import type { FaceFrame, PoseDefinition } from "../types";
import {
  EYE_CLOSEUP_BLINK_READY_MAX,
  eyeBlinkMax,
  eyeNotBlinkingBlendScore,
} from "./helpers";
import { PoseStrategy, faceRatio, inRange, rangeProgress, type StrategyOptions } from "./PoseStrategy";

/**
 * Gros plan œil : cadrage + angles comme avant ; en plus les blendshapes
 * `eyeBlinkLeft`/`eyeBlinkRight` évitent de valider **ready** sur un clignement
 * franc. Pendant le hold, on ne coupe pas là-dessus (sinon abandon intempestif),
 * le mérite temps réel préfère quand même les frames sans blink.
 */
export class EyeCloseupStrategy implements PoseStrategy {
  readonly poseId = "closeup-eye" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition, opts?: StrategyOptions) {
    const holding = opts?.holding === true;
    const hints: string[] = [];
    if (!inRange(frame.headPose.yaw, pose.yawRange)) hints.push("Tournez moins la tête");
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Regardez vers la caméra");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Rapprochez davantage l'appareil de votre œil");

    const blinkMax = eyeBlinkMax(frame.blendshapes);
    if (!holding && blinkMax !== null && blinkMax > EYE_CLOSEUP_BLINK_READY_MAX) {
      hints.push("Gardez l'œil bien ouvert un instant.");
    }

    /** Pendant le hold : ne pas pénaliser le score avec le blink (évite jitter / redo hold). */
    const blinkProg = holding ? 1 : eyeNotBlinkingBlendScore(frame);

    const progress =
      (rangeProgress(frame.headPose.yaw, pose.yawRange, 12) +
        rangeProgress(frame.headPose.pitch, pose.pitchRange, 12) +
        rangeProgress(frame.headPose.roll, pose.rollRange, 12) +
        Math.min(1, faceRatio(frame) / pose.minFaceRatio) +
        blinkProg) /
      5;
    return { ok: hints.length === 0, hints, progress };
  }
}
