// ============================================================
// face-capture — Public API
// ============================================================

export * from './types';
export { CameraManager } from './CameraManager';
export { FaceDetector } from './FaceDetector';
export { solveHeadPoseFromMatrix } from './HeadPoseSolver';
export { PoseValidator } from './PoseValidator';
export {
  evaluateFrameQuality,
  evaluateFrameQualityForCapture,
  evaluateFrameQualityMinimal,
  qualityGateAccepts,
} from './QualityGate';
export { MaskRenderer } from './MaskRenderer';
export { MotionTracker } from './MotionTracker';
export { CaptureSession } from './CaptureSession';
export {
  resolveHoldBestFrameTuning,
  normalizeMeritWeights,
  inferLowTierDevice,
  DEFAULT_HOLD_MERIT_WEIGHTS,
} from './holdBestFrameTuning';
export type {
  ResolvedHoldBestFrameTuning,
  HoldSamplingTuning,
} from './holdBestFrameTuning';
export type {
  CapturedPose,
  CaptureSessionEvent,
  CaptureSessionState,
  CaptureSessionCallback,
} from './CaptureSession';
export { useFaceCapture } from './useFaceCapture';
export type { FaceCaptureState, FaceCaptureControls } from './useFaceCapture';
export { listVideoInputDevices } from './camera-devices';