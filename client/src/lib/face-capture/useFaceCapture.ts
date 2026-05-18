// ============================================================
// useFaceCapture — React hook for CaptureSession
// Accepts external refs so the session uses the same DOM elements as JSX.
// ============================================================

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from 'react';
import { CaptureSession, type CapturedPose, type CaptureSessionState, type AdminCaptureDebugPayload } from './CaptureSession';
import {
  resolveCapturePoseDefinitionsForRuntime,
  type CaptureSessionConfig,
  type HeadPose,
  type PoseId,
  type PoseSessionState,
  type PoseValidation,
} from './types';

/** Durée minimale de l’overlay « Initialisation caméra » (modèle + flux). */
const FACE_CAPTURE_LOAD_MIN_MS = 1400;

export interface FaceCaptureState {
  sessionState: CaptureSessionState;
  currentPose: PoseSessionState | null;
  allPoseStates: PoseSessionState[];
  validation: PoseValidation | null;
  headPose: HeadPose | null;
  /** At least one frame with a detected face in the current run */
  faceInView: boolean;
  capturedCount: number;
  capturedPoses: CapturedPose[];
  isLoading: boolean;
  error: string | null;
  activeCameraDeviceId: string | undefined;
  holdProgress: number;
  transitionPoseId: PoseId | null;
  transitionThumbnailUrl: string | null;
  /** Pause admin après cliché ; image + lignes landmarks. */
  adminCaptureDebug: AdminCaptureDebugPayload | null;
}

export interface FaceCaptureControls {
  start: () => Promise<void>;
  stop: () => void;
  switchCamera: (deviceId: string | undefined) => Promise<void>;
  /** Après cliché admin : reprend vers la pose suivante. */
  resumeAfterAdminPoseReview: () => void;
}

/** Options optionnelles du hook (4ᵉ argument). */
export interface UseFaceCaptureOptions {
  /** Calque canvas 2D pour repères bleus lorsque le maillage WebGL debug est masqué. */
  guideOverlayRef?: RefObject<HTMLCanvasElement | null>;
}

export function useFaceCapture(
  videoRef: RefObject<HTMLVideoElement | null>,
  overlayRef: RefObject<HTMLCanvasElement | null>,
  captureConfig?: Partial<CaptureSessionConfig>,
  options?: UseFaceCaptureOptions,
): [FaceCaptureState, FaceCaptureControls] {
  const sessionRef = useRef<CaptureSession | null>(null);
  const initStarted = useRef(false);
  const optionsRef = useRef<UseFaceCaptureOptions | undefined>(options);
  optionsRef.current = options;
  const captureConfigRef = useRef(captureConfig);
  captureConfigRef.current = captureConfig;

  const [state, setState] = useState<FaceCaptureState>({
    sessionState: 'idle',
    currentPose: null,
    allPoseStates: [],
    validation: null,
    headPose: null,
    faceInView: false,
    capturedCount: 0,
    capturedPoses: [],
    isLoading: false,
    error: null,
    activeCameraDeviceId: undefined,
    holdProgress: 0,
    transitionPoseId: null,
    transitionThumbnailUrl: null,
    adminCaptureDebug: null,
  });

  const syncState = useCallback((session: CaptureSession) => {
    setState(prev => ({
      ...prev,
      sessionState: session.getState(),
      currentPose: session.getCurrentPose(),
      allPoseStates: session.getAllPoseStates(),
      validation: session.getLastValidation(),
      headPose: session.getLastHeadPose(),
      faceInView: session.getFaceInView(),
      capturedCount: session.getCapturedCount(),
      capturedPoses: [...session.getCapturedPoses()],
      activeCameraDeviceId: session.getActiveCameraDeviceId(),
      holdProgress: session.getHoldProgress(),
      transitionPoseId: session.getTransitionPoseId(),
      transitionThumbnailUrl: session.getTransitionThumbnailUrl(),
    }));
  }, []);

  const start = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      return;
    }
    if (initStarted.current) return;
    initStarted.current = true;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const rawCfg = captureConfigRef.current ?? {};
    const session = new CaptureSession({
      ...rawCfg,
      capturePoses: rawCfg.capturePoses ?? resolveCapturePoseDefinitionsForRuntime(),
    });
    sessionRef.current = session;

    session.onEvent(event => {
      if (event.type === 'admin_capture_debug') {
        setState(prev => ({ ...prev, adminCaptureDebug: event.payload }));
        syncState(session);
        return;
      }
      if (event.type === 'pose_captured') {
        setState(prev => ({ ...prev, adminCaptureDebug: null }));
      }
      if (event.type === 'pose_captured' || event.type === 'shutter_started') {
        syncState(session);
      } else if (event.type === 'session_complete') {
        syncState(session);
        setState(prev => ({
          ...prev,
          capturedPoses: event.results,
          isLoading: false,
          adminCaptureDebug: null,
        }));
      } else if (event.type === 'session_error') {
        setState(prev => ({ ...prev, error: event.error.message, isLoading: false, adminCaptureDebug: null }));
      }
    });

    try {
      const t0 = performance.now();
      const guideOverlay = optionsRef.current?.guideOverlayRef?.current ?? null;
      await session.init(video, overlay, guideOverlay);
      const elapsed = performance.now() - t0;
      if (elapsed < FACE_CAPTURE_LOAD_MIN_MS) {
        await new Promise(r => setTimeout(r, FACE_CAPTURE_LOAD_MIN_MS - elapsed));
      }
      setState(prev => ({ ...prev, isLoading: false }));

      await session.start();
      syncState(session);
    } catch (err) {
      initStarted.current = false;
      sessionRef.current = null;
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Camera init failed',
        isLoading: false,
        sessionState: 'error',
      }));
    }
  }, [videoRef, overlayRef, syncState]);

  const switchCamera = useCallback(async (deviceId: string | undefined) => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      await session.switchCamera(deviceId);
      syncState(session);
    } catch {
      /* session_error is already surfaced via onEvent */
    }
  }, [syncState]);

  const resumeAfterAdminPoseReview = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.resumeAfterAdminPoseReview();
    syncState(session);
  }, [syncState]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    initStarted.current = false;
    setState(prev => ({
      ...prev,
      sessionState: 'idle',
      currentPose: null,
      validation: null,
      headPose: null,
      faceInView: false,
      capturedPoses: [],
      capturedCount: 0,
      activeCameraDeviceId: undefined,
      holdProgress: 0,
      transitionPoseId: null,
      transitionThumbnailUrl: null,
      adminCaptureDebug: null,
    }));
  }, []);

  const lastUiSyncMs = useRef(-1);
  useEffect(() => {
    const UI_SYNC_MS = 1000 / 30;
    let rafId: number;
    const poll = (t: number) => {
      if (sessionRef.current) {
        if (
          lastUiSyncMs.current < 0 ||
          t - lastUiSyncMs.current >= UI_SYNC_MS
        ) {
          lastUiSyncMs.current = t;
          syncState(sessionRef.current);
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [syncState]);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || initStarted.current) return;
    void start();
  }, [videoRef, overlayRef, start]);

  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
    };
  }, []);

  return [
    state,
    { start, stop, switchCamera, resumeAfterAdminPoseReview },
  ];
}
