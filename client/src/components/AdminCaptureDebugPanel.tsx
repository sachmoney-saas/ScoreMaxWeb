// ============================================================
// Aperçu admin : vignettes aplatis PNG (idem téléchargements), ou repli canvas.
// ============================================================

import { useEffect, useRef } from 'react';
import type { AdminCaptureDebugPayload } from '@/lib/face-capture/CaptureSession';
import type { LandmarkPoint, PoseId } from '@/lib/face-capture/types';
import { MaskRenderer } from '@/lib/face-capture/MaskRenderer';
import { DEBUG_CAPTURE_WHITE_FACE_MESH } from '@/lib/face-capture/capture-render-debug';
import {
  drawAdminFaceShapeContourGuideOnCanvas,
  drawAdminFrontalJawAngleGuidelinesOnCanvas,
  drawAdminJawUpLowerArcGuideOnCanvas,
  drawAdminNoseMouthWidthGuidelinesOnCanvas,
  drawAdminOrientationGuidelinesOnCanvas,
  drawAdminProfileJawGuideOnCanvas,
  drawAdminProfileNoseGuideOnCanvas,
  drawAdminSmileLipsGuideOnCanvas,
  drawAdminVerticalThirdsGuidelinesOnCanvas,
  mirrorLandmarksNormalizedX,
} from '@/lib/face-capture/admin-capture-guidelines';
import { Button } from '@/components/ui/button';
import { i18n, type AppLanguage } from '@/lib/i18n';

const MAX_MASK_PIXEL_RATIO = 1.25;

type GuideDrawer = (
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  outW: number,
  outH: number,
) => void;

type AdminFallbackStackOutcome =
  | { ok: true; meshRenderer: MaskRenderer | null }
  | { ok: false };

/**
 * Photo + (optionnel) WebGL masque debug + repères 2D — repli PNG indisponible.
 * Sans maillage si `drawWhiteFaceMesh` faux et `DEBUG_CAPTURE_WHITE_FACE_MESH` faux.
 */
function renderAdminDebugStack(
  img: HTMLImageElement,
  payload: AdminCaptureDebugPayload,
  els: { photo: HTMLCanvasElement; mask: HTMLCanvasElement; guide: HTMLCanvasElement },
  pr: number,
  drawGuides: GuideDrawer,
  drawWhiteFaceMesh = false,
): AdminFallbackStackOutcome {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w < 2 || h < 2) return { ok: false };

  const lmFlat = mirrorLandmarksNormalizedX(payload.landmarks);

  const { photo, mask, guide } = els;
  photo.style.width = `${w}px`;
  photo.style.height = `${h}px`;
  photo.width = Math.round(w * pr);
  photo.height = Math.round(h * pr);

  mask.style.width = `${w}px`;
  mask.style.height = `${h}px`;

  guide.style.width = `${w}px`;
  guide.style.height = `${h}px`;
  guide.width = Math.round(w * pr);
  guide.height = Math.round(h * pr);

  const pctx = photo.getContext('2d');
  if (!pctx) return { ok: false };
  pctx.setTransform(pr, 0, 0, pr, 0, 0);
  pctx.clearRect(0, 0, w, h);
  pctx.save();
  pctx.translate(w, 0);
  pctx.scale(-1, 1);
  pctx.drawImage(img, 0, 0, w, h);
  pctx.restore();

  let meshRenderer: MaskRenderer | null = null;

  const useMeshLayer = drawWhiteFaceMesh || DEBUG_CAPTURE_WHITE_FACE_MESH;
  if (useMeshLayer) {
    void mask.offsetHeight;
    meshRenderer = new MaskRenderer();
    meshRenderer.init(mask, { skipResizeObserver: true });
    meshRenderer.setAlignmentQuality(1);
    meshRenderer.render(
      lmFlat,
      payload.sourceVideoWidth,
      payload.sourceVideoHeight,
      0,
      0,
      { staticCssSize: { w, h }, landmarkFrame: 'jpegBitmap' },
    );
  }

  const gctx = guide.getContext('2d');
  if (!gctx) {
    meshRenderer?.dispose();
    return { ok: false };
  }
  gctx.setTransform(pr, 0, 0, pr, 0, 0);
  gctx.clearRect(0, 0, w, h);
  drawGuides(gctx, lmFlat, w, h);

  return { ok: true, meshRenderer };
}

function isProfilePoseId(id: PoseId): boolean {
  return id === 'profile-left' || id === 'profile-right';
}

function isJawUpPoseId(id: PoseId): boolean {
  return id === 'jaw-up';
}

function isCloseupSmilePoseId(id: PoseId): boolean {
  return id === 'closeup-smile';
}

function isCloseupEyePoseId(id: PoseId): boolean {
  return id === 'closeup-eye';
}

/** Gros plan œil sans PNG : miniature JPEG d’analyse uniquement (sans masque). */
function JpegThumbnailOnlyAdminPreview({
  payload,
  language,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
        {i18n(language, {
          en: 'Eye close-up — analysis JPEG only (eye-contour PNG unavailable for this capture)',
          fr:
            'Gros plan œil — JPEG d’analyse seul (PNG contours indisponible pour cette capture)',
        })}
      </p>
      <img
        src={payload.thumbnailUrl}
        alt=""
        width={payload.outputWidth}
        height={payload.outputHeight}
        className="mx-auto block h-auto max-w-full rounded-md [transform:scaleX(-1)]"
        decoding="async"
      />
    </div>
  );
}

/** Repli canvas — profil : photo + arc mâchoire (sans maillage debug si constante prod). */
function CanvasFallbackProfileJaw({
  payload,
  language,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
}) {
  const photoRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: MaskRenderer | null = null;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const pr = Math.min(window.devicePixelRatio ?? 1, MAX_MASK_PIXEL_RATIO);
      const photo = photoRef.current;
      const mask = maskRef.current;
      const guide = guideRef.current;
      if (!photo || !mask || !guide) return;
      renderer?.dispose();
      const drawer: GuideDrawer = (ctx, lm, ow, oh) => {
        drawAdminProfileJawGuideOnCanvas(ctx, lm, ow, oh, payload.poseId);
        drawAdminProfileNoseGuideOnCanvas(ctx, lm, ow, oh, payload.poseId);
      };
      const stacked = renderAdminDebugStack(img, payload, { photo, mask, guide }, pr, drawer, false);
      renderer = stacked.ok ? stacked.meshRenderer : null;
    };

    img.src = payload.thumbnailUrl;

    return () => {
      cancelled = true;
      renderer?.dispose();
    };
  }, [payload]);

  const stackWrap = 'relative mx-auto inline-block leading-none';

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
        {i18n(language, {
          en: 'Profile — jaw guideline (fallback)',
          fr: 'Profil — repère mâchoire (repli)',
        })}
      </p>
      <div className={stackWrap}>
        <canvas ref={photoRef} className="block max-w-full rounded-md" />
        <canvas
          ref={maskRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
        />
        <canvas
          ref={guideRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
        />
      </div>
    </div>
  );
}

/** Repli canvas — menton levé : arc mandibulaire bas sans maillage filaire prod. */
function CanvasFallbackJawUp({
  payload,
  language,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
}) {
  const photoRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: MaskRenderer | null = null;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const pr = Math.min(window.devicePixelRatio ?? 1, MAX_MASK_PIXEL_RATIO);
      const photo = photoRef.current;
      const mask = maskRef.current;
      const guide = guideRef.current;
      if (!photo || !mask || !guide) return;
      renderer?.dispose();
      const drawer: GuideDrawer = (ctx, lm, ow, oh) =>
        drawAdminJawUpLowerArcGuideOnCanvas(ctx, lm, ow, oh);
      const stacked = renderAdminDebugStack(img, payload, { photo, mask, guide }, pr, drawer, false);
      renderer = stacked.ok ? stacked.meshRenderer : null;
    };

    img.src = payload.thumbnailUrl;

    return () => {
      cancelled = true;
      renderer?.dispose();
    };
  }, [payload]);

  const stackWrap = 'relative mx-auto inline-block leading-none';

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
        {i18n(language, {
          en: 'Jaw lower arc — guideline (fallback)',
          fr: 'Menton levé — arc mandibulaire (repli)',
        })}
      </p>
      <div className={stackWrap}>
        <canvas ref={photoRef} className="block max-w-full rounded-md" />
        <canvas
          ref={maskRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
        />
        <canvas
          ref={guideRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
        />
      </div>
    </div>
  );
}

/** Repli canvas — sourire : masque + contours lèvres. */
function CanvasFallbackSmileLips({
  payload,
  language,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
}) {
  const photoRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: MaskRenderer | null = null;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const pr = Math.min(window.devicePixelRatio ?? 1, MAX_MASK_PIXEL_RATIO);
      const photo = photoRef.current;
      const mask = maskRef.current;
      const guide = guideRef.current;
      if (!photo || !mask || !guide) return;
      renderer?.dispose();
      const drawer: GuideDrawer = (ctx, lm, ow, oh) =>
        drawAdminSmileLipsGuideOnCanvas(ctx, lm, ow, oh);
      const stacked = renderAdminDebugStack(img, payload, { photo, mask, guide }, pr, drawer, true);
      renderer = stacked.ok ? stacked.meshRenderer : null;
    };

    img.src = payload.thumbnailUrl;

    return () => {
      cancelled = true;
      renderer?.dispose();
    };
  }, [payload]);

  const stackWrap = 'relative mx-auto inline-block leading-none';

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
        {i18n(language, {
          en: 'Smile — lip contours (fallback)',
          fr: 'Sourire — contours lèvres (repli)',
        })}
      </p>
      <div className={stackWrap}>
        <canvas ref={photoRef} className="block max-w-full rounded-md" />
        <canvas
          ref={maskRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
        />
        <canvas
          ref={guideRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
        />
      </div>
    </div>
  );
}

function CanvasFallbackPreview({
  payload,
  language,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
}) {
  const photoOriRef = useRef<HTMLCanvasElement>(null);
  const maskOriRef = useRef<HTMLCanvasElement>(null);
  const guideOriRef = useRef<HTMLCanvasElement>(null);

  const photoNmRef = useRef<HTMLCanvasElement>(null);
  const maskNmRef = useRef<HTMLCanvasElement>(null);
  const guideNmRef = useRef<HTMLCanvasElement>(null);

  const photoVtRef = useRef<HTMLCanvasElement>(null);
  const maskVtRef = useRef<HTMLCanvasElement>(null);
  const guideVtRef = useRef<HTMLCanvasElement>(null);

  const photoJaRef = useRef<HTMLCanvasElement>(null);
  const maskJaRef = useRef<HTMLCanvasElement>(null);
  const guideJaRef = useRef<HTMLCanvasElement>(null);

  const photoFcRef = useRef<HTMLCanvasElement>(null);
  const maskFcRef = useRef<HTMLCanvasElement>(null);
  const guideFcRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rOri: MaskRenderer | null = null;
    let rNm: MaskRenderer | null = null;
    let rVt: MaskRenderer | null = null;
    let rJa: MaskRenderer | null = null;
    let rFc: MaskRenderer | null = null;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const pr = Math.min(window.devicePixelRatio ?? 1, MAX_MASK_PIXEL_RATIO);

      const po = photoOriRef.current;
      const mo = maskOriRef.current;
      const go = guideOriRef.current;
      const pn = photoNmRef.current;
      const mn = maskNmRef.current;
      const gn = guideNmRef.current;
      const pv = photoVtRef.current;
      const mv = maskVtRef.current;
      const gv = guideVtRef.current;
      const pja = photoJaRef.current;
      const mja = maskJaRef.current;
      const gja = guideJaRef.current;
      const pfc = photoFcRef.current;
      const mfc = maskFcRef.current;
      const gfc = guideFcRef.current;
      if (
        !po ||
        !mo ||
        !go ||
        !pn ||
        !mn ||
        !gn ||
        !pv ||
        !mv ||
        !gv ||
        !pja ||
        !mja ||
        !gja ||
        !pfc ||
        !mfc ||
        !gfc
      )
        return;

      rOri?.dispose();
      rNm?.dispose();
      rVt?.dispose();
      rJa?.dispose();
      rFc?.dispose();
      const resOri = renderAdminDebugStack(
        img,
        payload,
        { photo: po, mask: mo, guide: go },
        pr,
        drawAdminOrientationGuidelinesOnCanvas,
        false,
      );
      const resNm = renderAdminDebugStack(
        img,
        payload,
        { photo: pn, mask: mn, guide: gn },
        pr,
        drawAdminNoseMouthWidthGuidelinesOnCanvas,
        false,
      );
      const resVt = renderAdminDebugStack(
        img,
        payload,
        { photo: pv, mask: mv, guide: gv },
        pr,
        drawAdminVerticalThirdsGuidelinesOnCanvas,
        false,
      );
      const resJa = renderAdminDebugStack(
        img,
        payload,
        { photo: pja, mask: mja, guide: gja },
        pr,
        drawAdminFrontalJawAngleGuidelinesOnCanvas,
        false,
      );
      const resFc = renderAdminDebugStack(
        img,
        payload,
        { photo: pfc, mask: mfc, guide: gfc },
        pr,
        drawAdminFaceShapeContourGuideOnCanvas,
        false,
      );
      if (!resOri.ok || !resNm.ok || !resVt.ok || !resJa.ok || !resFc.ok) {
        if (resOri.ok) resOri.meshRenderer?.dispose();
        if (resNm.ok) resNm.meshRenderer?.dispose();
        if (resVt.ok) resVt.meshRenderer?.dispose();
        if (resJa.ok) resJa.meshRenderer?.dispose();
        if (resFc.ok) resFc.meshRenderer?.dispose();
        return;
      }
      rOri = resOri.meshRenderer;
      rNm = resNm.meshRenderer;
      rVt = resVt.meshRenderer;
      rJa = resJa.meshRenderer;
      rFc = resFc.meshRenderer;
    };

    img.src = payload.thumbnailUrl;

    return () => {
      cancelled = true;
      rOri?.dispose();
      rNm?.dispose();
      rVt?.dispose();
      rJa?.dispose();
      rFc?.dispose();
      rOri = null;
      rNm = null;
      rVt = null;
      rJa = null;
      rFc = null;
    };
  }, [payload]);

  const stackWrap = 'relative mx-auto inline-block leading-none';

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
          {i18n(language, { en: 'Oval alignment (fallback)', fr: 'Alignement ovale (repli)' })}
        </p>
        <div className={stackWrap}>
          <canvas ref={photoOriRef} className="block max-w-full rounded-md" />
          <canvas
            ref={maskOriRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
          />
          <canvas
            ref={guideOriRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
          {i18n(language, { en: 'Nose & mouth (fallback)', fr: 'Nez & bouche (repli)' })}
        </p>
        <div className={stackWrap}>
          <canvas ref={photoNmRef} className="block max-w-full rounded-md" />
          <canvas
            ref={maskNmRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
          />
          <canvas
            ref={guideNmRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
          {i18n(language, {
            en: 'Vertical thirds — eyes & lips (fallback)',
            fr: 'Tiers verticaux — yeux & lèvres (repli)',
          })}
        </p>
        <div className={stackWrap}>
          <canvas ref={photoVtRef} className="block max-w-full rounded-md" />
          <canvas
            ref={maskVtRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
          />
          <canvas
            ref={guideVtRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
          {i18n(language, {
            en: 'Jaw angle — front (fallback)',
            fr: 'Angle mâchoire — face (repli)',
          })}
        </p>
        <div className={stackWrap}>
          <canvas ref={photoJaRef} className="block max-w-full rounded-md" />
          <canvas
            ref={maskJaRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
          />
          <canvas
            ref={guideJaRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
          {i18n(language, {
            en: 'Face shape — contour (fallback)',
            fr: 'Forme du visage — contour (repli)',
          })}
        </p>
        <div className={stackWrap}>
          <canvas ref={photoFcRef} className="block max-w-full rounded-md" />
          <canvas
            ref={maskFcRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md opacity-[0.94]"
          />
          <canvas
            ref={guideFcRef}
            className="pointer-events-none absolute left-0 top-0 block max-w-full rounded-md"
          />
        </div>
      </div>
    </div>
  );
}

export function AdminCaptureDebugPanel({
  payload,
  language,
  onContinue,
}: {
  payload: AdminCaptureDebugPayload;
  language: AppLanguage;
  onContinue: () => void;
}) {
  const isProfilePose = isProfilePoseId(payload.poseId);
  const isJawUpPose = isJawUpPoseId(payload.poseId);
  const isSmilePose = isCloseupSmilePoseId(payload.poseId);
  const isCloseupEyePose = isCloseupEyePoseId(payload.poseId);
  const eyeCloseupContourUrl = payload.annotatedCloseupEyeContoursGuideThumbnailUrl;
  const eyeCloseupCanthalTiltUrl = payload.annotatedCloseupEyeCanthalTiltGuideThumbnailUrl;
  const hasCloseupEyeFlat = Boolean(
    isCloseupEyePose && (eyeCloseupContourUrl || eyeCloseupCanthalTiltUrl),
  );
  const needsJpegOnlyCloseup =
    isCloseupEyePose && !eyeCloseupContourUrl && !eyeCloseupCanthalTiltUrl;

  const ovalUrl = payload.annotatedOvalGuideThumbnailUrl;
  const nmUrl = payload.annotatedNoseMouthGuideThumbnailUrl;
  const vtUrl = payload.annotatedVerticalThirdsGuideThumbnailUrl;
  const jawAngleUrl = payload.annotatedJawAngleGuideThumbnailUrl;
  const fcUrl = payload.annotatedFaceShapeContourGuideThumbnailUrl;
  const cheeksUrl = payload.annotatedFrontalCheeksGuideThumbnailUrl;
  const maskOverlayUrl = payload.annotatedFrontalMaskOverlayFlatThumbnailUrl;
  const frontalLipsUrl = payload.annotatedFrontalLipsGuideThumbnailUrl;
  const jawUrl = payload.annotatedProfileJawGuideThumbnailUrl;
  const profileNoseUrl = payload.annotatedProfileNoseGuideThumbnailUrl;
  const jawUpUrl = payload.annotatedJawUpLowerArcGuideThumbnailUrl;
  const smileUrl = payload.annotatedSmileLipsGuideThumbnailUrl;
  const smileTeethUrl = payload.annotatedSmileTeethGuideThumbnailUrl;

  const hasAnyFrontalGuidePng = Boolean(
    ovalUrl ||
    nmUrl ||
    vtUrl ||
    jawAngleUrl ||
    fcUrl ||
    cheeksUrl ||
    maskOverlayUrl ||
    frontalLipsUrl,
  );
  const hasProfileFlat = Boolean(jawUrl || profileNoseUrl);
  const hasJawUpFlat = Boolean(jawUpUrl);
  const hasSmileFlat = Boolean(smileUrl || smileTeethUrl);
  const hasFlatPng =
    hasAnyFrontalGuidePng ||
    hasProfileFlat ||
    hasJawUpFlat ||
    hasSmileFlat ||
    hasCloseupEyeFlat;

  return (
    <div
      className="absolute inset-0 z-[115] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/88 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-capture-debug-title"
    >
      <p
        id="admin-capture-debug-title"
        className="text-center font-mono text-xs font-medium uppercase tracking-wider text-amber-200/90"
      >
        {i18n(language, { en: 'Admin — capture debug', fr: 'Admin — debug capture' })}
      </p>
      <p className="max-w-lg text-center text-xs text-white/55">
        {hasFlatPng
          ? i18n(language, {
              en: 'Lossless PNG stack (same files as downloads). Plain analysis JPEG is unchanged.',
              fr:
                'Empilement PNG sans perte (mêmes fichiers qu’au téléchargement). Le JPEG d’analyse reste inchangé.',
            })
          : needsJpegOnlyCloseup
            ? i18n(language, {
                en:
                  'No admin flat PNG for this closeup — thumbnail below is the plain analysis JPEG only (unchanged).',
                fr:
                  'Pas de PNG aplati admin pour ce gros plan — la miniature ci-dessous est le JPEG d’analyse brut (inchangé).',
              })
            : i18n(language, {
                en: 'Flat PNGs unavailable — live canvas fallback. Plain analysis JPEG is unchanged.',
                fr:
                  'PNG aplatis indisponibles — aperçu canvas. Le JPEG d’analyse reste inchangé.',
              })}
      </p>
      {hasFlatPng ? (
        <div className="flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-cyan-200/90">
          {hasProfileFlat ? (
            <>
              {jawUrl ? (
                <a
                  href={jawUrl}
                  download={`${payload.poseId}-annotated-profile-jaw-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — profile jaw',
                    fr: 'Télécharger PNG — profil (mâchoire)',
                  })}
                </a>
              ) : null}
              {profileNoseUrl ? (
                <a
                  href={profileNoseUrl}
                  download={`${payload.poseId}-annotated-profile-nose-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — profile nose silhouette',
                    fr: 'Télécharger PNG — profil (silhouette nez)',
                  })}
                </a>
              ) : null}
            </>
          ) : hasJawUpFlat ? (
            <a
              href={jawUpUrl}
              download={`${payload.poseId}-annotated-jaw-lower-arc-guide.png`}
              className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
            >
              {i18n(language, {
                en: 'Download PNG — jaw lower arc',
                fr: 'Télécharger PNG — arc mandibulaire (menton levé)',
              })}
            </a>
          ) : hasSmileFlat ? (
            <>
              {smileUrl ? (
                <a
                  href={smileUrl}
                  download={`${payload.poseId}-annotated-smile-lips-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — lip contours (smile)',
                    fr: 'Télécharger PNG — contours lèvres (sourire)',
                  })}
                </a>
              ) : null}
              {smileTeethUrl ? (
                <a
                  href={smileTeethUrl}
                  download={`${payload.poseId}-annotated-smile-teeth-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — teeth highlight (smile)',
                    fr: 'Télécharger PNG — dents en évidence (sourire)',
                  })}
                </a>
              ) : null}
            </>
          ) : hasCloseupEyeFlat ? (
            <>
              {eyeCloseupContourUrl ? (
                <a
                  href={eyeCloseupContourUrl}
                  download={`${payload.poseId}-annotated-eye-contours-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: "Download PNG — eye contours (close-up)",
                    fr: "Télécharger PNG — contours œil (gros plan)",
                  })}
                </a>
              ) : null}
              {eyeCloseupCanthalTiltUrl ? (
                <a
                  href={eyeCloseupCanthalTiltUrl}
                  download={`${payload.poseId}-annotated-eye-canthal-tilt-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: "Download PNG — canthal tilt (close-up)",
                    fr: "Télécharger PNG — canthal tilt (gros plan)",
                  })}
                </a>
              ) : null}
            </>
          ) : (
            <>
              {ovalUrl ? (
                <a
                  href={ovalUrl}
                  download={`${payload.poseId}-annotated-oval-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — oval guides',
                    fr: 'Télécharger PNG — repères ovale',
                  })}
                </a>
              ) : null}
              {nmUrl ? (
                <a
                  href={nmUrl}
                  download={`${payload.poseId}-annotated-nose-mouth-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — nose & mouth',
                    fr: 'Télécharger PNG — nez & bouche',
                  })}
                </a>
              ) : null}
              {vtUrl ? (
                <a
                  href={vtUrl}
                  download={`${payload.poseId}-annotated-vertical-thirds-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — vertical thirds',
                    fr: 'Télécharger PNG — tiers verticaux',
                  })}
                </a>
              ) : null}
              {jawAngleUrl ? (
                <a
                  href={jawAngleUrl}
                  download={`${payload.poseId}-annotated-jaw-angle-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — jaw angle (front)',
                    fr: 'Télécharger PNG — angle mâchoire (face)',
                  })}
                </a>
              ) : null}
              {fcUrl ? (
                <a
                  href={fcUrl}
                  download={`${payload.poseId}-annotated-face-shape-contour-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — face shape contour',
                    fr: 'Télécharger PNG — contour forme du visage',
                  })}
                </a>
              ) : null}
              {cheeksUrl ? (
                <a
                  href={cheeksUrl}
                  download={`${payload.poseId}-annotated-cheeks-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — cheeks (bilateral)',
                    fr: 'Télécharger PNG — joues (bilatéral)',
                  })}
                </a>
              ) : null}
              {maskOverlayUrl ? (
                <a
                  href={maskOverlayUrl}
                  download={`${payload.poseId}-annotated-mask-overlay.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — dark photo + white mesh',
                    fr: 'Télécharger PNG — photo sombre + maillage blanc',
                  })}
                </a>
              ) : null}
              {frontalLipsUrl ? (
                <a
                  href={frontalLipsUrl}
                  download={`${payload.poseId}-annotated-frontal-lips-guide.png`}
                  className="underline decoration-cyan-500/55 underline-offset-2 hover:text-cyan-50"
                >
                  {i18n(language, {
                    en: 'Download PNG — frontal lips (at rest)',
                    fr: 'Télécharger PNG — lèvres au repos (face)',
                  })}
                </a>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <div className="max-h-[min(82vh,960px)] w-full max-w-3xl overflow-auto rounded-lg border border-white/15 bg-black/40 p-4 shadow-xl">
        {hasFlatPng ? (
          hasProfileFlat ? (
            <div className="flex w-full flex-col items-center gap-8">
              {jawUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Profile jaw — flat (light blue guideline)',
                      fr: 'Profil mâchoire — fichier aplati (repère bleu clair)',
                    })}
                  </p>
                  <img
                    src={jawUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {profileNoseUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Profile nose silhouette — flat (visible side)',
                      fr: 'Profil nez — fichier aplati (côté visible, forme narinaire)',
                    })}
                  </p>
                  <img
                    src={profileNoseUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
            </div>
          ) : hasJawUpFlat ? (
            <div className="w-full">
              <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                {i18n(language, {
                  en: 'Jaw lower arc — flat (light blue guideline)',
                  fr: 'Menton levé — fichier aplati (arc bleu clair)',
                })}
              </p>
              <img
                src={jawUpUrl}
                alt=""
                width={payload.outputWidth}
                height={payload.outputHeight}
                className="mx-auto block h-auto w-full max-w-full rounded-md"
                decoding="async"
              />
            </div>
          ) : hasSmileFlat ? (
            <div className="flex w-full flex-col items-center gap-8">
              {smileUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Smile — lips (blue fill, darkened mouth + outside)',
                      fr: 'Sourire — lèvres (remplissage bleu, bouche + extérieur assombris)',
                    })}
                  </p>
                  <img
                    src={smileUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {smileTeethUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Smile — teeth highlight (everything outside the mouth darkened)',
                      fr: 'Sourire — dents en évidence (tout l’extérieur de la bouche assombri)',
                    })}
                  </p>
                  <img
                    src={smileTeethUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
            </div>
          ) : hasCloseupEyeFlat ? (
            <div className="flex w-full flex-col items-center gap-8">
              {eyeCloseupContourUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: "Eye close-up — flat (masked eye regions)",
                      fr: "Gros plan œil — aplati (zones paupières masquées)",
                    })}
                  </p>
                  <img
                    src={eyeCloseupContourUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {eyeCloseupCanthalTiltUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: "Eye close-up — canthal tilt (medial→lateral axis per eye)",
                      fr: "Gros plan œil — canthal tilt (axe interne→externe par œil)",
                    })}
                  </p>
                  <img
                    src={eyeCloseupCanthalTiltUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8">
              {ovalUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, { en: 'Oval alignment — flat', fr: 'Alignement ovale — fichier aplati' })}
                  </p>
                  <img
                    src={ovalUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {nmUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Nose & mouth widths — flat',
                      fr: 'Largeur nez ↔ bouche — fichier aplati',
                    })}
                  </p>
                  <img
                    src={nmUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {vtUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Vertical thirds — flat (eyes midpoint, lips midpoint)',
                      fr: 'Tiers verticaux — fichier aplati (milieu des yeux, milieu des lèvres)',
                    })}
                  </p>
                  <img
                    src={vtUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {jawAngleUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Jaw angle (front) — flat',
                      fr: 'Angle mâchoire (face) — fichier aplati',
                    })}
                  </p>
                  <img
                    src={jawAngleUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {fcUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Face shape contour — flat (light blue outline)',
                      fr: 'Contour forme du visage — fichier aplati (trait bleu)',
                    })}
                  </p>
                  <img
                    src={fcUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {cheeksUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Cheeks — flat (left + right polygons)',
                      fr: 'Joues — fichier aplati (polygones gauche + droite)',
                    })}
                  </p>
                  <img
                    src={cheeksUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {maskOverlayUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Mask overlay — flat (dark photo + white mesh)',
                      fr: 'Maillage blanc — fichier aplati (photo assombrie + maillage)',
                    })}
                  </p>
                  <img
                    src={maskOverlayUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
              {frontalLipsUrl ? (
                <div className="w-full">
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-wide text-white/45">
                    {i18n(language, {
                      en: 'Frontal lips — at rest (same layers as smile lips)',
                      fr: 'Lèvres au repos — face (mêmes calques que sourire)',
                    })}
                  </p>
                  <img
                    src={frontalLipsUrl}
                    alt=""
                    width={payload.outputWidth}
                    height={payload.outputHeight}
                    className="mx-auto block h-auto w-full max-w-full rounded-md"
                    decoding="async"
                  />
                </div>
              ) : null}
            </div>
          )
        ) : needsJpegOnlyCloseup ? (
          <JpegThumbnailOnlyAdminPreview payload={payload} language={language} />
        ) : isProfilePose ? (
          <CanvasFallbackProfileJaw payload={payload} language={language} />
        ) : isJawUpPose ? (
          <CanvasFallbackJawUp payload={payload} language={language} />
        ) : isSmilePose ? (
          <CanvasFallbackSmileLips payload={payload} language={language} />
        ) : (
          <CanvasFallbackPreview payload={payload} language={language} />
        )}
      </div>
      <Button
        type="button"
        className="h-11 min-w-[200px] rounded-full bg-white text-base font-semibold text-slate-950 hover:bg-zinc-200"
        onClick={onContinue}
      >
        {i18n(language, { en: 'Next', fr: 'Suivant' })}
      </Button>
    </div>
  );
}
