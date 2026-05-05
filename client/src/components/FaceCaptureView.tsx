// ============================================================
// FaceCaptureView — Full-screen camera capture matching SaaS DA
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFaceCapture, listVideoInputDevices } from '../lib/face-capture';
import type { CapturedPose } from '../lib/face-capture/CaptureSession';
import { CAPTURE_POSES, type PoseId } from '../lib/face-capture/types';
import { i18n, type AppLanguage } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
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
    fr: 'Cadrez un œil au centre — vous pouvez rester à distance modérée.',
    en: 'Frame one eye in the centre — a moderate distance is fine.',
  },
  'closeup-smile': {
    fr: 'Rapprochez-vous et souriez naturellement.',
    en: 'Move closer and give a natural smile.',
  },
  'closeup-hairline': {
    fr: 'Dégagez le front — distance modérée, hairline visible.',
    en: 'Show your forehead — moderate distance is fine if the hairline is visible.',
  },
};

interface FaceCaptureViewProps {
  onComplete: (poses: CapturedPose[]) => void;
  onCancel: () => void;
  language?: AppLanguage;
}

export function FaceCaptureView({
  onComplete,
  onCancel,
  language = 'fr',
}: FaceCaptureViewProps) {
  const { isAdmin } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null!);
  const overlayRef = useRef<HTMLCanvasElement>(null!);
  const [state, { stop, switchCamera }] = useFaceCapture(videoRef, overlayRef);
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
    if (!isAdmin || isLoading || hasError) return;
    void refreshVideoDevices();
  }, [isAdmin, isLoading, hasError, refreshVideoDevices]);

  useEffect(() => {
    if (state.sessionState === 'Done' && state.capturedPoses.length > 0) {
      onComplete(state.capturedPoses);
    }
  }, [state.sessionState, state.capturedPoses, onComplete]);

  const hasNoFace =
    (state.sessionState === 'AwaitFace' || state.sessionState === 'Aligning' || state.sessionState === 'Holding') && !state.faceInView;

  const activePoseId: PoseId | null = useMemo(() => {
    const idx = state.currentPose?.index ?? 0;
    return CAPTURE_POSES[idx]?.id ?? null;
  }, [state.currentPose?.index]);

  const instruction =
    activePoseId !== null
      ? i18n(language, STEP_INSTRUCTION[activePoseId])
      : '';

  /** Indique de quel côté pivoter pour entrer dans la plage de yaw (profils). */
  const profileTurnArrow = useMemo((): 'left' | 'right' | null => {
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
  }, [activePoseId, state.headPose, state.validation?.status]);

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

          {!isLoading && !hasError && isAdmin ? (
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

          {state.sessionState === 'Holding' ? (
            <div
              className="pointer-events-none absolute inset-0 z-30 scan-flash-frame"
              aria-hidden
              style={{
                boxShadow:
                  'inset 0 0 0 4px rgba(255, 255, 255, 0.95), inset 0 0 80px 28px rgba(255, 255, 255, 0.55), inset 0 0 180px 70px rgba(255, 255, 255, 0.22)',
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

          {!isLoading && !hasError && state.validation && state.faceInView && instruction ? (
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
                {state.sessionState === 'Holding' ? (
                  <span className="mt-3 block text-base font-semibold text-emerald-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                    {i18n(language, { en: 'Hold still', fr: 'Ne bougez pas' })}
                  </span>
                ) : state.validation?.reasons && state.validation.reasons.length > 0 ? (
                  <span className="mt-3 block text-sm font-normal text-amber-200/95 drop-shadow-md">
                    {state.validation.reasons[0]}
                  </span>
                ) : null}
              </p>

              {isAdmin ? (
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
        </div>

        <div
          className="shrink-0 border-t px-4 py-5"
          style={{
            borderColor: 'hsl(0 0% 100% / 0.06)',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        >
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
            className="group flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm transition-all"
            style={{
              borderColor: 'hsl(0 0% 100% / 0.1)',
              color: 'hsl(0 0% 100% / 0.5)',
            }}
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
            className="absolute inset-0 z-[110] flex items-end justify-center bg-black/75 px-4 pb-8 pt-12 sm:items-center sm:pb-12"
            role="dialog"
            aria-modal="true"
            aria-labelledby="face-capture-cancel-title"
            aria-describedby="face-capture-cancel-desc"
            onClick={() => setCancelConfirmOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(236_38%_8%)] p-6 shadow-xl"
              style={{ background: 'linear-gradient(145deg, hsl(236 32% 10%) 0%, hsl(235 28% 6%) 100%)' }}
              onClick={e => e.stopPropagation()}
            >
              <h2
                id="face-capture-cancel-title"
                className="font-display text-lg font-semibold tracking-tight text-white"
              >
                {i18n(language, {
                  en: 'Cancel this session?',
                  fr: 'Annuler la session ?',
                })}
              </h2>
              <p id="face-capture-cancel-desc" className="mt-3 text-sm leading-relaxed text-white/65">
                {i18n(language, {
                  en: 'This will delete all photos and progress from the current capture session. Nothing will be kept—you will need to start again from the beginning.',
                  fr: 'Cette action supprimera toutes les photos et toute la progression de la session de capture en cours. Aucune donnée ne sera conservée : vous devrez tout recommencer depuis le début.',
                })}
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
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
