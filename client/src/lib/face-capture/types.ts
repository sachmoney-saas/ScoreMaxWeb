export type PoseId =
  | "frontal"
  | "profile-right"
  | "profile-left"
  | "jaw-up"
  | "crown-down"
  | "closeup-smile"
  | "closeup-eye"
  | "closeup-hairline";

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FaceFrame {
  timestamp: number;
  landmarks: LandmarkPoint[];
  headPose: HeadPose;
  confidence: number;
  frameWidth: number;
  frameHeight: number;
  /** MediaPipe FaceLandmarker blendshapes, calibrated 0..1. Empty when blendshapes unavailable. */
  blendshapes: Record<string, number>;
}

export interface PoseValidation {
  poseId: PoseId;
  status: "invalid" | "aligning" | "ready";
  score: number;
  reasons: string[];
  confidence: number;
}

export type CaptureState =
  | "pending"
  | "aligning"
  | "holding"
  | "capturing"
  | "captured"
  | "done";

export interface PoseSessionState {
  poseId: PoseId;
  index: number;
  state: CaptureState;
  validation: PoseValidation;
  captureTime?: number;
  thumbnailUrl?: string;
}

export interface CameraConfig {
  facingMode: "user" | "environment";
  width: number;
  height: number;
  frameRate: number;
  deviceId?: string;
}

export interface CaptureSessionConfig {
  poseTimeout: number;
  captureQuality: number;
  mediaPipeTargetFps?: number;
  cooldownMs?: number;
  holdFrames?: number;
}

export interface PoseDefinition {
  id: PoseId;
  label: string;
  description: string;
  icon: string;
  yawRange: [number, number];
  pitchRange: [number, number];
  rollRange: [number, number];
  minFaceRatio: number;
  holdMs: number;
  qualityGateRequired: boolean;
}

export const CAPTURE_POSES: PoseDefinition[] = [
  {
    id: "frontal",
    label: "Face de face",
    description: "Regardez droit devant, visage centré",
    icon: "👤",
    yawRange: [-10, 10],
    pitchRange: [-15, 15],
    rollRange: [-10, 10],
    minFaceRatio: 0.13,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "profile-right",
    label: "Profil droit",
    description: "Tournez la tête vers la droite",
    icon: "👉",
    /**
     * Open-ended toward extreme. If MediaPipe loses the face past ~70°
     * (its detection envelope), `CaptureSession` extrapolation takes over
     * and completes the hold using the last in-range sample, then captures
     * the live (over-rotated) camera frame.
     */
    yawRange: [-90, -40],
    pitchRange: [-25, 25],
    rollRange: [-15, 15],
    minFaceRatio: 0.08,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "profile-left",
    label: "Profil gauche",
    description: "Tournez la tête vers la gauche",
    icon: "👈",
    yawRange: [40, 90],
    pitchRange: [-25, 25],
    rollRange: [-15, 15],
    minFaceRatio: 0.08,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "jaw-up",
    label: "Menton relevé",
    description: "Levez la tête pour montrer la machoire et le cou",
    icon: "⬆",
    yawRange: [-20, 20],
    pitchRange: [-90, -20],
    rollRange: [-15, 15],
    minFaceRatio: 0.14,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "crown-down",
    label: "Sommet du crâne",
    description: "Baissez la tête pour montrer le sommet",
    icon: "⬇",
    yawRange: [-20, 20],
    pitchRange: [28, 90],
    rollRange: [-15, 15],
    minFaceRatio: 0.14,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "closeup-smile",
    label: "Gros plan sourire",
    description: "Souriez naturellement",
    icon: "😊",
    yawRange: [-15, 15],
    pitchRange: [-18, 18],
    rollRange: [-15, 15],
    /** Loose enough to capture from a regular selfie distance, not just extreme close-up. */
    minFaceRatio: 0.13,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "closeup-eye",
    label: "Gros plan oeil",
    description: "Rapprochez un oeil de la caméra",
    icon: "👁",
    /**
     * Wide angular tolerance: targeting one eye with a phone naturally
     * involves pivoting the head, so we accept ±25° yaw / ±20° pitch.
     */
    yawRange: [-25, 25],
    pitchRange: [-20, 20],
    rollRange: [-15, 15],
    minFaceRatio: 0.55,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "closeup-hairline",
    label: "Gros plan hairline",
    description: "Dégagez le front pour montrer la hairline",
    icon: "💇",
    /**
     * Wide angular tolerance: showing the hairline naturally involves
     * tilting the head forward and approaching the phone, often slightly
     * off-axis. ±25° yaw, generous pitch (forward bow allowed), ±15° roll.
     */
    yawRange: [-25, 25],
    pitchRange: [-25, 30],
    rollRange: [-15, 15],
    minFaceRatio: 0.45,
    holdMs: 1800,
    qualityGateRequired: true,
  },
];

export const CAPTURE_ORDER: PoseId[] = CAPTURE_POSES.map((p) => p.id);
