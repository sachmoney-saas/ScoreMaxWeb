import { foreheadExposure } from "../GeometryScorer";
import type { FaceFrame, LandmarkPoint } from "../types";
import { clamp01 } from "./PoseStrategy";

/**
 * Seuil blendshapes (`mouthSmileLeft` / `mouthSmileRight`) — au-dessus = considéré
 * comme sourire clair. Hausse (0.3 → 0.42) pour limiter les faux positifs au
 * visage neutre ; les deux commissures doivent monter (voir `smileProgress`).
 */
export const SMILE_BLENDSHAPE_THRESHOLD = 0.42;

/**
 * Smile score in [0, 1].
 *
 * Primary signal: MediaPipe FaceLandmarker blendshapes
 * (`mouthSmileLeft` + `mouthSmileRight`), already calibrated by Google
 * across thousands of faces. We require **both** corners to participate
 * (damps one-sided spikes) and lightly penalise a big **jawOpen** with a
 * weak smile (bâillement / bouche grande ouverte sans contraction sourire).
 *
 * Fallback (when blendshapes are unavailable): geometric heuristic —
 * stricter than before (neutre doit rester bas).
 */
export function smileProgress(frame: FaceFrame): number {
  const bs = frame.blendshapes;
  const sl = bs?.mouthSmileLeft;
  const sr = bs?.mouthSmileRight;
  if (typeof sl === "number" && typeof sr === "number") {
    return clamp01(blendshapeSmileScore(bs, sl, sr));
  }
  return geometricSmileScore(frame.landmarks);
}

function blendshapeSmileScore(
  bs: Record<string, number>,
  sl: number,
  sr: number,
): number {
  const avg = (sl + sr) / 2;
  const minSide = Math.min(sl, sr);
  /** Les deux côtés doivent monter ; évite un pic d’un seul blendshape. */
  let raw = Math.min(avg, 1.12 * minSide + 0.04);

  const jawOpen = bs.jawOpen;
  if (typeof jawOpen === "number" && jawOpen > 0.42 && avg < 0.5) {
    /** Grande ouverture sans vrai sourire → réduit le score (ex. bouche ouverte passive). */
    const excess = Math.min(1, (jawOpen - 0.42) / 0.38);
    raw *= 1 - excess * 0.72;
  }

  return raw;
}

function geometricSmileScore(lms: LandmarkPoint[]): number {
  const cornerL = lms[61];
  const cornerR = lms[291];
  const upperLip = lms[13];
  const lowerLip = lms[14];
  const eyeL = lms[33];
  const eyeR = lms[263];
  if (!cornerL || !cornerR || !upperLip || !lowerLip || !eyeL || !eyeR) return 0;

  const eyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
  const mouthWidth = Math.hypot(cornerR.x - cornerL.x, cornerR.y - cornerL.y);
  if (eyeDist < 1e-6 || mouthWidth < 1e-6) return 0;

  const widthRatio = mouthWidth / eyeDist;
  /** Plus strict : exige une bouche nettement plus large qu’au repos. */
  const widthScore = clamp01((widthRatio - 0.46) / (0.60 - 0.46));

  const lipMidY = (upperLip.y + lowerLip.y) / 2;
  const cornersY = (cornerL.y + cornerR.y) / 2;
  const liftScore = clamp01((lipMidY - cornersY) / (mouthWidth * 0.22));

  /** Les deux indices doivent concorder (évite un seul signal trompeur). */
  return Math.min(widthScore, liftScore);
}

export function hairlineProgress(frame: FaceFrame): number {
  const exposure = foreheadExposure(frame.landmarks);
  if (exposure === null) return 0;
  if (exposure <= 0) return 1;
  return clamp01(1 - exposure * 8);
}
