import type { FaceFrame, LandmarkPoint } from "../types";
import { clamp01 } from "./PoseStrategy";

/**
 * Seuil blendshapes (`mouthSmileLeft` / `mouthSmileRight`) — au-dessus = considéré
 * comme sourire clair. Hausse (0.3 → 0.42) pour limiter les faux positifs au
 * visage neutre ; les deux commissures doivent monter (voir `smileProgress`).
 */
export const SMILE_BLENDSHAPE_THRESHOLD = 0.42;

/**
 * Ouverture minimale (`jawOpen` MediaPipe 0..1) pour accepter le cliché sourire.
 * Sans ça, un « sourire » bouche fermée (blendshapes commissures seuls) peut passer le seuil.
 */
export const SMILE_MIN_JAW_OPEN_FOR_CAPTURE = 0.1;

/**
 * Blendshapes `eyeBlinkLeft` / `eyeBlinkRight` (MediaPipe Face Landmarker, échelle 0..1).
 * ~0 yeux ouverts, ↑ vers fermeture / clignement.
 */
export function eyeBlinkMax(blendshapes: Record<string, number>): number | null {
  const l = blendshapes?.eyeBlinkLeft;
  const r = blendshapes?.eyeBlinkRight;
  const hasL = typeof l === "number";
  const hasR = typeof r === "number";
  if (!hasL && !hasR) return null;
  return Math.max(hasL ? l! : 0, hasR ? r! : 0);
}

/**
 * Hors hold : au-dessus on considère « en train de cligner » pour bloquer le statut ready.
 * (Calibraison médiane téléphone ; marge sous un clignement complet ~0.7–1.)
 */
export const EYE_CLOSEUP_BLINK_READY_MAX = 0.32;

/** Courbe blink → ouvert : palier plein puis décroissance jusqu'à 0. */
const BLINK_SOFT = 0.08;
const BLINK_HARD = 0.52;

/** Score 1 = yeux bien ouverts, 0 = clignement franc. Blendshapes absents → 1 (pas de régression). */
export function eyeNotBlinkingBlendScore(frame: { blendshapes: Record<string, number> }): number {
  const m = eyeBlinkMax(frame.blendshapes);
  if (m === null) return 1;
  if (m <= BLINK_SOFT) return 1;
  if (m >= BLINK_HARD) return 0;
  return 1 - (m - BLINK_SOFT) / (BLINK_HARD - BLINK_SOFT);
}

/**
 * Smile score in [0, 1].
 *
 * Primary signal: MediaPipe FaceLandmarker blendshapes
 * (`mouthSmileLeft` + `mouthSmileRight`), already calibrated by Google
 * across thousands of faces. We require **both** corners to participate
 * (damps one-sided spikes) and lightly penalise a big **jawOpen** with a
 * weak smile (bâillement / bouche grande ouverte sans contraction sourire).
 *
 * **Ouverture** : on exige en plus un `jawOpen` minimal (ou équivalent géométrique)
 * pour rejeter un sourire strictement bouche fermée si l’utilisateur attend des dents visibles.
 *
 * Fallback (when blendshapes are unavailable): geometric heuristic —
 * stricter than before (neutre doit rester bas).
 */
export function smileProgress(frame: FaceFrame): number {
  const bs = frame.blendshapes;
  const sl = bs?.mouthSmileLeft;
  const sr = bs?.mouthSmileRight;
  if (typeof sl === "number" && typeof sr === "number") {
    let s = clamp01(blendshapeSmileScore(bs, sl, sr));
    const jaw = bs.jawOpen;
    if (typeof jaw === "number") {
      if (jaw < SMILE_MIN_JAW_OPEN_FOR_CAPTURE) {
        s *= jaw / Math.max(1e-6, SMILE_MIN_JAW_OPEN_FOR_CAPTURE);
      }
    } else {
      s *= geometricMouthOpenScore(frame.landmarks);
    }
    return clamp01(s);
  }
  const geoSmile = geometricSmileScore(frame.landmarks);
  const geoOpen = geometricMouthOpenScore(frame.landmarks);
  return clamp01(Math.min(geoSmile, geoOpen));
}

function geometricMouthOpenScore(lms: LandmarkPoint[]): number {
  const upperLip = lms[13];
  const lowerLip = lms[14];
  const cornerL = lms[61];
  const cornerR = lms[291];
  if (!upperLip || !lowerLip || !cornerL || !cornerR) return 0;
  const mouthWidth = Math.hypot(cornerR.x - cornerL.x, cornerR.y - cornerL.y);
  if (mouthWidth < 1e-6) return 0;
  /** Coords normalisées, y vers le bas : bouche ouverte ⇒ espace vertical lèvres. */
  const gap = Math.max(0, lowerLip.y - upperLip.y);
  /** ~0.028 = joint, 0.06+ = ouverture nette (relatif à la largeur bouche). */
  return clamp01((gap / mouthWidth - 0.026) / 0.042);
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

