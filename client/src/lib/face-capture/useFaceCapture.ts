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
import { CaptureSession, type CapturedPose, type CaptureSessionState } from './CaptureSession';
import type {
  CaptureSessionConfig,
  HeadPose,
  PoseId,
  PoseSessionState,
  PoseValidation,
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
}

export interface FaceCaptureControls {
  start: () => Promise<void>;
  stop: () => void;
  switchCamera: (deviceId: string | undefined) => Promise<void>;
  /** Avec `deferSessionStart` : démarre détection + poses après briefing caméra. */
  beginPoseSession: () => Promise<void>;
}

/** Options optionnelles du hook (4ᵉ argument). */
export interface UseFaceCaptureOptions {
  /** Si vrai, `init()` active la caméra/MediaPipe sans `session.start()` ; appeler `beginPoseSession()` ensuite. */
  deferSessionStart?: boolean;
}

export function useFaceCapture(
  videoRef: RefObject<HTMLVideoElement | null>,
  overlayRef: RefObject<HTMLCanvasElement | null>,
  captureConfig?: Partial<CaptureSessionConfig>,
  options?: UseFaceCaptureOptions,
): [FaceCaptureState, FaceCaptureControls] {
  const sessionRef = useRef<CaptureSession | null>(null);
  const initStarted = useRef(false);
  /** `session.start()` appelé au moins une fois (ou ignoré si pas defer). */
  const sessionFlowStartedRef = useRef(false);
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

    const session = new CaptureSession(captureConfigRef.current ?? {});
    sessionRef.current = session;

    session.onEvent(event => {
      if (event.type === 'pose_captured' || event.type === 'shutter_started') {
        syncState(session);
      } else if (event.type === 'session_complete') {
        syncState(session);
        setState(prev => ({
          ...prev,
          capturedPoses: event.results,
          isLoading: false,
        }));
      } else if (event.type === 'session_error') {
        setState(prev => ({ ...prev, error: event.error.message, isLoading: false }));
      }
    });

    try {
      const t0 = performance.now();
      await session.init(video, overlay);
      const elapsed = performance.now() - t0;
      if (elapsed < FACE_CAPTURE_LOAD_MIN_MS) {
        await new Promise(r => setTimeout(r, FACE_CAPTURE_LOAD_MIN_MS - elapsed));
      }
      setState(prev => ({ ...prev, isLoading: false }));

      const defer = Boolean(optionsRef.current?.deferSessionStart);
      if (!defer) {
        await session.start();
        sessionFlowStartedRef.current = true;
        syncState(session);
      }
    } catch (err) {
      initStarted.current = false;
      sessionFlowStartedRef.current = false;
      sessionRef.current = null;
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Camera init failed',
        isLoading: false,
        sessionState: 'error',
      }));
    }
  }, [videoRef, overlayRef, syncState]);

  const beginPoseSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || sessionFlowStartedRef.current) return;
    try {
      await session.start();
      sessionFlowStartedRef.current = true;
      syncState(session);
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Capture session failed',
        sessionState: 'error',
      }));
    }
  }, [syncState]);

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

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    initStarted.current = false;
    sessionFlowStartedRef.current = false;
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
    { start, stop, switchCamera, beginPoseSession },
  ];
}
