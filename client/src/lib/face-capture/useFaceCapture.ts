// ============================================================
// useFaceCapture — React hook for CaptureSession
// Accepts external refs so the session uses the same DOM elements as JSX.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { CaptureSession, type CapturedPose, type CaptureSessionState } from './CaptureSession';
import type { HeadPose, PoseId, PoseSessionState, PoseValidation } from './types';

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
}

export function useFaceCapture(
  videoRef: React.RefObject<HTMLVideoElement>,
  overlayRef: React.RefObject<HTMLCanvasElement>,
): [FaceCaptureState, FaceCaptureControls] {
  const sessionRef = useRef<CaptureSession | null>(null);
  const initStarted = useRef(false);

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
      // Video/canvas not mounted yet — will be retried by the effect
      return;
    }
    if (initStarted.current) return;
    initStarted.current = true;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const session = new CaptureSession();
    sessionRef.current = session;

    session.onEvent(event => {
      if (event.type === 'session_complete') {
        setState(prev => ({ ...prev, capturedPoses: event.results, isLoading: false }));
      } else if (event.type === 'session_error') {
        setState(prev => ({ ...prev, error: event.error.message, isLoading: false }));
      }
    });

    try {
      await session.init(video, overlay);
      setState(prev => ({ ...prev, isLoading: false }));
      await session.start();
      syncState(session);
    } catch (err) {
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
    }));
  }, []);

  /** Throttle React updates: session internals refresh every frame; UI only needs ~20–30 Hz. */
  const lastUiSyncMs = useRef(-1);
  useEffect(() => {
    const UI_SYNC_MS = 1000 / 24;
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

  // Start when video + overlay DOM elements are available
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

  return [state, { start, stop, switchCamera }];
}