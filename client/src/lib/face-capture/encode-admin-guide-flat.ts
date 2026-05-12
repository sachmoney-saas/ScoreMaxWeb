// ============================================================
// PNG aplatis (sans perte) : cliché analyse + même maillage debug +
// repères 2D — hors pipeline d’analyse (`.blob` reste le JPEG brut).
// Affichage aplati : photo retournée horizontalement comme la préview selfie,
// avec repères `x' = 1 - x` pour rester alignés.
// Résolution = celle du bitmap source (ratio pixel 1, pas de sur-échantillonnage).
// ============================================================
//
// Pose de face : 5 PNG (ovale + nez/bouche + tiers verticaux + angle mâchoire + contour forme du visage).
// Pose profil : 2 PNG (mâchoire + silhouette nez côté visible).
// Pose menton levé : 1 PNG (arc mandibulaire bas sur le cliché ; pas de maillage).
// Pose sommet du crâne : 1 PNG (photo miroir seule, sans repères dessinés).
// Pose sourire : 1 PNG (photo + contours lèvres bleu clair, sans masque blanc hors debug).
// Poses œil / front (hairline) : pas de PNG aplati admin hormis gros plan œil (contours).

import {
  drawAdminCloseupEyeContoursGuideOnCanvas,
  drawAdminFaceShapeContourGuideOnCanvas,
  drawAdminFrontalJawAngleGuidelinesOnCanvas,
  drawAdminFrontalMaskOverlayGuidesOnCanvas,
  drawAdminJawUpLowerArcGuideOnCanvas,
  drawAdminNoseMouthWidthGuidelinesOnCanvas,
  drawAdminOrientationGuidelinesOnCanvas,
  drawAdminProfileJawGuideOnCanvas,
  drawAdminProfileNoseGuideOnCanvas,
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
      ovalFlat: Blob | null;
      noseMouthFlat: Blob | null;
      verticalThirdsFlat: Blob | null;
      jawAngleFlat: Blob | null;
      faceShapeContourFlat: Blob | null;
      /**
       * Cliché frontal + voile sombre + grille blanche 2D (ovale + axe médian
       * et horizontales yeux/bouche). Vignette d’analyse (sidebar) — `null` si
       * repères indisponibles.
       */
      maskOverlayFlat: Blob | null;
    }
  | {
      variant: 'profile';
      profileJawFlat: Blob;
      profileNoseFlat: Blob | null;
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
    }
  | {
      variant: 'closeupEye';
      eyeContoursFlat: Blob;
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
  /**
   * Opacité ∈ [0,1] d’un voile noir posé **entre** la photo (et le maillage debug)
   * et les guides bleus. Utilisé sur les 5 PNG frontaux pour faire ressortir les
   * traits bleus sans assombrir les guides eux-mêmes. 0/omis → composite intact.
   */
  darkenBackgroundOpacity = 0,
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
    // Voile sombre posé AVANT les guides : la photo (et le maillage debug)
    // sont assombris, les traits bleus restent à pleine intensité.
    if (darkenBackgroundOpacity > 0) {
      const alpha = Math.min(1, Math.max(0, darkenBackgroundOpacity));
      const prevAlpha = cx.globalAlpha;
      cx.globalAlpha = alpha;
      cx.fillStyle = '#000000';
      cx.fillRect(0, 0, w, h);
      cx.globalAlpha = prevAlpha;
    }
    cx.drawImage(guide, 0, 0, w, h);

    return await canvasToPng(composite);
  } finally {
    maskRenderer?.dispose();
    remove();
  }
}

/**
 * PNG `GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY` : cliché selfie (miroir) → voile sombre
 * → traits blancs 2D (contour ovale + axe médian type tiers verticaux + deux horizontales
 * pleines à hauteur yeux / bouche, sans texte ni maillage facettes).
 */
async function renderFrontalMaskOverlayFlatPng(
  bitmap: ImageBitmap,
  landmarks: LandmarkPoint[],
  videoW: number,
  videoH: number,
  /** Opacité ∈ [0,1] du voile noir posé sur la photo avant les traits blancs. */
  darkenBackgroundOpacity: number,
): Promise<Blob | null> {
  const w = bitmap.width;
  const h = bitmap.height;
  if (w < 16 || h < 16 || landmarks.length < 100 || videoW < 8 || videoH < 8) return null;

  const lmFlat = mirrorLandmarksNormalizedX(landmarks);

  const composite = document.createElement('canvas');
  composite.width = w;
  composite.height = h;
  const cx = composite.getContext('2d');
  if (!cx) return null;

  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.translate(w, 0);
  cx.scale(-1, 1);
  cx.drawImage(bitmap, 0, 0, w, h);
  cx.setTransform(1, 0, 0, 1, 0, 0);

  const alpha = Math.min(1, Math.max(0, darkenBackgroundOpacity));
  if (alpha > 0) {
    const prevAlpha = cx.globalAlpha;
    cx.globalAlpha = alpha;
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, w, h);
    cx.globalAlpha = prevAlpha;
  }

  drawAdminFrontalMaskOverlayGuidesOnCanvas(cx, lmFlat, w, h);

  return await canvasToPng(composite);
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
 * PNG aplatis admin : 5 variantes pour la face de face ; 2 par profil (mâchoire + nez visible)
 * ; 1 pour menton levé ; 1 pour sommet du crâne (photo seule) ; 1 pour sourire (lèvres) ;
 * 1 pour gros plan œil (contours des deux yeux).
 * Hors `DEBUG_CAPTURE_WHITE_FACE_MESH`, pas de masque blanc Wireframe sur ces composites.
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

    if (isCloseupHairlinePoseId(opts.poseId)) {
      return null;
    }

    if (isCloseupEyePoseId(opts.poseId)) {
      const eyeContoursFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminCloseupEyeContoursGuideOnCanvas(ctx, lm, ow, oh),
        false,
      );
      if (!eyeContoursFlat) return null;
      return { variant: 'closeupEye', eyeContoursFlat };
    }

    /**
     * Voile sombre uniforme posé sur la photo (et l’éventuel maillage debug)
     * avant les guides bleus — partagé entre tous les guide-traces (frontal,
     * profil, menton levé). 0.4 = ~60 % photo visible, 40 % noir.
     */
    const GUIDE_TRACE_BG_DARKEN_OPACITY = 0.4;

    if (isProfilePoseId(opts.poseId)) {
      const pid = opts.poseId;
      const profileJawFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminProfileJawGuideOnCanvas(ctx, lm, ow, oh, pid),
        false,
        GUIDE_TRACE_BG_DARKEN_OPACITY,
      );
      const profileNoseFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminProfileNoseGuideOnCanvas(ctx, lm, ow, oh, pid),
        false,
        GUIDE_TRACE_BG_DARKEN_OPACITY,
      );
      if (!profileJawFlat) return null;
      return { variant: 'profile', profileJawFlat, profileNoseFlat };
    }

    if (isJawUpPoseId(opts.poseId)) {
      const jawLowerArcFlat = await renderSingleFlatGuidePng(
        bitmap,
        opts.landmarks,
        opts.sourceVideoWidth,
        opts.sourceVideoHeight,
        (ctx, lm, ow, oh) => drawAdminJawUpLowerArcGuideOnCanvas(ctx, lm, ow, oh),
        false,
        GUIDE_TRACE_BG_DARKEN_OPACITY,
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
        false,
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
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);
    const noseMouthFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminNoseMouthWidthGuidelinesOnCanvas,
      false,
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);
    const verticalThirdsFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminVerticalThirdsGuidelinesOnCanvas,
      false,
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);
    const jawAngleFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminFrontalJawAngleGuidelinesOnCanvas,
      false,
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);
    const faceShapeContourFlat = await renderSingleFlatGuidePng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      drawAdminFaceShapeContourGuideOnCanvas,
      false,
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);
    const maskOverlayFlat = await renderFrontalMaskOverlayFlatPng(
      bitmap,
      opts.landmarks,
      opts.sourceVideoWidth,
      opts.sourceVideoHeight,
      GUIDE_TRACE_BG_DARKEN_OPACITY,
    ).catch(() => null);

    if (
      !ovalFlat &&
      !noseMouthFlat &&
      !verticalThirdsFlat &&
      !jawAngleFlat &&
      !faceShapeContourFlat &&
      !maskOverlayFlat
    )
      return null;
    return {
      variant: 'frontal',
      ovalFlat,
      noseMouthFlat,
      verticalThirdsFlat,
      jawAngleFlat,
      faceShapeContourFlat,
      maskOverlayFlat,
    };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
