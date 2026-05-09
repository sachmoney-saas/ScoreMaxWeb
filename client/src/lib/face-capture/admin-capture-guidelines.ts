// ============================================================
// Guides debug admin — calques mesurés sur JPEG + landmarks figés au déclenchement :
// 1) lignes sous yeux et milieu des lèvres → intersections ovale MediaPipe ;
// 2) largeur nez (98↔327) et largeur bouche (61↔291), parallèles ;
// 3) médiatrice-type : verticale x = milieu interpupillaire → ovale ; tiercements au milieu
//    des deux yeux (moyenne Y des anneaux paupière) et milieu des lèvres (13/14).
// ============================================================

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
  FACEMESH_JAW_LEFT_HEMISPHERE_TO_CHIN_ORDERED,
  FACEMESH_JAW_RIGHT_HEMISPHERE_TO_CHIN_ORDERED,
} from './facemesh-profile-jaw';
import { videoNormToElementPx } from './MaskRenderer';

/** Accent SaaS (~ Tailwind sky-300) pour tous les tracés de mesure capture. */
export const CAPTURE_GUIDE_ACCENT_STROKE_RGBA = 'rgba(125, 211, 252, 0.94)';
export const CAPTURE_GUIDE_ACCENT_ENDPOINT_RGBA = 'rgba(186, 230, 253, 0.95)';

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
  } else if (poseId === 'profile-left' || poseId === 'profile-right') {
    drawProfileJawMapped(ctx, landmarks, mapper, minDim, poseId);
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
 * PNG aplati pose sourire : lèvre ext. + int. (contours MediaPipe), bleu clair.
 */
export function drawAdminSmileLipsGuideOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
): void {
  if (landmarks.length < 400 || outW < 16 || outH < 16) return;

  const stroke = CAPTURE_GUIDE_ACCENT_STROKE_RGBA;
  const lineW = Math.max(2, Math.min(outW, outH) * 0.0032);

  const drawRing = (indicesIn: readonly number[]) => {
    const indices = ringVerticesUnique(indicesIn);
    const pts: { x: number; y: number }[] = [];
    for (const idx of indices) {
      const lm = landmarks[idx];
      if (!lm || lm.x === undefined || lm.y === undefined) {
        return;
      }
      pts.push(normPointToBmpPx(lm.x, lm.y, outW, outH));
    }
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.closePath();
    ctx.stroke();
  };

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawRing(FACEMESH_LIP_OUTER_ORDERED);
  drawRing(FACEMESH_LIP_INNER_ORDERED);
  ctx.restore();
}
