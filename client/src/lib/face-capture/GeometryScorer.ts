// ============================================================
// GeometryScorer — Geometric scoring cues beyond raw angles.
// Pure functions, no side effects, no external dependencies.
// ============================================================

import type { LandmarkPoint, PoseId } from './types';

/**
 * Mouth Aspect Ratio (MAR) — standard real-time smile scorer.
 *
 * MAR = mouthWidth / mouthHeight  where:
 *   mouthWidth = ‖cornerR − cornerL‖
 *   mouthHeight = ‖upperLip − lowerLip‖
 *
 * Typical values (normalized landmarks):
 *   Mouth closed:  MAR ≈ 2.5–4.5
 *   Light smile:   MAR ≈ 4.5–6.5
 *   Broad smile:   MAR ≈ 6.5+
 *
 * Returns null when required landmarks are not visible.
 */
export function mouthAspectRatio(landmarks: LandmarkPoint[]): number | null {
  const cornerL = landmarks[61];   // left mouth corner
  const cornerR = landmarks[291];  // right mouth corner
  const upperLip = landmarks[13]; // upper lip center
  const lowerLip = landmarks[14]; // lower lip center

  if (!cornerL || !cornerR || !upperLip || !lowerLip) return null;
  if (
    (cornerL.visibility ?? 1) < 0.3 ||
    (cornerR.visibility ?? 1) < 0.3 ||
    (upperLip.visibility ?? 1) < 0.3 ||
    (lowerLip.visibility ?? 1) < 0.3
  ) return null;

  const mouthWidth = Math.hypot(cornerR.x - cornerL.x, cornerR.y - cornerL.y);
  const mouthHeight = Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y);

  if (mouthHeight < 1e-6) return null;
  return mouthWidth / mouthHeight;
}

/** MAR score: 0 = closed, 1 = broad smile. Sigmoid-ish mapping. */
export function mouthScore(mar: number): number {
  // Clamped MAR; neutral closed ≈ 3.5, wide smile ≈ 7+
  const marClamped = Math.max(0, mar);
  // Sigmoid centred at 5 → 0.5 at neutral, ≈1 at wide smile
  const SIGMOID_MID = 5.0;
  const SIGMOID_SLOPE = 1.2;
  return 1 / (1 + Math.exp(-SIGMOID_SLOPE * (marClamped - SIGMOID_MID)));
}

/**
 * Eye openness ratio — detects if an eye is sufficiently open.
 * ratio = eyeHeight / eyeWidth
 *  ≈ 0.20–0.30 closed, 0.30–0.45 open
 *
 * Uses outer eye corners + upper/lower lid centres.
 */
export function eyeOpennessRatio(
  landmarks: LandmarkPoint[],
  leftIndices: [number, number, number, number],
  rightIndices: [number, number, number, number],
): { left: number | null; right: number | null } {
  const [llTop, llBot, rlTop, rlBot] = leftIndices;   // 33, 159, 386, 263 (left-eye top/bot/right-eye top/bot)
  const [rlTop2, rlBot2, llTop2, llBot2] = rightIndices;

  const leTop = landmarks[llTop];
  const leBot = landmarks[llBot];
  const reTop = landmarks[rlTop];
  const reBot = landmarks[rlBot];

  const leftH = leTop && leBot
    ? Math.hypot(leTop.x - leBot.x, leTop.y - leBot.y)
    : 0;
  const rightH = reTop && reBot
    ? Math.hypot(reTop.x - reBot.x, reTop.y - reBot.y)
    : 0;
  // Width via outer corners
  const leftW = (landmarks[llTop] && landmarks[llBot])
    ? Math.hypot(landmarks[llBot]!.x - landmarks[llTop]!.x, landmarks[llBot]!.y - landmarks[llTop]!.y)
    : 0;
  const rightW = (landmarks[rlTop2] && landmarks[rlBot2])
    ? Math.hypot(landmarks[rlBot2]!.x - landmarks[rlTop2]!.x, landmarks[rlBot2]!.y - landmarks[rlTop2]!.y)
    : 0;

  return {
    left: leftH > 1e-6 && leftW > 1e-6 ? leftH / leftW : null,
    right: rightH > 1e-6 && rightW > 1e-6 ? rightH / rightW : null,
  };
}

/**
 * Eyebrow-to-eye distance — measures how raised the eyebrows are.
 * Used to verify the eye closeup is genuine (not just a zoomed eye with droopy brows).
 *
 * distance = ‖ eyebrowCentre − eyeCentre ‖ / eyeWidth
 *
 * Returns null when any landmark is not visible.
 */
export function eyebrowEyeDistance(
  landmarks: LandmarkPoint[],
  eyebrowIdx: number,
  eyeCenterIdx: number,
  eyeWidthIdxL: number,
  eyeWidthIdxR: number,
): number | null {
  const brow = landmarks[eyebrowIdx];
  const eyeC = landmarks[eyeCenterIdx];
  const le = landmarks[eyeWidthIdxL];
  const re = landmarks[eyeWidthIdxR];
  if (!brow || !eyeC || !le || !re) return null;

  const eyeW = Math.hypot(re.x - le.x, re.y - le.y);
  if (eyeW < 1e-6) return null;

  const dist = Math.hypot(brow.x - eyeC.x, brow.y - eyeC.y);
  return dist / eyeW;
}

/**
 * Forehead visibility — measures how much of the forehead is exposed.
 * Used for hairline pose: forehead apex (10) should be above the brow ridge (107/336).
 *
 * Returns the vertical gap (nose-same-space normalised) between apex and brow ridge.
 * Positive = apex above brow ridge (good hairline exposure).
 */
export function foreheadExposure(landmarks: LandmarkPoint[]): number | null {
  const apex = landmarks[10];  // forehead apex
  const browL = landmarks[107];
  const browR = landmarks[336];
  if (!apex || !browL || !browR) return null;

  const browMidY = (browL.y + browR.y) * 0.5;
  // In Face Mesh 2D: y increases downward, so apex.y < browMidY → apex is above
  return apex.y - browMidY;
}

/**
 * Jaw prominence — measures how pronounced the chin is relative to the mouth.
 * landmark 152 = chin, 13 = upper lip. The vertical gap normalises by face height.
 * Used for jaw-up pose: chin should be prominent, not buried by the lower lip.
 *
 * Returns positive value when chin protrudes below upper lip (chin visible).
 */
export function jawProminence(landmarks: LandmarkPoint[]): number | null {
  const chin = landmarks[152];
  const upperLip = landmarks[13];
  const eyeL = landmarks[33];
  const eyeR = landmarks[263];
  if (!chin || !upperLip || !eyeL || !eyeR) return null;

  const faceH = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
  if (faceH < 1e-6) return null;

  // In Face Mesh coords: y increases downward.
  // chin.y > upperLip.y → chin is below (lower on screen) = chin protrudes forward
  return (chin.y - upperLip.y) / faceH;
}