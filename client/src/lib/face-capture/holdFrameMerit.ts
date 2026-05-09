import type { FaceFrame, PoseDefinition, PoseValidation, PoseId } from "./types";
import type { HoldMeritWeights } from "./holdBestFrameTuning";
import { DEFAULT_HOLD_MERIT_WEIGHTS } from "./holdBestFrameTuning";
import { eyeNotBlinkingBlendScore } from "./strategies/helpers";
import { faceRatio } from "./strategies/PoseStrategy";

/**
 * Proximité du centre géométrique d'une plage [a,b] (1 = pile au centre, 0 = bord ou hors plage tolérée comme +1 rayon).
 */
export function angularRangeMidpointFit(value: number, [a, b]: [number, number]): number {
  const mid = (a + b) / 2;
  const half = Math.max(1e-6, Math.abs(b - a) / 2);
  const dist = Math.abs(value - mid) / half;
  return Math.max(0, 1 - Math.min(1, dist));
}

/** Triplet angles : frontal & défaut — centrage 3D « neutre ». */
const TRIPLET_YAW = 0.34;
const TRIPLET_PITCH = 0.33;
const TRIPLET_ROLL = 0.33;

/** Profil : stabilité latérale prioritaire, pitch pour limiter la tête penchée. */
const PROFILE_YAW = 0.74;
const PROFILE_PITCH = 0.26;

/** Menton / sommet : consigne verticale dominante. */
const VERT_PITCH = 0.8;
const VERT_YAW = 0.2;

/** Gros plans œil / hairline : angles + cadrage (minFaceRatio). */
const CLOSEUP_ANGLE = 0.7;
const CLOSEUP_FRAMING = 0.3;

/** Pondération anti-blink (blendshapes) pour `closeup-eye` uniquement. */
const CLOSEUP_EYE_NO_BLINK = 0.12;

function poseGeometricMerit(pose: PoseDefinition, frame: FaceFrame): number {
  const { yaw, pitch, roll } = frame.headPose;

  const tri =
    angularRangeMidpointFit(yaw, pose.yawRange) * TRIPLET_YAW +
    angularRangeMidpointFit(pitch, pose.pitchRange) * TRIPLET_PITCH +
    angularRangeMidpointFit(roll, pose.rollRange) * TRIPLET_ROLL;

  const pid: PoseId = pose.id;
  if (pid === "profile-right" || pid === "profile-left") {
    return (
      angularRangeMidpointFit(yaw, pose.yawRange) * PROFILE_YAW +
      angularRangeMidpointFit(pitch, pose.pitchRange) * PROFILE_PITCH
    );
  }
  if (pid === "jaw-up" || pid === "crown-down") {
    return (
      angularRangeMidpointFit(pitch, pose.pitchRange) * VERT_PITCH +
      angularRangeMidpointFit(yaw, pose.yawRange) * VERT_YAW
    );
  }
  if (pid === "closeup-hairline") {
    const fr = faceRatio(frame);
    const framing = Math.min(1, fr / Math.max(pose.minFaceRatio, 1e-6));
    return tri * CLOSEUP_ANGLE + framing * CLOSEUP_FRAMING;
  }
  if (pid === "closeup-eye") {
    const fr = faceRatio(frame);
    const framing = Math.min(1, fr / Math.max(pose.minFaceRatio, 1e-6));
    const noBlink = eyeNotBlinkingBlendScore(frame);
    const rest = 1 - CLOSEUP_EYE_NO_BLINK;
    return (
      tri * (CLOSEUP_ANGLE * rest) +
      framing * (CLOSEUP_FRAMING * rest) +
      noBlink * CLOSEUP_EYE_NO_BLINK
    );
  }
  /** frontal, closeup-sourire, etc. */
  return tri;
}

/** Score agrégé 0..1 ~ qualité pour choisir une frame pendant « Ne bougez pas ». */
export function computeHoldFrameMerit(
  pose: PoseDefinition,
  frame: FaceFrame,
  validation: PoseValidation,
  weights: HoldMeritWeights = DEFAULT_HOLD_MERIT_WEIGHTS,
): number {
  const geometric = poseGeometricMerit(pose, frame);

  const readiness =
    validation.status === "ready" ? 1 : validation.status === "aligning" ? 0.9 : 0.72;

  return (
    weights.validationScore * validation.score +
    weights.geometry * geometric +
    weights.detectorConfidence * frame.confidence +
    weights.readinessBonus * readiness
  );
}
