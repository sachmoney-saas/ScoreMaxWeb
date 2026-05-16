// ============================================================
// FaceCaptureView — Full-screen camera capture matching SaaS DA
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { Settings2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminCaptureDebugPanel } from '@/components/AdminCaptureDebugPanel';
import { useFaceCapture, listVideoInputDevices } from '../lib/face-capture';
import type { CapturedPose } from '../lib/face-capture/CaptureSession';
import { CAPTURE_POSES, type PoseId } from '../lib/face-capture/types';
import { i18n, type AppLanguage } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Imperative copy for the active pose — no numbered list, no progress chrome up top */
const STEP_INSTRUCTION: Record<PoseId, { en: string; fr: string }> = {
  frontal: {
    fr: 'Face caméra, visage au centre du cadre.',
    en: 'Face the camera with your face centered in the frame.',
  },
  'profile-right': {
    fr: 'Tournez la tête vers la droite pour scanner votre profil.',
    en: 'Turn your head to the right to scan your profile.',
  },
  'profile-left': {
    fr: 'Tournez la tête vers la gauche pour scanner votre profil.',
    en: 'Turn your head to the left to scan your profile.',
  },
  'jaw-up': {
    fr: 'Levez un peu le menton pour mieux voir la mâchoire.',
    en: 'Lift your chin slightly so we can see your jawline.',
  },
  'crown-down': {
    fr: 'Baissez un peu la tête pour inclure le haut du crâne.',
    en: 'Lower your head slightly to include the top of your head.',
  },
  'closeup-eye': {
    fr: "Approchez encore l'appareil : un œil au centre, en très gros plan.",
    en: 'Move even closer: one eye centred, very close-up.',
  },
  'closeup-smile': {
    fr: 'Approchez davantage le visage et souriez naturellement.',
    en: 'Move closer to the camera and give a natural smile.',
  },
};

interface FaceCaptureViewProps {
  onComplete: (poses: CapturedPose[]) => void;
  onCancel: () => void;
  language?: AppLanguage;
  /** Bloc infos + Commencer au-dessus du flux caméra avant `session.start()`. */
  preCaptureBriefing?: boolean;
}

export function FaceCaptureView({
  onComplete,
  onCancel,
  language = 'fr',
  preCaptureBriefing = false,
}: FaceCaptureViewProps) {
  const { adminCaptureExtrasActive } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null!);
  const overlayRef = useRef<HTMLCanvasElement>(null!);
  const guideOverlayRef = useRef<HTMLCanvasElement>(null!);
  const [briefingDismissed, setBriefingDismissed] = useState(() => !preCaptureBriefing);
  const [briefingBusy, setBriefingBusy] = useState(false);

  useEffect(() => {
    setBriefingDismissed(!preCaptureBriefing);
  }, [preCaptureBriefing]);

  const captureSessionConfig = useMemo(
    () => ({ pauseForAdminCaptureReview: Boolean(adminCaptureExtrasActive) }),
    [adminCaptureExtrasActive],
  );

  const captureFaceOptions = useMemo(
    () => ({
      deferSessionStart: preCaptureBriefing,
      guideOverlayRef,
    }),
    [preCaptureBriefing],
  );

  const [state, { stop, switchCamera, beginPoseSession, resumeAfterAdminPoseReview }] = useFaceCapture(
    videoRef,
    overlayRef,
    captureSessionConfig,
    captureFaceOptions,
  );
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const refreshVideoDevices = useCallback(async () => {
    try {
      const list = await listVideoInputDevices();
      setVideoDevices(list);
    } catch {
      setVideoDevices([]);
    }
  }, []);

  const onPickCamera = useCallback(
    async (deviceId: string) => {
      if (deviceId === state.activeCameraDeviceId || cameraSwitching) return;
      setCameraSwitching(true);
      try {
        await switchCamera(deviceId);
      } finally {
        setCameraSwitching(false);
      }
    },
    [switchCamera, state.activeCameraDeviceId, cameraSwitching],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const isLoading = state.isLoading;
  const hasError = Boolean(state.error);

  useEffect(() => {
    if (!adminCaptureExtrasActive || isLoading || hasError) return;
    void refreshVideoDevices();
  }, [adminCaptureExtrasActive, isLoading, hasError, refreshVideoDevices]);

  useEffect(() => {
    if (state.sessionState === 'Done' && state.capturedPoses.length > 0) {
      onComplete(state.capturedPoses);
    }
  }, [state.sessionState, state.capturedPoses, onComplete]);

  const showPreCaptureBriefingOverlay =
    preCaptureBriefing && !briefingDismissed && !isLoading && !hasError;

  const hasNoFace =
    !showPreCaptureBriefingOverlay &&
    (state.sessionState === 'AwaitFace' || state.sessionState === 'Aligning' || state.sessionState === 'Holding') &&
    !state.faceInView;

  const handleBriefingConfirm = useCallback(async () => {
    setBriefingBusy(true);
    try {
      await beginPoseSession();
      setBriefingDismissed(true);
    } finally {
      setBriefingBusy(false);
    }
  }, [beginPoseSession]);

  const activePoseId: PoseId | null = useMemo(() => {
    const idx = state.currentPose?.index ?? 0;
    return CAPTURE_POSES[idx]?.id ?? null;
  }, [state.currentPose?.index]);

  const instruction =
    activePoseId !== null ? i18n(language, STEP_INSTRUCTION[activePoseId]) : '';

  const showPoseInstructionOverlay = useMemo(() => {
    if (
      showPreCaptureBriefingOverlay ||
      isLoading ||
      hasError ||
      state.sessionState === 'AdminPoseReview' ||
      !instruction
    )
      return false;
    return (
      state.sessionState === 'Cooldown' ||
      state.sessionState === 'NextPose' ||
      (Boolean(state.faceInView) && Boolean(state.validation))
    );
  }, [
    showPreCaptureBriefingOverlay,
    isLoading,
    hasError,
    instruction,
    state.sessionState,
    state.faceInView,
    state.validation,
  ]);

  /** Indique de quel côté pivoter pour entrer dans la plage de yaw (profils). */
  const profileTurnArrow = useMemo((): 'left' | 'right' | null => {
    if (
      state.sessionState === 'Capturing' ||
      state.sessionState === 'Cooldown' ||
      state.sessionState === 'NextPose'
    ) {
      return null;
    }
    if (
      !state.headPose ||
      state.validation?.status === 'ready' ||
      (activePoseId !== 'profile-right' && activePoseId !== 'profile-left')
    ) {
      return null;
    }
    const poseDef = CAPTURE_POSES.find(p => p.id === activePoseId);
    if (!poseDef) return null;
    const [yMin, yMax] = poseDef.yawRange;
    const y = state.headPose.yaw;
    /**
     * Yaw uses `solveHeadPoseFromMatrix(..., true)` so it matches the
     * mirrored preview; chevron “left/right” still needs the inverse of a
     * naive min/max screen map so “tournez à droite/gauche” lines up with the
     * gesture users expect.
     */
    if (y < yMin) return 'right';
    if (y > yMax) return 'left';
    return null;
  }, [state.sessionState, activePoseId, state.headPose, state.validation?.status]);

  /** Hors du scroll/padding AppLayout + ancêtres en `transform` (animate-in), sinon `fixed` est faux-vrai plein écran. */
  const captureUi = (
    <>
      <style>{`
        @keyframes captureFlash {
          0% { opacity: 0; }
          20% { opacity: 0.3; }
          100% { opacity: 0; }
        }
        .capture-flash { animation: captureFlash 0.4s ease-out forwards; }
        @keyframes scanFlashPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        .scan-flash-frame { animation: scanFlashPulse 1.4s ease-in-out infinite; }
        /**
         * Anneau blanc type « flash selfie » (Snap) : centre laissé plus clair
         * pour le visage, bords fortement éclaircis.
         */
        .selfie-flash-vignette {
          background: radial-gradient(
            ellipse 82% 86% at 50% 46%,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0) 40%,
            rgba(255, 255, 255, 0.22) 62%,
            rgba(255, 255, 255, 0.52) 78%,
            rgba(255, 255, 255, 0.88) 100%
          );
          box-shadow:
            inset 0 0 72px rgba(255, 255, 255, 0.45),
            inset 0 0 140px rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col"
        style={{
          background: 'linear-gradient(135deg, hsl(236 38% 4%) 0%, hsl(235 30% 8%) 50%, hsl(236 24% 12%) 100%)',
        }}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/**
           * Selfie mirror: built-in webcams and phone front cameras deliver an
           * un-mirrored bitmap, which feels "inverted" because users expect
           * mirror-preview (FaceTime / Snap / Instagram). We CSS-mirror BOTH the
           * <video> and the <canvas> so they share the exact same flip — landmarks
           * are still computed in raw-bitmap space, so the mesh stays glued to
           * the face after the flip. Captured photos use the raw bitmap, so the
           * stored image is canonical (un-mirrored) for face analysis.
           */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ zIndex: 2, transform: 'scaleX(-1)' }}
          />

          <canvas
            ref={guideOverlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ zIndex: 13, transform: 'scaleX(-1)' }}
          />

          {!isLoading && !hasError && !showPreCaptureBriefingOverlay ? (
            <div
              className="selfie-flash-vignette pointer-events-none absolute inset-0 z-[3]"
              aria-hidden
            />
          ) : null}

          {!isLoading && !hasError && !showPreCaptureBriefingOverlay ? (
            <div
              className="pointer-events-none absolute inset-0 z-[12]"
              aria-hidden
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.45)]" />
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.45)]" />
            </div>
          ) : null}

          {!isLoading && !hasError && !showPreCaptureBriefingOverlay && adminCaptureExtrasActive ? (
            <div className="absolute right-3 top-3 z-[25] sm:right-4 sm:top-4">
              <DropdownMenu
                onOpenChange={open => {
                  if (open) void refreshVideoDevices();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={cameraSwitching}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 shadow-lg backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white disabled:pointer-events-none disabled:opacity-40"
                    title={i18n(language, { en: 'Choose camera', fr: 'Choisir la caméra' })}
                    aria-label={i18n(language, { en: 'Choose camera', fr: 'Choisir la caméra' })}
                  >
                    {cameraSwitching ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                    ) : (
                      <Settings2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="z-[200] max-h-64 w-[min(90vw,280px)] overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {i18n(language, { en: 'Camera', fr: 'Caméra' })}
                  </DropdownMenuLabel>
                  {videoDevices.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      {i18n(language, {
                        en: 'No camera detected',
                        fr: 'Aucune caméra détectée',
                      })}
                    </p>
                  ) : (
                    <DropdownMenuRadioGroup
                      value={
                        state.activeCameraDeviceId &&
                        videoDevices.some(d => d.deviceId === state.activeCameraDeviceId)
                          ? state.activeCameraDeviceId
                          : (videoDevices[0]?.deviceId ?? '')
                      }
                      onValueChange={v => {
                        if (v) void onPickCamera(v);
                      }}
                    >
                      {videoDevices.map((d, i) => (
                        <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                          {d.label?.trim() ||
                            i18n(language, {
                              en: `Camera ${i + 1}`,
                              fr: `Caméra ${i + 1}`,
                            })}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {isLoading && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.88)' }}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
              <p
                className="font-display text-lg font-semibold tracking-tight"
                style={{ color: 'hsl(218 34% 96%)' }}
              >
                {i18n(language, {
                  en: 'Starting camera',
                  fr: 'Initialisation caméra',
                })}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'hsl(225 18% 72%)' }}>
                {i18n(language, {
                  en: 'Requesting camera access',
                  fr: "Demande d'accès à la caméra",
                })}
              </p>
            </div>
          )}

          {showPreCaptureBriefingOverlay ? (
            <div
              className="absolute inset-0 z-[42] flex items-center justify-center overflow-y-auto bg-black/90 px-4 py-8"
              role="dialog"
              aria-modal="true"
              aria-labelledby="face-capture-briefing-title"
            >
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/70 p-6 shadow-xl backdrop-blur-md sm:p-8">
                <h2
                  id="face-capture-briefing-title"
                  className="text-center font-display text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl"
                >
                  {i18n(language, {
                    en: 'Beginning capture',
                    fr: 'Début de la capture',
                  })}
                </h2>
                <p className="mt-5 text-center text-sm leading-relaxed text-white/90 sm:text-[0.9375rem]">
                  {i18n(language, {
                    en: `We analyse your face through ${CAPTURE_POSES.length} main poses. For each pose, follow the on‑screen prompts and stay still until this step completes. Facial data captured here is not shared with third parties and is used solely to compute and display your results within ScoreMax.`,
                    fr: `Nous analysons votre visage à travers ${CAPTURE_POSES.length} poses principales. Pour chaque pose, suivez les instructions à l'écran et restez stable jusqu'à ce que cette étape soit terminée. Les données relatives à votre visage ne sont pas partagées avec des tiers : elles servent uniquement à l'analyse et à l'affichage de vos résultats dans ScoreMax.`,
                  })}
                </p>
                <p className="mt-4 text-center text-sm leading-relaxed text-white/80">
                  {i18n(language, {
                    en: 'Your data can be deleted at any time — no strings attached.',
                    fr: 'Vos données sont supprimables à tout moment, sans conditions.',
                  })}
                </p>
                <div className="mt-6 flex flex-col items-center gap-5">
                  <Link
                    href="/privacy"
                    className="text-center text-sm font-medium text-emerald-200/95 underline underline-offset-4 hover:text-emerald-100"
                  >
                    {i18n(language, {
                      en: 'Learn more about collected data and how we use them',
                      fr: 'En savoir plus sur les données récupérées et leurs usages',
                    })}
                  </Link>
                  <div className="flex w-full max-w-xs justify-center">
                    <Button
                      type="button"
                      className="h-11 w-full rounded-full bg-white text-base font-semibold text-slate-950 hover:bg-zinc-200"
                      disabled={briefingBusy}
                      onClick={() => void handleBriefingConfirm()}
                    >
                      {briefingBusy ? (
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      ) : (
                        i18n(language, {
                          en: 'Start',
                          fr: 'Commencer',
                        })
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {hasError && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.88)' }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <circle cx="10" cy="10" r="8" />
                  <line x1="10" y1="6" x2="10" y2="10" />
                  <line x1="10" y1="14" x2="10" y2="14" />
                </svg>
              </div>
              <p className="font-display text-base tracking-tight" style={{ color: 'hsl(218 34% 96%)' }}>
                {state.error}
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="mt-6 flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors"
                style={{
                  borderColor: 'hsl(235 18% 29% / 0.95)',
                  color: 'hsl(225 18% 72%)',
                }}
              >
                {i18n(language, { en: 'Back', fr: 'Retour' })}
              </button>
            </div>
          )}

          {state.sessionState === 'Holding' && !showPreCaptureBriefingOverlay ? (
            <div
              className="pointer-events-none absolute inset-0 z-30 scan-flash-frame"
              aria-hidden
              style={{
                boxShadow:
                  'inset 0 0 0 5px rgba(255, 255, 255, 0.98), inset 0 0 100px 40px rgba(255, 255, 255, 0.42)',
              }}
            />
          ) : null}

          {hasNoFace && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div
                className="rounded-2xl border px-6 py-4 backdrop-blur-md"
                style={{
                  borderColor: 'hsl(0 0% 100% / 0.1)',
                  background: 'rgba(0,0,0,0.6)',
                }}
              >
                <p className="font-display text-sm tracking-tight" style={{ color: 'hsl(218 34% 96% / 0.8)' }}>
                  {state.validation?.reasons?.[0] ??
                    i18n(language, {
                      en: 'Place your face in the frame',
                      fr: 'Positionnez votre visage dans le cadre',
                    })}
                </p>
              </div>
            </div>
          )}

          {!isLoading && !hasError && showPoseInstructionOverlay ? (
            <>
              {profileTurnArrow === 'left' ? (
                <div
                  className="pointer-events-none absolute left-2 top-1/2 z-20 -translate-y-1/2 sm:left-6"
                  aria-hidden
                >
                  <ChevronLeft
                    className="h-16 w-16 animate-pulse text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:h-20 sm:w-20"
                    strokeWidth={2.25}
                  />
                </div>
              ) : null}
              {profileTurnArrow === 'right' ? (
                <div
                  className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 sm:right-6"
                  aria-hidden
                >
                  <ChevronRight
                    className="h-16 w-16 animate-pulse text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:h-20 sm:w-20"
                    strokeWidth={2.25}
                  />
                </div>
              ) : null}
              <p
                className="pointer-events-none absolute left-0 right-0 top-0 z-20 mx-auto max-w-md px-5 pt-8 text-center font-display text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:max-w-lg sm:text-xl"
              >
                {instruction}
              </p>

              {state.sessionState === 'Holding' &&
              state.validation?.poseId === activePoseId ? (
                <p
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-[21] mx-auto max-w-lg -translate-y-1/2 px-5 text-center font-display text-2xl font-semibold leading-snug tracking-tight text-emerald-300 drop-shadow-[0_2px_20px_rgba(0,0,0,0.92)] sm:max-w-2xl sm:text-3xl"
                  aria-live="polite"
                >
                  {i18n(language, { en: 'Hold still', fr: 'Ne bougez pas' })}
                </p>
              ) : null}

              {state.sessionState !== 'Holding' &&
              state.sessionState !== 'Capturing' &&
              state.sessionState !== 'Cooldown' &&
              state.sessionState !== 'NextPose' &&
              state.validation?.reasons &&
              state.validation.reasons.length > 0 &&
              activePoseId !== null &&
              state.validation.poseId === activePoseId ? (
                <p
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-[21] mx-auto max-w-lg -translate-y-1/2 px-5 text-center font-display text-2xl font-semibold leading-snug tracking-tight text-amber-200/95 drop-shadow-[0_2px_20px_rgba(0,0,0,0.92)] sm:max-w-2xl sm:text-3xl"
                  aria-live="polite"
                >
                  {state.validation.reasons[0]}
                </p>
              ) : null}

              {adminCaptureExtrasActive ? (
                <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-lg border border-white/15 bg-black/55 px-3 py-2 font-mono text-[11px] leading-tight text-white/85 backdrop-blur-md sm:text-xs">
                  <div>state: {state.sessionState}</div>
                  <div>status: {state.validation?.status ?? '-'}</div>
                  <div>score: {Math.round((state.validation?.score ?? 0) * 100)}%</div>
                  <div>
                    yaw: {state.headPose ? Math.round(state.headPose.yaw) : '-'}°
                    &nbsp;pitch: {state.headPose ? Math.round(state.headPose.pitch) : '-'}°
                    &nbsp;roll: {state.headPose ? Math.round(state.headPose.roll) : '-'}°
                  </div>
                  <div>hold: {Math.round(state.holdProgress * 100)}%</div>
                </div>
              ) : null}
            </>
          ) : null}

          {state.sessionState === 'Capturing' &&
            state.allPoseStates[state.currentPose?.index ?? 0]?.state === 'capturing' && (
              <div className="pointer-events-none absolute inset-0 z-30 capture-flash" style={{ background: 'white' }} />
            )}

          {state.adminCaptureDebug && adminCaptureExtrasActive ? (
            <AdminCaptureDebugPanel
              payload={state.adminCaptureDebug}
              language={language}
              onContinue={resumeAfterAdminPoseReview}
            />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-black/10 bg-white px-4 py-5 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
            className="group flex w-full items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition-all hover:bg-zinc-50"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <polyline points="10,3 5,8 10,13" />
            </svg>
            {i18n(language, { en: 'Cancel', fr: 'Annuler' })}
          </button>
        </div>

        {cancelConfirmOpen ? (
          <div
            className="absolute inset-0 z-[110] flex flex-col bg-black"
            role="dialog"
            aria-modal="true"
            aria-label={i18n(language, {
              en: 'Cancel session confirmation',
              fr: 'Confirmation annulation session',
            })}
            onClick={() => setCancelConfirmOpen(false)}
          >
            <div className="min-h-0 flex-1" aria-hidden />
            <div
              className="flex shrink-0 flex-col-reverse gap-2 px-4 pb-8 pt-4 sm:flex-row sm:justify-center sm:gap-3 sm:pb-10"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/5"
                onClick={() => setCancelConfirmOpen(false)}
              >
                {i18n(language, { en: 'Keep capturing', fr: 'Continuer la capture' })}
              </button>
              <button
                type="button"
                className="rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25"
                onClick={() => {
                  setCancelConfirmOpen(false);
                  stop();
                  onCancel();
                }}
              >
                {i18n(language, { en: 'Cancel session', fr: 'Annuler la session' })}
              </button>
            </div>
          </div>
        ) : null}
      </div>

    </>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(captureUi, document.body);
}
