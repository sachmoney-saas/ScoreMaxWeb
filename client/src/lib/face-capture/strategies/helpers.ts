import { foreheadExposure } from "../GeometryScorer";
import type { FaceFrame, LandmarkPoint } from "../types";
import { clamp01 } from "./PoseStrategy";

/**
 * Smile score in [0, 1].
 *
 * Primary signal: MediaPipe FaceLandmarker blendshapes
 * (`mouthSmileLeft` + `mouthSmileRight`), already calibrated by Google
 * across thousands of faces. We average them to smooth asymmetric smiles.
 *
 * Fallback (when blendshapes are unavailable): geometric heuristic combining
 * mouth widening relative to inter-ocular distance, and corner lift above
 * the lip midline.
 */
export function smileProgress(frame: FaceFrame): number {
  const bs = frame.blendshapes;
  const sl = bs?.mouthSmileLeft;
  const sr = bs?.mouthSmileRight;
  if (typeof sl === "number" && typeof sr === "number") {
    return clamp01((sl + sr) / 2);
  }
  return geometricSmileScore(frame.landmarks);
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
  const widthScore = clamp01((widthRatio - 0.42) / (0.58 - 0.42));

  const lipMidY = (upperLip.y + lowerLip.y) / 2;
  const cornersY = (cornerL.y + cornerR.y) / 2;
  const liftScore = clamp01((lipMidY - cornersY) / (mouthWidth * 0.18));

  return Math.max(widthScore, liftScore);
}

export function hairlineProgress(frame: FaceFrame): number {
  const exposure = foreheadExposure(frame.landmarks);
  if (exposure === null) return 0;
  if (exposure <= 0) return 1;
  return clamp01(1 - exposure * 8);
}
