// ============================================================
// Guides debug admin — calques mesurés sur JPEG + landmarks figés au déclenchement :
// 1) lignes sous yeux et milieu des lèvres → intersections ovale MediaPipe ;
// 2) largeur nez (98↔327) et largeur bouche (61↔291), parallèles ;
// 3) médiatrice-type : verticale x = milieu interpupillaire → ovale ; tiercements au milieu
//    des deux yeux (moyenne Y des anneaux paupière) et milieu des lèvres (13/14).
// 4) contour fermé ovale visage (FACEMESH_FACE_OVAL_ORDERED) : forme du visage, trait bleu continu.
// ============================================================

import { getPreferredLanguage, type AppLanguage } from "@/lib/i18n";
import { CAPTURE_MAX_LONG_EDGE_PX } from './CameraManager';
import {
  FACEMESH_LEFT_EYE_ORDERED,
  FACEMESH_LIP_INNER_ORDERED,
  FACEMESH_LIP_OUTER_ORDERED,
  FACEMESH_RIGHT_EYE_ORDERED,
} from './facemesh-feature-contours';
import { FACEMESH_FACE_OVAL_JAW_LOWER_ARC_ORDERED, FACEMESH_FACE_OVAL_ORDERED } from './facemesh-face-oval';
import type { LandmarkPoint, PoseId } from './types';
import {
  FACEMESH_CHIN_CENTER,
  FACEMESH_FRONTAL_JAW_LEFT_LATERAL,
  FACEMESH_FRONTAL_JAW_RIGHT_LATERAL,
  FACEMESH_JAW_LEFT_HEMISPHERE_TO_CHIN_ORDERED,
  FACEMESH_JAW_RIGHT_HEMISPHERE_TO_CHIN_ORDERED,
} from './facemesh-profile-jaw';
import {
  FACEMESH_PROFILE_LEFT_VISIBLE_NOSE_ORDERED,
  FACEMESH_PROFILE_RIGHT_VISIBLE_NOSE_ORDERED,
} from './facemesh-profile-nose';
import { videoNormToElementPx } from './MaskRenderer';

/** Accent SaaS (~ Tailwind sky-300) pour tous les tracés de mesure capture. */
export const CAPTURE_GUIDE_ACCENT_STROKE_RGBA = 'rgba(125, 211, 252, 0.94)';
export const CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA = 'rgba(186, 230, 253, 0.95)';

/**
 * Largeur bouche / largeur nez, même définition géométrique que les traits horizontaux
 * narinaire (98↔327) et commissures (61↔291) — portées |Δx| en coordonnées normalisées.
 */
export function mouthToNoseWidthRatioFromLandmarks(
  landmarks: LandmarkPoint[],
): number | null {
  const nL = landmarks[98];
  const nR = landmarks[327];
  const mL = landmarks[61];
  const mR = landmarks[291];
  if (
    !nL ||
    !nR ||
    !mL ||
    !mR ||
    nL.x === undefined ||
    nR.x === undefined ||
    mL.x === undefined ||
    mR.x === undefined
  ) {
    return null;
  }
  /** Pas de filtre `visibility` : les mêmes points servent déjà aux traits ; Face Landmarker peut mettre des scores bas alors que x/y sont exploitables. */
  const noseW = Math.abs(nR.x - nL.x);
  const mouthW = Math.abs(mR.x - mL.x);
  if (!(noseW > 1e-6 && Number.isFinite(mouthW))) return null;
  const ratio = mouthW / noseW;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/** Affichage locale du multiplicateur `0,85x` / `0.85x` (2 décimales). */
function formatRatioMultiplierText(lang: AppLanguage, ratio: number): string {
  const ratioStr = ratio.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${ratioStr}x`;
}

/** Texte bleu clair + contour, sans fond (repères ratio). */
function drawAccentRatioTextMapped(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  minDimPx: number,
  text: string,
  opts?: { textAlign?: CanvasTextAlign },
): void {
  const fontPx = Math.max(22, minDimPx * 0.044);
  const textAlign = opts?.textAlign ?? 'center';
  ctx.save();
  ctx.font = `700 ${fontPx}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(4, minDimPx * 0.006);
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.52)';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/**
 * Repère ovale (deux horizontales) : largeur segment bas (bouche sur l’ovale) / largeur segment haut (ligne yeux).
 * — le « petit » segment bas vaut `ratio` fois le « grand » segment haut lorsque ratio &lt; 1.
 */
export function ovalGuideMouthOverUpperLineWidthRatioFromLandmarks(
  landmarks: LandmarkPoint[],
): number | null {
  const yMouth = guidelineMouthInteriorYNorm(landmarks);
  const yEyesDown = guidelineBelowEyesYNorm(landmarks);
  if (yMouth === null || yEyesDown === null) return null;

  const spanMouth = horizontalExtentsOnFaceOval(landmarks, yMouth);
  const spanEye = horizontalExtentsOnFaceOval(landmarks, yEyesDown);
  if (!spanMouth || !spanEye) return null;

  const mouthW = Math.abs(spanMouth[1] - spanMouth[0]);
  const upperW = Math.abs(spanEye[1] - spanEye[0]);
  if (!(upperW > 1e-6 && Number.isFinite(mouthW))) return null;
  const ratio = mouthW / upperW;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

function drawNoseMouthRatioLabelMapped(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  minDimPx: number,
  ratio: number,
  opts?: { textAlign?: CanvasTextAlign },
): void {
  const lang = getPreferredLanguage();
  drawAccentRatioTextMapped(
    ctx,
    cx,
    cy,
    minDimPx,
    formatRatioMultiplierText(lang, ratio),
    opts,
  );
}

export type LandmarkPxMapper = (nx: number, ny: number) => { x: number; y: number };

export function jpegLandmarkPxMapper(outW: number, outH: number): LandmarkPxMapper {
  return (nx, ny) => ({ x: nx * outW, y: ny * outH });
}

/** Landmark normalisé → pixels CSS overlay (aligné sur `videoNormToElementPx` / maillage masque). */
export function videoCoverLandmarkPxMapper(
  videoW: number,
  videoH: number,
  overlayCssW: number,
  overlayCssH: number,
): LandmarkPxMapper {
  return (nx, ny) => videoNormToElementPx(nx, ny, videoW, videoH, overlayCssW, overlayCssH);
}

/** JPEG capteur brut → même effet miroir que la préview selfie (`scaleX(-1)` sur `<video>`). */
export function mirrorLandmarksNormalizedX(landmarks: LandmarkPoint[]): LandmarkPoint[] {
  return landmarks.map((p) => ({
    ...p,
    x: 1 - p.x,
  }));
}

function intersectSegHorizontalY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number,
): number | null {
  if (Math.abs(ay - by) < 1e-9) return Math.abs(ay - y) < 1e-7 ? ax : null;
  const t = (y - ay) / (by - ay);
  if (t <= 0 || t >= 1) return null;
  return ax + t * (bx - ax);
}

/**
 * Étend les bornes gauche/droite d’une horizontale y = yn sur le polygone ovale vidéo
 * (landmarks normalisés 0..1).
 */
function horizontalExtentsOnFaceOval(landmarks: LandmarkPoint[], yNorm: number): [number, number] | null {
  const ring = FACEMESH_FACE_OVAL_ORDERED as readonly number[];
  let left = Infinity;
  let right = -Infinity;
  let any = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const ia = ring[i];
    const ib = ring[(i + 1) % n];
    if (ia === undefined || ib === undefined) continue;
    const la = landmarks[ia];
    const lb = landmarks[ib];
    if (!la || !lb || la.x === undefined || la.y === undefined || lb.x === undefined || lb.y === undefined) continue;
    const xHit = intersectSegHorizontalY(la.x, la.y, lb.x, lb.y, yNorm);
    if (xHit !== null) {
      left = Math.min(left, xHit);
      right = Math.max(right, xHit);
      any = true;
    }
  }
  return any ? [left, right] : null;
}

/** Intersection d’une verticale x = xNorm avec un segment polygonal (coords normalisées). */
function intersectSegVerticalX(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  xNorm: number,
): number | null {
  if (Math.abs(ax - bx) < 1e-9) return null;
  if ((ax - xNorm) * (bx - xNorm) > 0) return null;
  const t = (xNorm - ax) / (bx - ax);
  if (t <= 0 || t >= 1) return null;
  return ay + t * (by - ay);
}

/** Étendue verticale [y petit … y grand] de l’ovale visage où la médiatrice x = xNorm le coupe. */
function verticalExtentsOnFaceOval(landmarks: LandmarkPoint[], xNorm: number): [number, number] | null {
  const ring = FACEMESH_FACE_OVAL_ORDERED as readonly number[];
  const ys: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const ia = ring[i];
    const ib = ring[(i + 1) % n];
    if (ia === undefined || ib === undefined) continue;
    const la = landmarks[ia];
    const lb = landmarks[ib];
    if (
      !la ||
      !lb ||
      la.x === undefined ||
      la.y === undefined ||
      lb.x === undefined ||
      lb.y === undefined
    ) {
      continue;
    }
    const yHit = intersectSegVerticalX(la.x, la.y, lb.x, lb.y, xNorm);
    if (yHit !== null) ys.push(yHit);
  }
  if (ys.length < 2) return null;
  return [Math.min(...ys), Math.max(...ys)];
}

function meanContourYNorm(landmarks: LandmarkPoint[], indices: readonly number[]): number | null {
  let sum = 0;
  let count = 0;
  const seen = new Set<number>();
  for (const idx of indices) {
    if (seen.has(idx)) continue;
    seen.add(idx);
    const y = landmarks[idx]?.y;
    if (y !== undefined) {
      sum += y;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

/** Milieu vertical des deux yeux (moyenne des Y moyennes des contours œil gauche/droit). */
export function guidelineBothEyesMidYNorm(landmarks: LandmarkPoint[]): number | null {
  const yL = meanContourYNorm(landmarks, FACEMESH_LEFT_EYE_ORDERED);
  const yR = meanContourYNorm(landmarks, FACEMESH_RIGHT_EYE_ORDERED);
  if (yL === null || yR === null) return null;
  return (yL + yR) * 0.5;
}

/**
 * Niveau « sous les yeux » : bas des paupières inférieures (max y), puis léger décalage
 * vers le bas proportionnel à l’écartement des yeux (même repère que le masque).
 */
export function guidelineBelowEyesYNorm(landmarks: LandmarkPoint[]): number | null {
  const leftLower = [380, 381, 382, 385, 386, 387, 373, 374] as const;
  const rightLower = [145, 153, 154, 155, 157, 158, 159, 160] as const;
  const ysL: number[] = [];
  const ysR: number[] = [];
  for (const i of leftLower) {
    const y = landmarks[i]?.y;
    if (y !== undefined) ysL.push(y);
  }
  for (const i of rightLower) {
    const y = landmarks[i]?.y;
    if (y !== undefined) ysR.push(y);
  }
  if (!ysL.length || !ysR.length) return null;
  const yLeft = Math.max(...ysL);
  const yRight = Math.max(...ysR);
  const yLidBottom = (yLeft + yRight) * 0.5;
  const outerL = landmarks[33];
  const outerR = landmarks[263];
  if (!outerL || !outerR || outerL.x === undefined || outerR.x === undefined) return null;
  const interocular = Math.hypot(outerR.x - outerL.x, outerR.y - outerL.y);
  const stepDown = Math.max(0.0033, interocular * 0.072);
  return yLidBottom + stepDown;
}

/** Milieu vertical des lèvres (intérieur) : milieu des points centre lèvre sup. / inf. MediaPipe. */
export function guidelineMouthInteriorYNorm(landmarks: LandmarkPoint[]): number | null {
  const u = landmarks[13];
  const low = landmarks[14];
  if (!u || !low || u.y === undefined || low.y === undefined) return null;
  return (u.y + low.y) * 0.5;
}

export function jpegOutputDimensions(videoW: number, videoH: number): { outW: number; outH: number } {
  const vw = Math.max(1, videoW);
  const vh = Math.max(1, videoH);
  const longEdge = Math.max(vw, vh);
  const scale = longEdge > CAPTURE_MAX_LONG_EDGE_PX ? CAPTURE_MAX_LONG_EDGE_PX / longEdge : 1;
  return {
    outW: Math.max(1, Math.round(vw * scale)),
    outH: Math.max(1, Math.round(vh * scale)),
  };
}

/** Normalisé vidéo → pixels bitmap JPEG (réduction proportionnelle identique au pipeline capture). */
function normPointToBmpPx(nx: number, ny: number, outW: number, outH: number): { x: number; y: number } {
  return jpegLandmarkPxMapper(outW, outH)(nx, ny);
}

export type LandmarkBoundingBoxPx = { x: number; y: number; w: number; h: number };

/**
 * Bounding box (en pixels du composite final) qui englobe la concaténation des
 * anneaux MediaPipe fournis, élargie par `marginRatio` (∈ [0, 1]) appliqué de
 * façon relative à la taille de la bbox sur chaque côté, puis serrée dans
 * `[0, outW] × [0, outH]`. Retourne `null` si moins de 3 landmarks valides
 * ou si la bbox finale est dégénérée (<16 px de côté).
 *
 * Utilisé pour recadrer les PNG aplatis admin sur la zone d’intérêt (lèvres,
 * yeux, …) — calculé dans le même espace pixel que `drawAdmin*GuideOnCanvas`.
 */
export function landmarkRingsBoundingBoxPx(
  landmarks: LandmarkPoint[],
  rings: readonly (readonly number[])[],
  outW: number,
  outH: number,
  marginRatio: number,
): LandmarkBoundingBoxPx | null {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  let count = 0;
  for (const ring of rings) {
    for (const idx of ring) {
      const lm = landmarks[idx];
      if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') continue;
      const px = normPointToBmpPx(lm.x, lm.y, outW, outH);
      if (px.x < xMin) xMin = px.x;
      if (px.y < yMin) yMin = px.y;
      if (px.x > xMax) xMax = px.x;
      if (px.y > yMax) yMax = px.y;
      count++;
    }
  }
  if (count < 3 || !Number.isFinite(xMin) || !Number.isFinite(xMax)) return null;
  const bboxW = xMax - xMin;
  const bboxH = yMax - yMin;
  if (bboxW <= 0 || bboxH <= 0) return null;
  const m = Math.max(0, marginRatio);
  const mx = bboxW * m;
  const my = bboxH * m;
  const x0 = Math.max(0, Math.floor(xMin - mx));
  const y0 = Math.max(0, Math.floor(yMin - my));
  const x1 = Math.min(outW, Math.ceil(xMax + mx));
  const y1 = Math.min(outH, Math.ceil(yMax + my));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 16 || h < 16) return null;
  return { x: x0, y: y0, w, h };
}

/** Bbox des lèvres (anneau extérieur MediaPipe) + marge relative. */
export function landmarkLipsOuterBoundingBoxPx(
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
  marginRatio: number,
): LandmarkBoundingBoxPx | null {
  return landmarkRingsBoundingBoxPx(
    landmarks,
    [FACEMESH_LIP_OUTER_ORDERED],
    outW,
    outH,
    marginRatio,
  );
}

/** Bbox englobant les deux yeux (anneaux paupières gauche + droit) + marge relative. */
export function landmarkBothEyesBoundingBoxPx(
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
  marginRatio: number,
): LandmarkBoundingBoxPx | null {
  return landmarkRingsBoundingBoxPx(
    landmarks,
    [FACEMESH_LEFT_EYE_ORDERED, FACEMESH_RIGHT_EYE_ORDERED],
    outW,
    outH,
    marginRatio,
  );
}

/** Bbox du contour ovale visage (`FACEMESH_FACE_OVAL_ORDERED`) + marge relative — recadrage centré sur le visage. */
export function landmarkFaceOvalBoundingBoxPx(
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
  marginRatio: number,
): LandmarkBoundingBoxPx | null {
  return landmarkRingsBoundingBoxPx(
    landmarks,
    [FACEMESH_FACE_OVAL_ORDERED],
    outW,
    outH,
    marginRatio,
  );
}

export function posesWithColoredGuideLinesOnly(poseId: PoseId): boolean {
  return (
    poseId === 'frontal' ||
    poseId === 'profile-left' ||
    poseId === 'profile-right' ||
    poseId === 'jaw-up'
  );
}

function drawEndpointsAccent(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  ctx.save();
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  const r = 4.25;
  for (const [x, y] of [
    [x0, y0],
    [x1, y1],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOrientationGuidelinesMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const yMouth = guidelineMouthInteriorYNorm(landmarks);
  const yEyesDown = guidelineBelowEyesYNorm(landmarks);
  if (yMouth === null || yEyesDown === null) return;

  const spanMouth = horizontalExtentsOnFaceOval(landmarks, yMouth);
  const spanEye = horizontalExtentsOnFaceOval(landmarks, yEyesDown);
  if (!spanMouth || !spanEye) return;

  const mouthL = toPx(spanMouth[0], yMouth);
  const mouthR = toPx(spanMouth[1], yMouth);
  const eyeL = toPx(spanEye[0], yEyesDown);
  const eyeR = toPx(spanEye[1], yEyesDown);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = Math.max(2, minDimPx * 0.0035);
  ctx.beginPath();
  ctx.moveTo(eyeL.x, eyeL.y);
  ctx.lineTo(eyeR.x, eyeR.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouthL.x, mouthL.y);
  ctx.lineTo(mouthR.x, mouthR.y);
  ctx.stroke();
  ctx.restore();

  drawEndpointsAccent(ctx, eyeL.x, eyeL.y, eyeR.x, eyeR.y);
  drawEndpointsAccent(ctx, mouthL.x, mouthL.y, mouthR.x, mouthR.y);

  const ovRatio = ovalGuideMouthOverUpperLineWidthRatioFromLandmarks(landmarks);
  if (ovRatio !== null) {
    const lang = getPreferredLanguage();
    const cx = (eyeL.x + eyeR.x + mouthL.x + mouthR.x) * 0.25;
    const cy = (eyeL.y + mouthL.y) * 0.5;
    drawAccentRatioTextMapped(ctx, cx, cy, minDimPx, formatRatioMultiplierText(lang, ovRatio));
  }
}

function drawNoseMouthWidthMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const nL = landmarks[98];
  const nR = landmarks[327];
  const mL = landmarks[61];
  const mR = landmarks[291];
  if (
    !nL ||
    !nR ||
    !mL ||
    !mR ||
    nL.x === undefined ||
    nR.x === undefined ||
    nL.y === undefined ||
    nR.y === undefined ||
    mL.x === undefined ||
    mR.x === undefined ||
    mL.y === undefined ||
    mR.y === undefined
  ) {
    return;
  }

  const yNose = (nL.y + nR.y) * 0.5;
  const yMouth = (mL.y + mR.y) * 0.5;
  const noseA = toPx(nL.x, yNose);
  const noseB = toPx(nR.x, yNose);
  const mouthA = toPx(mL.x, yMouth);
  const mouthB = toPx(mR.x, yMouth);

  const lineW = Math.max(2, minDimPx * 0.0035);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(noseA.x, noseA.y);
  ctx.lineTo(noseB.x, noseB.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouthA.x, mouthA.y);
  ctx.lineTo(mouthB.x, mouthB.y);
  ctx.stroke();
  ctx.restore();

  drawEndpointsAccent(ctx, noseA.x, noseA.y, noseB.x, noseB.y);
  drawEndpointsAccent(ctx, mouthA.x, mouthA.y, mouthB.x, mouthB.y);

  const ratio = mouthToNoseWidthRatioFromLandmarks(landmarks);
  if (ratio !== null) {
    const rightX = Math.max(noseA.x, noseB.x, mouthA.x, mouthB.x);
    const labelPad = Math.max(12, minDimPx * 0.026);
    const cx = rightX + labelPad;
    const cy = (noseA.y + mouthA.y) * 0.5;
    drawNoseMouthRatioLabelMapped(ctx, cx, cy, minDimPx, ratio, { textAlign: 'left' });
  }
}

/** Libellé « Yeux » / « Bouche » à côté des petits traits horizontaux du tiers vertical. */
function drawVerticalThirdsTickLabelsMapped(
  ctx: CanvasRenderingContext2D,
  side: 'left' | 'right',
  minDimPx: number,
  tickHalf: number,
  tickCenterPx: { x: number; y: number },
  title: string,
): void {
  const safeTitle = title.trim();
  if (!safeTitle) return;

  const pad = Math.max(8, minDimPx * 0.014);
  ctx.textBaseline = 'middle';
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  const anchorX =
    side === 'right'
      ? tickCenterPx.x + tickHalf + pad
      : tickCenterPx.x - tickHalf - pad;

  const fontTitle = Math.max(13, minDimPx * 0.029);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, minDimPx * 0.0045);
  ctx.font = `600 ${fontTitle}px system-ui, "Segoe UI", sans-serif`;
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.52)';
  ctx.strokeText(safeTitle, anchorX, tickCenterPx.y);
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  ctx.fillText(safeTitle, anchorX, tickCenterPx.y);
  ctx.restore();
}

function drawVerticalThirdsMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const outerL = landmarks[33];
  const outerR = landmarks[263];
  if (
    !outerL ||
    !outerR ||
    outerL.x === undefined ||
    outerR.x === undefined ||
    outerL.y === undefined ||
    outerR.y === undefined
  ) {
    return;
  }

  const xMidN = (outerL.x + outerR.x) * 0.5;
  const spanY = verticalExtentsOnFaceOval(landmarks, xMidN);
  if (!spanY) return;
  const [yTopN, yBotN] = spanY;
  if (yBotN - yTopN < 1e-4) return;

  const yEyes = guidelineBothEyesMidYNorm(landmarks);
  const yMouthMid = guidelineMouthInteriorYNorm(landmarks);
  if (yEyes === null || yMouthMid === null) return;

  const eps = Math.max(1e-5, (yBotN - yTopN) * 0.01);
  const clampY = (y: number) => Math.min(yBotN - eps, Math.max(yTopN + eps, y));

  const ye = clampY(yEyes);
  const ym = clampY(yMouthMid);

  const yLow = Math.min(ye, ym);
  const yHigh = Math.max(ye, ym);

  const minSep = (yBotN - yTopN) * 0.028;
  if (yLow - yTopN < minSep || yBotN - yHigh < minSep || yHigh - yLow < minSep) {
    return;
  }

  const lineW = Math.max(2, minDimPx * 0.0035);
  const tickHalf = Math.max(5, minDimPx * 0.014);

  function strokeVertical(y0n: number, y1n: number) {
    const a = toPx(xMidN, y0n);
    const b = toPx(xMidN, y1n);
    ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lineW;

  strokeVertical(yTopN, yLow);
  strokeVertical(yLow, yHigh);
  strokeVertical(yHigh, yBotN);

  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  for (const yn of [ye, ym]) {
    const p = toPx(xMidN, yn);
    ctx.beginPath();
    ctx.moveTo(p.x - tickHalf, p.y);
    ctx.lineTo(p.x + tickHalf, p.y);
    ctx.stroke();
  }

  ctx.restore();

  const lang = getPreferredLanguage();
  const eyesTitle = lang === 'fr' ? 'Yeux' : 'Eyes';
  const mouthTitle = lang === 'fr' ? 'Bouche' : 'Mouth';

  const canvasRight = toPx(1, 0.5).x;
  const midSpinePx = toPx(xMidN, (yTopN + yBotN) * 0.5);
  const labelsOnTickRightSide = midSpinePx.x < canvasRight * 0.5;

  drawVerticalThirdsTickLabelsMapped(
    ctx,
    labelsOnTickRightSide ? 'right' : 'left',
    minDimPx,
    tickHalf,
    toPx(xMidN, ye),
    eyesTitle,
  );
  drawVerticalThirdsTickLabelsMapped(
    ctx,
    labelsOnTickRightSide ? 'right' : 'left',
    minDimPx,
    tickHalf,
    toPx(xMidN, ym),
    mouthTitle,
  );
}

const MASK_OVERLAY_WHITE_STROKE_RGBA = 'rgba(255, 255, 255, 0.94)';

/**
 * Calque blanc 2D (ovale traits + grille verticale / deux horizontales). Conservé pour
 * éventuels outils ou overlays manuels — l’encodage aplati `GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY`
 * utilise désormais le même maillage WebGL que la capture live (`MaskRenderer`).
 */
function drawMaskOverlayWhiteGuidesMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const outerL = landmarks[33];
  const outerR = landmarks[263];
  if (
    !outerL ||
    !outerR ||
    outerL.x === undefined ||
    outerR.x === undefined ||
    outerL.y === undefined ||
    outerR.y === undefined
  ) {
    return;
  }

  const xMidN = (outerL.x + outerR.x) * 0.5;
  const spanY = verticalExtentsOnFaceOval(landmarks, xMidN);
  if (!spanY) return;
  const [yTopN, yBotN] = spanY;
  if (yBotN - yTopN < 1e-4) return;

  const yEyes = guidelineBothEyesMidYNorm(landmarks);
  const yMouthMid = guidelineMouthInteriorYNorm(landmarks);
  if (yEyes === null || yMouthMid === null) return;

  const eps = Math.max(1e-5, (yBotN - yTopN) * 0.01);
  const clampY = (y: number) => Math.min(yBotN - eps, Math.max(yTopN + eps, y));

  const ye = clampY(yEyes);
  const ym = clampY(yMouthMid);

  const yLow = Math.min(ye, ym);
  const yHigh = Math.max(ye, ym);

  const minSep = (yBotN - yTopN) * 0.028;
  if (yLow - yTopN < minSep || yBotN - yHigh < minSep || yHigh - yLow < minSep) {
    return;
  }

  const lineWOval = Math.max(2.75, minDimPx * 0.004);
  const lineWGrid = Math.max(2, minDimPx * 0.0035);

  function strokeVerticalSegment(y0n: number, y1n: number) {
    const a = toPx(xMidN, y0n);
    const b = toPx(xMidN, y1n);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = MASK_OVERLAY_WHITE_STROKE_RGBA;

  // 1) Contour ovale visage (fermé)
  const chain = ringVerticesUnique(FACEMESH_FACE_OVAL_ORDERED as readonly number[]);
  const ovalPts: { x: number; y: number }[] = [];
  for (const idx of chain) {
    const lm = landmarks[idx];
    if (!lm || lm.x === undefined || lm.y === undefined) {
      ctx.restore();
      return;
    }
    ovalPts.push(toPx(lm.x, lm.y));
  }
  if (ovalPts.length >= 3) {
    ctx.lineWidth = lineWOval;
    ctx.beginPath();
    ctx.moveTo(ovalPts[0]!.x, ovalPts[0]!.y);
    for (let i = 1; i < ovalPts.length; i++) {
      ctx.lineTo(ovalPts[i]!.x, ovalPts[i]!.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 2) Même axe médian que les tiers verticaux : trois segments colinéaires (sans ticks ni libellés).
  ctx.lineWidth = lineWGrid;
  strokeVerticalSegment(yTopN, yLow);
  strokeVerticalSegment(yLow, yHigh);
  strokeVerticalSegment(yHigh, yBotN);

  // 3) Horizontales pleines aux niveaux yeux / bouche (remplacent les petits traits d’intersection).
  for (const yn of [ye, ym]) {
    const span = horizontalExtentsOnFaceOval(landmarks, yn);
    if (!span) continue;
    const left = toPx(span[0], yn);
    const right = toPx(span[1], yn);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawAdminFrontalMaskOverlayGuidesOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;
  const minDim = Math.min(outW, outH);
  drawMaskOverlayWhiteGuidesMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/**
 * Indices latéraux bas de mâchoire (ovale Mesh) utilisés aussi en profil.
 * En face pure, ils peuvent parfois tomber peu visibles ou produire une géométrie dégradée —
 * dans ce cas on retombe sur {@link FACEMESH_JAW_FALLBACK_FACE_LEFT} / RIGHT.
 */
const PRIMARY_JAW_L_R: readonly [number, number] = [
  FACEMESH_FRONTAL_JAW_LEFT_LATERAL,
  FACEMESH_FRONTAL_JAW_RIGHT_LATERAL,
];
/** Fallback : points ovale gauche/droite (alignés sur `FACEMESH_FACE_OVAL_ORDERED`), souvent plus stables « face ». */
const FACEMESH_JAW_FALLBACK_FACE_LEFT = 234;
const FACEMESH_JAW_FALLBACK_FACE_RIGHT = 454;

const JAW_VISIBILITY_MIN = 0.08;

/** Décal vertical du sommet du V sous le menton ; fraction de (menton − milieu yeux). */
const FRONTAL_JAW_APEX_Y_FRAC_FACE_H = 0.38;

function tryFrontalJawAngleGeomWithLateralIndices(
  landmarks: LandmarkPoint[],
  jawLi: number,
  jawRi: number,
): {
  angleDeg: number;
  jawL: { x: number; y: number };
  jawR: { x: number; y: number };
  apex: { x: number; y: number };
} | null {
  const jawLM = landmarks[jawLi];
  const jawRM = landmarks[jawRi];
  const chin = landmarks[FACEMESH_CHIN_CENTER];
  const outerL = landmarks[33];
  const outerR = landmarks[263];
  if (
    !jawLM ||
    !jawRM ||
    !chin ||
    !outerL ||
    !outerR ||
    jawLM.x === undefined ||
    jawLM.y === undefined ||
    jawRM.x === undefined ||
    jawRM.y === undefined ||
    chin.x === undefined ||
    chin.y === undefined ||
    outerL.y === undefined ||
    outerR.y === undefined
  ) {
    return null;
  }
  const visJL = jawLM.visibility ?? 1;
  const visJR = jawRM.visibility ?? 1;
  const visChin = chin.visibility ?? 1;
  if (visJL < JAW_VISIBILITY_MIN || visJR < JAW_VISIBILITY_MIN || visChin < JAW_VISIBILITY_MIN) {
    return null;
  }

  const eyeMidY = (outerL.y + outerR.y) * 0.5;
  const faceRefH = Math.max(0.03, chin.y - eyeMidY);
  const apex = {
    x: chin.x,
    y: chin.y + faceRefH * FRONTAL_JAW_APEX_Y_FRAC_FACE_H,
  };

  const vLx = jawLM.x - apex.x;
  const vLy = jawLM.y - apex.y;
  const vRx = jawRM.x - apex.x;
  const vRy = jawRM.y - apex.y;
  const lenL = Math.hypot(vLx, vLy);
  const lenR = Math.hypot(vRx, vRy);
  if (lenL < 1e-5 || lenR < 1e-5) return null;
  const c = (vLx * vRx + vLy * vRy) / (lenL * lenR);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, c)));
  const angleDeg = (angleRad * 180) / Math.PI;
  if (!Number.isFinite(angleDeg)) return null;

  /** Rejette seulement le dégénéré quasi nul (> ~179.9° côté autre coupe). */
  if (angleDeg < 2 || angleDeg > 178) return null;

  return {
    angleDeg,
    jawL: { x: jawLM.x, y: jawLM.y },
    jawR: { x: jawRM.x, y: jawRM.y },
    apex,
  };
}

/** Géométrie normalisée : latéraux ovale MediaPipe avec repli indices joues. */
function frontalJawAngleNormGeometry(landmarks: LandmarkPoint[]): {
  angleDeg: number;
  jawL: { x: number; y: number };
  jawR: { x: number; y: number };
  apex: { x: number; y: number };
} | null {
  const pairs: readonly [number, number][] = [
    [PRIMARY_JAW_L_R[0], PRIMARY_JAW_L_R[1]],
    [FACEMESH_JAW_FALLBACK_FACE_LEFT, FACEMESH_JAW_FALLBACK_FACE_RIGHT],
  ];
  for (const [jl, jr] of pairs) {
    const g = tryFrontalJawAngleGeomWithLateralIndices(landmarks, jl, jr);
    if (g) return g;
  }
  return null;
}

export type FrontalJawAngleMetrics = {
  /** Angle au sommet (sous le menton), entre sommet → latéraux mâchoire, en degrés. */
  angleDeg: number;
};

export function frontalJawAngleMetricsFromLandmarks(
  landmarks: LandmarkPoint[],
): FrontalJawAngleMetrics | null {
  const g = frontalJawAngleNormGeometry(landmarks);
  if (!g) return null;
  return { angleDeg: g.angleDeg };
}

function drawFrontalJawAngleMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  /** Même contour bas d’ovale que la pose « menton levé » (visage vers le haut). */
  drawJawUpLowerArcMapped(ctx, landmarks, toPx, minDimPx);

  const geo = frontalJawAngleNormGeometry(landmarks);
  if (!geo) return;

  const PL = toPx(geo.jawL.x, geo.jawL.y);
  const PR = toPx(geo.jawR.x, geo.jawR.y);
  const V = toPx(geo.apex.x, geo.apex.y);

  const lineW = Math.max(2, minDimPx * 0.0035);
  const uLx = PL.x - V.x;
  const uLy = PL.y - V.y;
  const uRx = PR.x - V.x;
  const uRy = PR.y - V.y;
  const lenL = Math.hypot(uLx, uLy);
  const lenR = Math.hypot(uRx, uRy);
  if (lenL < 1e-3 || lenR < 1e-3) return;

  const aL = Math.atan2(uLy, uLx);
  const aR = Math.atan2(uRy, uRx);
  const rArc = Math.min(lenL, lenR) * 0.15;
  const rArcClamped = Math.max(minDimPx * 0.014, Math.min(rArc, minDimPx * 0.11));

  let delta = aR - aL;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  const anticlockwise = delta < 0;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(PL.x, PL.y);
  ctx.lineTo(V.x, V.y);
  ctx.lineTo(PR.x, PR.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(V.x, V.y, rArcClamped, aL, aR, anticlockwise);
  ctx.stroke();
  ctx.restore();

  drawEndpointsAccent(ctx, PL.x, PL.y, V.x, V.y);
  drawEndpointsAccent(ctx, PR.x, PR.y, V.x, V.y);

  const label = `${Math.round(geo.angleDeg)}°`;
  const fontPx = Math.max(13, minDimPx * 0.038);
  const labelY = V.y + rArcClamped + fontPx * 0.85;
  ctx.save();
  ctx.font = `700 ${fontPx}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, minDimPx * 0.007);
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.55)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(label, V.x, labelY);
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  ctx.fillText(label, V.x, labelY);
  ctx.restore();
}

function drawProfileJawMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
  poseId: PoseId,
): void {
  if (poseId !== 'profile-left' && poseId !== 'profile-right') return;

  const chain =
    poseId === 'profile-right'
      ? FACEMESH_JAW_RIGHT_HEMISPHERE_TO_CHIN_ORDERED
      : FACEMESH_JAW_LEFT_HEMISPHERE_TO_CHIN_ORDERED;

  const pts: { x: number; y: number }[] = [];
  for (const idx of chain) {
    const lm = landmarks[idx];
    if (!lm || lm.x === undefined || lm.y === undefined) {
      return;
    }
    pts.push(toPx(lm.x, lm.y));
  }
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = Math.max(2.75, minDimPx * 0.004);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
  ctx.restore();

  const endpointR = Math.max(2.5, minDimPx * 0.004);
  const startPt = pts[0]!;
  const endPt = pts[pts.length - 1]!;
  ctx.save();
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  for (const p of [startPt, endPt]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, endpointR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProfileNoseMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
  poseId: PoseId,
): void {
  if (poseId !== 'profile-left' && poseId !== 'profile-right') return;

  const chain =
    poseId === 'profile-right'
      ? FACEMESH_PROFILE_LEFT_VISIBLE_NOSE_ORDERED
      : FACEMESH_PROFILE_RIGHT_VISIBLE_NOSE_ORDERED;

  const pts: { x: number; y: number }[] = [];
  for (const idx of chain) {
    const lm = landmarks[idx];
    if (!lm || lm.x === undefined || lm.y === undefined) {
      return;
    }
    pts.push(toPx(lm.x, lm.y));
  }
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = Math.max(2.75, minDimPx * 0.004);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
  ctx.restore();

  const endpointR = Math.max(2.5, minDimPx * 0.004);
  const startPt = pts[0]!;
  const endPt = pts[pts.length - 1]!;
  ctx.save();
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  for (const p of [startPt, endPt]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, endpointR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawJawUpLowerArcMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const chain = FACEMESH_FACE_OVAL_JAW_LOWER_ARC_ORDERED;
  const pts: { x: number; y: number }[] = [];
  for (const idx of chain) {
    const lm = landmarks[idx];
    if (!lm || lm.x === undefined || lm.y === undefined) {
      return;
    }
    pts.push(toPx(lm.x, lm.y));
  }
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = Math.max(2.75, minDimPx * 0.004);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
  ctx.restore();

  const endpointR = Math.max(2.5, minDimPx * 0.004);
  const startPt = pts[0]!;
  const endPt = pts[pts.length - 1]!;
  ctx.save();
  ctx.fillStyle = CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA;
  for (const p of [startPt, endPt]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, endpointR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFaceShapeContourMapped(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  toPx: LandmarkPxMapper,
  minDimPx: number,
): void {
  const chain = ringVerticesUnique(FACEMESH_FACE_OVAL_ORDERED as readonly number[]);
  const pts: { x: number; y: number }[] = [];
  for (const idx of chain) {
    const lm = landmarks[idx];
    if (!lm || lm.x === undefined || lm.y === undefined) {
      return;
    }
    pts.push(toPx(lm.x, lm.y));
  }
  if (pts.length < 3) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  ctx.lineWidth = Math.max(2.75, minDimPx * 0.004);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Repères 2D en direct sur l’overlay (coords CSS après `scaleX(-1)` sur la pile vidéo,
 * même base que MaskRenderer.previewCover).
 */
export function drawLiveColoredPoseGuidesOnOverlayCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  videoW: number,
  videoH: number,
  overlayCssW: number,
  overlayCssH: number,
  poseId: PoseId,
): void {
  if (
    landmarks.length < 400 ||
    overlayCssW < 16 ||
    overlayCssH < 16 ||
    !posesWithColoredGuideLinesOnly(poseId)
  ) {
    return;
  }
  const mapper = videoCoverLandmarkPxMapper(videoW, videoH, overlayCssW, overlayCssH);
  const minDim = Math.min(overlayCssW, overlayCssH);
  if (poseId === 'frontal') {
    drawOrientationGuidelinesMapped(ctx, landmarks, mapper, minDim);
    drawNoseMouthWidthMapped(ctx, landmarks, mapper, minDim);
    drawVerticalThirdsMapped(ctx, landmarks, mapper, minDim);
    drawFrontalJawAngleMapped(ctx, landmarks, mapper, minDim);
    drawFaceShapeContourMapped(ctx, landmarks, mapper, minDim);
  } else if (poseId === 'profile-left' || poseId === 'profile-right') {
    drawProfileJawMapped(ctx, landmarks, mapper, minDim, poseId);
    drawProfileNoseMapped(ctx, landmarks, mapper, minDim, poseId);
  } else if (poseId === 'jaw-up') {
    drawJawUpLowerArcMapped(ctx, landmarks, mapper, minDim);
  }
}

/**
 * Segments horizontaux parallèles : largeur narinaire (98↔327) et largeur commissures (61↔291).
 */
export function drawAdminNoseMouthWidthGuidelinesOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  const minDim = Math.min(outW, outH);
  drawNoseMouthWidthMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/**
 * Verticale x = centre interpupillaire, limitée au polygone ovale ; trois segments reliés avec
 * petites barres horizontales au milieu des yeux ({@link guidelineBothEyesMidYNorm}) et au milieu
 * des lèvres ({@link guidelineMouthInteriorYNorm}), même axe x (ligne droite).
 */
export function drawAdminVerticalThirdsGuidelinesOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  const minDim = Math.min(outW, outH);
  drawVerticalThirdsMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/**
 * Face de face : arc mandibulaire bas (ovale MediaPipe, comme jaw-up), puis angle mâchoire
 * (V sous le menton), arc d’angle et libellé en degrés (bleu clair).
 */
export function drawAdminFrontalJawAngleGuidelinesOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  const minDim = Math.min(outW, outH);
  drawFrontalJawAngleMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

export function drawAdminFaceShapeContourGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;
  const minDim = Math.min(outW, outH);
  drawFaceShapeContourMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/**
 * Dessine les deux segments du repère diagnostic sur une image déjà projetée aux dimensions `outW`×`outH`.
 */
export function drawAdminOrientationGuidelinesOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  const minDim = Math.min(outW, outH);
  drawOrientationGuidelinesMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/** PNG aplatis profil uniquement : arc mâchoire visible (joue → menton), comme les autres repères 2D admin. */
export function drawAdminProfileJawGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
  poseId: PoseId,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;
  const minDim = Math.min(outW, outH);
  drawProfileJawMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim, poseId);
}

/** PNG aplati profil : silhouette visible du nez (dorsum + aile narinaire correspondante au sens caméra). */
export function drawAdminProfileNoseGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
  poseId: PoseId,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;
  const minDim = Math.min(outW, outH);
  drawProfileNoseMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim, poseId);
}

/**
 * PNG aplati pose « menton levé » : arc mandibulaire bas complet (ovale MediaPipe),
 * trait continu ; pastilles uniquement aux extrémités.
 */
export function drawAdminJawUpLowerArcGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;
  const minDim = Math.min(outW, outH);
  drawJawUpLowerArcMapped(ctx, landmarks, jpegLandmarkPxMapper(outW, outH), minDim);
}

/** Retire le dernier indice s’il duplique le premier (boucle fermée MediaPipe). */
function ringVerticesUnique(indices: readonly number[]): readonly number[] {
  if (indices.length >= 2 && indices[0] === indices[indices.length - 1]) {
    return indices.slice(0, -1);
  }
  return indices;
}

/**
 * PNG aplati pose sourire (et variante face « lèvres au repos ») : composite à
 * **deux passes d’assombrissement** sur la photo, sans aucun trait ni
 * remplissage bleu — les lèvres conservent leur teinte naturelle, encadrées
 * par deux zones sombres qui les font ressortir.
 *
 *   1. voile noir **100 %** posé partout SAUF à l’intérieur du contour extérieur
 *      des lèvres (= l’extérieur du visage est assombri ; le ring lèvres + la
 *      bouche restent à pleine luminosité après cette passe) ;
 *   2. voile noir **100 %** posé uniquement à l’intérieur du contour intérieur
 *      des lèvres (= dents / intérieur de la bouche assombris davantage).
 *
 * Au final :
 *   • extérieur visage  →  100 % sombre
 *   • ring lèvres       →  0 %  (teinte d’origine, pas de bleu)
 *   • intérieur bouche  →  100 % sombre
 *
 * Dégradation : si `outerPoly` (contour extérieur des lèvres) manque, on ne
 * rend rien — un voile uniforme n’apporterait aucune info utile.
 */
const SMILE_LIPS_OUTER_DARKEN_RGBA = 'rgba(0, 0, 0, 1)';
const SMILE_LIPS_MOUTH_DARKEN_RGBA = 'rgba(0, 0, 0, 1)';

export function drawAdminSmileLipsGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;

  /** Convertit un anneau MediaPipe en polygone canvas (null si un point manque). */
  const ringPolygon = (
    indicesIn: readonly number[],
  ): { x: number; y: number }[] | null => {
    const indices = ringVerticesUnique(indicesIn);
    const pts: { x: number; y: number }[] = [];
    for (const idx of indices) {
      const lm = landmarks[idx];
      if (!lm || lm.x === undefined || lm.y === undefined) return null;
      pts.push(normPointToBmpPx(lm.x, lm.y, outW, outH));
    }
    return pts.length >= 3 ? pts : null;
  };

  const tracePolygon = (poly: { x: number; y: number }[]) => {
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i]!.x, poly[i]!.y);
    }
    ctx.closePath();
  };

  const outerPoly = ringPolygon(FACEMESH_LIP_OUTER_ORDERED);
  const innerPoly = ringPolygon(FACEMESH_LIP_INNER_ORDERED);

  if (!outerPoly) return;

  ctx.save();

  /**
   * 1) Passe « extérieur » noir opaque : rect + outerPoly en `evenodd` → seul
   *    l’extérieur du contour des lèvres est assombri (la bouche et le ring
   *    lèvres restent à pleine luminosité après cette passe).
   */
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  tracePolygon(outerPoly);
  ctx.fillStyle = SMILE_LIPS_OUTER_DARKEN_RGBA;
  ctx.fill('evenodd');

  /**
   * 2) Passe « intérieur bouche » noir opaque : innerPoly seul → seul l’intérieur des
   *    lèvres (dents) est assombri en plus. Le ring lèvres (entre outer et
   *    inner) reste vierge → 0 % sombre, donc teinte d’origine.
   */
  if (innerPoly) {
    ctx.beginPath();
    tracePolygon(innerPoly);
    ctx.fillStyle = SMILE_LIPS_MOUTH_DARKEN_RGBA;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Variante « dents » du repère sourire : voile noir opaque posé sur tout le cliché
 * SAUF l’intérieur de la bouche (anneau intérieur des lèvres). On ne dessine ni
 * remplissage ni contour des lèvres — seule la zone des dents conserve sa teinte
 * naturelle. Si `FACEMESH_LIP_INNER_ORDERED` est indisponible, on n’affiche rien
 * (préférable à un voile plein qui n’apporterait aucune info).
 */
export function drawAdminSmileTeethGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;

  /** Convertit un anneau MediaPipe en polygone canvas (null si un point manque). */
  const ringPolygon = (
    indicesIn: readonly number[],
  ): { x: number; y: number }[] | null => {
    const indices = ringVerticesUnique(indicesIn);
    const pts: { x: number; y: number }[] = [];
    for (const idx of indices) {
      const lm = landmarks[idx];
      if (!lm || lm.x === undefined || lm.y === undefined) return null;
      pts.push(normPointToBmpPx(lm.x, lm.y, outW, outH));
    }
    return pts.length >= 3 ? pts : null;
  };

  const tracePolygon = (poly: { x: number; y: number }[]) => {
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i]!.x, poly[i]!.y);
    }
    ctx.closePath();
  };

  const innerPoly = ringPolygon(FACEMESH_LIP_INNER_ORDERED);
  if (!innerPoly) return;

  ctx.save();
  /**
   * Voile sombre partout SAUF l’intérieur de la bouche :
   *   • extérieur (peau, lèvres, environnement) → rect seul → impair → assombri
   *   • intérieur bouche / dents → rect + inner = pair → conservé (teinte native)
   */
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  tracePolygon(innerPoly);
  // Variante « dents » : même voile noir opaque que la passe extérieure de SMILE_LIPS.
  ctx.fillStyle = SMILE_LIPS_OUTER_DARKEN_RGBA;
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * Voile noir opaque posé hors des yeux : contraste maximal autour ;
 * aucun trait dessiné par-dessus.
 */
const EYE_CLOSEUP_BG_DARKEN_RGBA = 'rgba(0, 0, 0, 1)';

/**
 * PNG aplati gros plan œil : **plus aucun trait dessiné**. Un voile noir
 * opaque est posé sur tout le reste de l’image (technique `evenodd` identique à
 * `drawAdminSmileLipsGuideOnCanvas`) — l’intérieur des deux anneaux d’œil
 * reste à 100 % d’intensité, et le seul contraste sombre/clair fait ressortir
 * fortement l’œil.
 *
 * Dégradation : si **les deux** anneaux manquent, on n’assombrit rien (pas
 * d’overlay partiel qui couvrirait un œil). Si un seul anneau est dispo, on
 * applique quand même la découpe sur celui-là — mieux que rien.
 */
export function drawAdminCloseupEyeContoursGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;

  const ringPolygon = (
    indicesIn: readonly number[],
  ): { x: number; y: number }[] | null => {
    const indices = ringVerticesUnique(indicesIn);
    const pts: { x: number; y: number }[] = [];
    for (const idx of indices) {
      const lm = landmarks[idx];
      if (!lm || lm.x === undefined || lm.y === undefined) return null;
      pts.push(normPointToBmpPx(lm.x, lm.y, outW, outH));
    }
    return pts.length >= 3 ? pts : null;
  };

  const tracePolygon = (poly: { x: number; y: number }[]) => {
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i]!.x, poly[i]!.y);
    }
    ctx.closePath();
  };

  const rightEye = ringPolygon(FACEMESH_RIGHT_EYE_ORDERED);
  const leftEye = ringPolygon(FACEMESH_LEFT_EYE_ORDERED);

  if (!rightEye && !leftEye) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  if (rightEye) tracePolygon(rightEye);
  if (leftEye) tracePolygon(leftEye);
  ctx.fillStyle = EYE_CLOSEUP_BG_DARKEN_RGBA;
  ctx.fill('evenodd');
  ctx.restore();
}
