import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { solveHeadPoseFromMatrix } from "./HeadPoseSolver";
import type { HeadPose, LandmarkPoint } from "./types";

export type FaceDetectorState = "loading" | "ready" | "running" | "stopped";
export type DetectionCallback = (
  landmarks: LandmarkPoint[],
  worldLandmarks: LandmarkPoint[],
  pose: HeadPose,
  blendshapes: Record<string, number>,
) => void;

const TASK_MODEL_PATH = "/models/face_landmarker.task";

/**
 * Une seule instance Face Landmarker + une promesse d’init partagées entre les
 * cycles de vie React (remontées rapides, navigation) pour éviter de retélécharger
 * le fichier `.task` / réinitialiser le delegate GPU plusieurs fois d’affilée.
 */
let sharedLandmarker: FaceLandmarker | null = null;
let sharedInitPromise: Promise<FaceLandmarker> | null = null;
/** Nombre de `FaceDetector` actifs utilisant encore `sharedLandmarker`. */
let sharedRefCount = 0;

async function acquireSharedLandmarker(): Promise<FaceLandmarker> {
  if (!sharedInitPromise) {
    sharedInitPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: TASK_MODEL_PATH,
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })();
  }
  sharedRefCount++;
  try {
    const lm = await sharedInitPromise;
    sharedLandmarker = lm;
    return lm;
  } catch (err) {
    sharedRefCount--;
    if (sharedRefCount <= 0) {
      sharedInitPromise = null;
      sharedLandmarker = null;
    }
    throw err;
  }
}

function releaseSharedLandmarker(): void {
  sharedRefCount = Math.max(0, sharedRefCount - 1);
  if (sharedRefCount > 0) return;
  sharedLandmarker?.close();
  sharedLandmarker = null;
  sharedInitPromise = null;
}

export class FaceDetector {
  private detector: FaceLandmarker | null = null;
  private state: FaceDetectorState = "loading";
  private detectionCallback: DetectionCallback | null = null;

  async init(onDetection: DetectionCallback): Promise<void> {
    this.state = "loading";
    this.detectionCallback = onDetection;
    this.detector = await acquireSharedLandmarker();
    this.state = "ready";
  }

  sendFrame(frame: HTMLVideoElement): void {
    if (this.state !== "ready" || !this.detector) return;
    this.state = "running";
    const now = performance.now();
    const result = this.detector.detectForVideo(frame, now);
    this.emitResult(result);
    this.state = "ready";
  }

  private emitResult(result: FaceLandmarkerResult): void {
    if (!this.detectionCallback) return;
    const lm = result.faceLandmarks?.[0];
    if (!lm || lm.length === 0) {
      this.detectionCallback([], [], { yaw: 0, pitch: 0, roll: 0 }, {});
      return;
    }
    const landmarks: LandmarkPoint[] = lm.map((pt) => ({
      x: pt.x,
      y: pt.y,
      z: pt.z ?? 0,
      visibility: pt.visibility ?? 1,
    }));

    const matrix = result.facialTransformationMatrixes?.[0]?.data ?? [];
    /**
     * `true`: yaw aligns with the mirror preview (`scaleX(-1)` on `<video>` / canvas).
     * Landmarks stay in raw bitmap space; only pose yaw is negated for UX. Profile
     * yaw ranges in `CAPTURE_POSES` match this mirrored convention (see comments
     * on `profile-right` / `profile-left`).
     */
    const pose = solveHeadPoseFromMatrix(matrix, true);

    const blendshapes: Record<string, number> = {};
    const categories = result.faceBlendshapes?.[0]?.categories ?? [];
    for (const cat of categories) {
      if (cat.categoryName) blendshapes[cat.categoryName] = cat.score;
    }

    this.detectionCallback(landmarks, [], pose, blendshapes);
  }

  getState(): FaceDetectorState {
    return this.state;
  }

  destroy(): void {
    this.detector = null;
    this.detectionCallback = null;
    this.state = "stopped";
    releaseSharedLandmarker();
  }
}
