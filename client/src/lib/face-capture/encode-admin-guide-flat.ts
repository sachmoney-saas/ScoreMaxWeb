// ============================================================
// PNG aplatis (sans perte) : cliché analyse + même maillage debug +
// repères 2D — hors pipeline d’analyse (`.blob` reste le JPEG brut).
// Affichage aplati : photo retournée horizontalement comme la préview selfie,
// avec repères `x' = 1 - x` pour rester alignés.
// Résolution = celle du bitmap source (ratio pixel 1, pas de sur-échantillonnage).
// ============================================================
//
// Pose de face : 3 PNG (ovale + nez/bouche + tiers verticaux).
// Pose profil : 1 PNG (masque complet + arc mâchoire bleu 2D sur le JPEG).
// Pose menton levé : 1 PNG (masque complet + arc mandibulaire bas sur le JPEG).
// Pose sommet du crâne : 1 PNG (photo miroir seule, sans masque ni repères).
// Pose sourire : 1 PNG (masque + contours lèvres bleu clair).
// Poses œil / front (hairline) : pas de PNG aplati admin.

import {
  drawAdminJawUpLowerArcGuideOnCanvas,
  drawAdminNoseMouthWidthGuidelinesOnCanvas,
  drawAdminOrientationGuidelinesOnCanvas,
  drawAdminProfileJawGuideOnCanvas,
  drawAdminSmileLipsGuideOnCanvas,
  drawAdminVerticalThirdsGuidelinesOnCanvas,
  mirrorLandmarksNormalizedX,
} from './admin-capture-guidelines';
import { DEBUG_CAPTURE_WHITE_FACE_MESH } from './capture-render-debug';
import { MaskRenderer } from './MaskRenderer';
import type { LandmarkPoint, PoseId } from './types';

type GuideDrawer = (
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  ow: number,
  oh: number,
) => void;

export type AdminFlattenedGuideEncoding =
  | {
      variant: 'frontal';
      ovalFlat: Blob;
      noseMouthFlat: Blob;
      verticalThirdsFlat: Blob;
    }
  | {
      variant: 'profile';
      profileJawFlat: Blob;
    }
  | {
      variant: 'jawUp';
      jawLowerArcFlat: Blob;
    }
  | {
      variant: 'crownPhoto';
      photoFlat: Blob;
    }
  | {
      variant: 'smileLips';
      smileLipsFlat: Blob;
    };

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Photo JPEG retournée comme la préview selfie, sans masque ni calque 2D. */
async function renderPhotoOnlyMirroredFlatPng(bitmap: ImageBitmap): Promise<Blob | null> {
  const w = bitmap.width;
  const h = bitmap.height;
  if (w < 16 || h < 16) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await canvasToPng(canvas);
}

/**
 * Le masque lit `clientWidth`; hors-DOM elle est à 0. On monte brièvement un stack
 * masqué pour que WebGL résolvent la mise en page comme dans la capture temps réel.
 */
function mountScratchStack(cssW: number, cssH: number): {
  remove: () => void;
  photo: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  guide: HTMLCanvasElement;
} {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    `width:${cssW}px`,
    `max-width:${cssW}px`,
    'pointer-events:none',
    'opacity:0.02',
    'z-index:-1',
    'overflow:hidden',
  ].join(';');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block;line-height:0;margin:0;padding:0';

  const photo = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const guide = document.createElement('canvas');
  photo.style.cssText = 'display:block;margin:0;padding:0';
  mask.style.cssText =
    'position:absolute;left:0;top:0;display:block;margin:0;padding:0;pointer-events:none';
  guide.style.cssText =
    'position:absolute;left:0;top:0;display:block;margin:0;padding:0;pointer-events:none';

  wrap.appendChild(photo);
  wrap.appendChild(mask);
  wrap.appendChild(guide);
  host.appendChild(wrap);
  document.body.appendChild(host);

  return {
    remove: () => {
      host.remove();
    },
    photo,
    mask,
    guide,
  };
}

async function renderSingleFlatGuidePng(
  bitmap: ImageBitmap,
  landmarks: LandmarkPoint[],
  videoW: number,
  videoH: number,
  drawGuides: GuideDrawer,
  /** Si faux : composite photo + lignes uniquement (`DEBUG_CAPTURE_WHITE_FACE_MESH` peut forcer le contraire à la compil.). */
  includeWhiteFaceMeshLayer: boolean,
): Promise<Blob | null> {
  const w = bitmap.width;
  const h = bitmap.height;
  if (w < 16 || h < 16 || landmarks.length < 100 || videoW < 8 || videoH < 8) return null;

  const lmFlat = mirrorLandmarksNormalizedX(landmarks);

  /** Un pixel canvas = un pixel du JPEG capture (pas de compression visuelle supplémentaire par sur-échantillonnage). */
  const pr = 1;
  const { remove, photo, mask, guide } = mountScratchStack(w, h);
  photo.style.width = `${w}px`;
  photo.style.height = `${h}px`;
  photo.width = w;
  photo.height = h;

  mask.style.width = `${w}px`;
  mask.style.height = `${h}px`;

  guide.style.width = `${w}px`;
  guide.style.height = `${h}px`;
  guide.width = w;
  guide.height = h;

  let maskRenderer: MaskRenderer | null = null;
  const drawWireMeshLayer = includeWhiteFaceMeshLayer || DEBUG_CAPTURE_WHITE_FACE_MESH;
  try {
    const pctx = photo.getContext('2d');
    if (!pctx) return null;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.translate(w, 0);
    pctx.scale(-1, 1);
    pctx.drawImage(bitmap, 0, 0, w, h);
    pctx.setTransform(1, 0, 0, 1, 0, 0);

    if (drawWireMeshLayer) {
      void mask.offsetHeight;
      maskRenderer = new MaskRenderer();
      maskRenderer.init(mask, {
        skipResizeObserver: true,
        preserveDrawingBuffer: true,
        overlayPixelRatio: 1,
      });
      maskRenderer.setAlignmentQuality(1);
      maskRenderer.render(lmFlat, videoW, videoH, 0, 0, {
        staticCssSize: { w, h },
        landmarkFrame: 'jpegBitmap',
      });
    }

    const gctx = guide.getContext('2d');
    if (!gctx) return null;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    drawGuides(gctx, lmFlat, w, h);

    const composite = document.createElement('canvas');
    composite.width = photo.width;
    composite.height = photo.height;
    const cx = composite.getContext('2d');
    if (!cx) return null;
    cx.drawImage(photo, 0, 0, w, h);
    if (drawWireMeshLayer) {
      cx.drawImage(mask, 0, 0, w, h);
    }
    cx.drawImage(guide, 0, 0, w, h);

    return await canvasToPng(composite);
  } finally {
    maskRenderer?.dispose();
    remove();
  }
}

function isProfilePoseId(id: PoseId): id is 'profile-left' | 'profile-right' {
  return id === 'profile-left' || id === 'profile-right';
}

function isJawUpPoseId(id: PoseId): id is 'jaw-up' {
  return id === 'jaw-up';
}

function isCrownDownPoseId(id: PoseId): id is 'crown-down' {
  return id === 'crown-down';
}

function isCloseupSmilePoseId(id: PoseId): id is 'closeup-smile' {
  return id === 'closeup-smile';
}

function isCloseupEyePoseId(id: PoseId): id is 'closeup-eye' {
  return id === 'closeup-eye';
}

function isCloseupHairlinePoseId(id: PoseId): id is 'closeup-hairline' {
  return id === 'closeup-hairline';
}

/**
 * PNG aplatis admin : 3 variantes pour la face de face ; 1 par profil (arc mâchoire) ;
 * 1 pour menton levé ; 1 pour sommet du crâne (photo seule) ; 1 pour sourire (lèvres).
 * Poses gros plan œil et hairline : pas de fichiers aplatis (JPEG d’analyse inchangé).
 */
export async function encodeAdminGuideFlattenedPair(opts: {
  photoBlob: Blob;
  landmarks: LandmarkPoint[];
  sourceVideoWidth: number;
  sourceVideoHeight: number;
  poseId: PoseId;
}): Promise<AdminFlattenedGuideEncoding | null> {
  if (typeof document === 'undefined') return null;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(opts.photoBlob);

    if (isCloseupEyePoseId(opts.poseId) || isCloseupHairlinePoseId(opts.poseId)) {
      return null;
    }

    if (isProfilePoseId(opts.poseId)) {
      const pid = opts.poseId;
      const profileJawFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminProfileJawGuideOnCanvas(ctx, lm, ow, oh, pid),
        false,
      );
      if (!profileJawFlat) return null;
      return { variant: 'profile', profileJawFlat };
    }

    if (isJawUpPoseId(opts.poseId)) {
      const jawLowerArcFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminJawUpLowerArcGuideOnCanvas(ctx, lm, ow, oh),
        false,
      );
      if (!jawLowerArcFlat) return null;
      return { variant: 'jawUp', jawLowerArcFlat };
    }

    if (isCrownDownPoseId(opts.poseId)) {
      const photoFlat = await renderPhotoOnlyMirroredFlatPng(bitmap);
      if (!photoFlat) return null;
      return { variant: 'crownPhoto', photoFlat };
    }

    if (isCloseupSmilePoseId(opts.poseId)) {
      const smileLipsFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminSmileLipsGuideOnCanvas(ctx, lm, ow, oh),
        true,
      );
      if (!smileLipsFlat) return null;
      return { variant: 'smileLips', smileLipsFlat };
    }

    const ovalFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminOrientationGuidelinesOnCanvas,
      false,
    );
    const noseMouthFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminNoseMouthWidthGuidelinesOnCanvas,
      false,
    );
    const verticalThirdsFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminVerticalThirdsGuidelinesOnCanvas,
      false,
    );

    if (!ovalFlat || !noseMouthFlat || !verticalThirdsFlat) return null;
    return { variant: 'frontal', ovalFlat, noseMouthFlat, verticalThirdsFlat };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
