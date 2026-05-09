import type {
  HoldBestFrameOptions,
  HoldBestFramePreset,
  HoldMeritWeights,
} from "./holdBestFrameTuning";

export type { HoldBestFrameOptions, HoldBestFramePreset, HoldMeritWeights };

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
  /**
   * Définitions des poses pour cette session (par défaut `CAPTURE_POSES` ou variante bureau via le hook).
   */
  capturePoses?: PoseDefinition[];
  /**
   * Pause admin après chaque capture : écran debug, journaux yaw/pitch/roll, payloads
   * jusqu’à `resumeAfterAdminPoseReview`.
   *
   * Les PNG repères (stockage DB) sont encodés pour **tous** les utilisateurs dès que
   * landmarks + résolution JPEG sont suffisants ; cette option ne désactive pas l’encode.
   */
  pauseForAdminCaptureReview?: boolean;
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
  /**
   * Pause supplémentaire (ms) appliquée avant que **cette** pose ne commence à
   * être évaluée, en remplacement du `cooldownMs` global de la session. Utilisé
   * pour les gros plans qui exigent un changement physique de distance entre
   * la pose précédente et celle-ci : sans cette pause, la barre d'alignement
   * suivante démarre 300 ms après le flash, avant même que l'utilisateur ait
   * eu le temps de rapprocher l'appareil. Laisser `undefined` pour utiliser le
   * cooldown standard (transitions sans changement de distance).
   */
  entryDelayMs?: number;
  /**
   * Avant que la validation « rapprochez » ne compte, impose que le ratio de
   * largeur facial (voir `faceRatio`) descende sous `maxFaceRatio` pendant
   * `minStableFrames` frames d’affilée — évite deux gros plans extrêmes qui s’enchaînent sans recul.
   */
  requirePullBackBeforeAlign?: {
    maxFaceRatio: number;
    minStableFrames?: number;
  };
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
    holdMs: 2300,
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
     *
     * Yaw is mirrored to match the selfie preview (`solveHeadPoseFromMatrix(..., true)`).
     * “Tournez à droite” → yaw devient négatif (profil droit).
     */
    yawRange: [-95, -40],
    pitchRange: [-28, 28],
    rollRange: [-18, 18],
    minFaceRatio: 0.08,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "profile-left",
    label: "Profil gauche",
    description: "Tournez la tête vers la gauche",
    icon: "👈",
    /** Même convention miroir : « vers la gauche » → yaw positif. À partir de ~40° vers l’épaule. */
    yawRange: [40, 95],
    pitchRange: [-28, 28],
    rollRange: [-18, 18],
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
    pitchRange: [23, 90],
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
    minFaceRatio: 0.16,
    holdMs: 1800,
    qualityGateRequired: true,
  },
  {
    id: "closeup-eye",
    label: "Gros plan oeil",
    description: "Rapprochez l'appareil — un œil cadré au centre, en gros plan",
    icon: "👁",
    /**
     * Wide angular tolerance: targeting one eye with a phone naturally
     * involves pivoting the head, so we accept ±25° yaw / ±20° pitch.
     * `minFaceRatio` exigeant : c'est un vrai gros plan, le visage doit
     * dépasser largement le cadre pour qu'un œil seul soit cadré au centre.
     */
    yawRange: [-25, 25],
    pitchRange: [-20, 20],
    rollRange: [-15, 15],
    minFaceRatio: 0.68,
    holdMs: 1800,
    qualityGateRequired: true,
    entryDelayMs: 1800,
  },
  {
    id: "closeup-hairline",
    label: "Gros plan hairline",
    description: "Rapprochez l'appareil et dégagez bien le front",
    icon: "💇",
    /**
     * Wide angular tolerance: showing the hairline naturally involves
     * tilting the head forward and approaching the phone, often slightly
     * off-axis. ±25° yaw, generous pitch (forward bow allowed), ±15° roll.
     * `minFaceRatio` relevé pour imposer un vrai gros plan sur le front,
     * cohérent avec le gros plan œil qui précède.
     */
    yawRange: [-25, 25],
    pitchRange: [-25, 30],
    rollRange: [-15, 15],
    minFaceRatio: 0.62,
    holdMs: 1800,
    qualityGateRequired: true,
    entryDelayMs: 2200,
    /**
     * Après un gros plan œil très serré : le visage doit d'abord redevenir petit dans le cadre
     * (recul réel du téléphone) avant que le rapprochement pour le hairline soit validé — évite
     * deux clichés quasi identiques/pris trop vite.
     */
    requirePullBackBeforeAlign: { maxFaceRatio: 0.34, minStableFrames: 15 },
  },
];

export const CAPTURE_ORDER: PoseId[] = CAPTURE_POSES.map((p) => p.id);

/**
 * Bureau / webcam : pointeur précis + hover (souris / trackpad), typiquement pas un téléphone en mode tactile seul.
 */
export function prefersRelaxedPcWebcamCaptureFraming(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(pointer: fine)").matches === true &&
      window.matchMedia("(hover: hover)").matches === true
    );
  } catch {
    return false;
  }
}

/** Seuils un peu plus bas que mobile : le visage peut occuper moins de cadre (webcam plus loin du visage). */
const DESKTOP_RELAXED_MIN_FACE_RATIO: Partial<Record<PoseId, number>> = {
  frontal: 0.11,
  "closeup-eye": 0.6,
};

/**
 * Liste des poses pour la session : sur PC « classique », assouplit seulement frontal et gros-plan œil.
 */
export function resolveCapturePoseDefinitionsForRuntime(): PoseDefinition[] {
  if (!prefersRelaxedPcWebcamCaptureFraming()) return CAPTURE_POSES;
  return CAPTURE_POSES.map((d) => {
    const v = DESKTOP_RELAXED_MIN_FACE_RATIO[d.id];
    return v !== undefined ? { ...d, minFaceRatio: v } : d;
  });
}
