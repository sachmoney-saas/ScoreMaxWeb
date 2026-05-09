import {
  CAPTURE_POSES,
  type CaptureSessionConfig,
  type FaceFrame,
  type HeadPose,
  type LandmarkPoint,
  type PoseDefinition,
  type PoseSessionState,
  type PoseValidation,
  type PoseId,
} from "./types";
import { CameraManager } from "./CameraManager";
import { FaceDetector } from "./FaceDetector";
import { MaskRenderer } from "./MaskRenderer";
import { MotionTracker } from "./MotionTracker";
import { PoseValidator } from "./PoseValidator";
import { evaluateFrameQualityForCapture, evaluateFrameQualityMinimal } from "./QualityGate";
import { faceRatio } from "./strategies/PoseStrategy";
import {
  drawLiveColoredPoseGuidesOnOverlayCanvas,
  jpegOutputDimensions,
  posesWithColoredGuideLinesOnly,
} from "./admin-capture-guidelines";
import { DEBUG_CAPTURE_WHITE_FACE_MESH } from "./capture-render-debug";
import { encodeAdminGuideFlattenedPair } from "./encode-admin-guide-flat";

export interface CapturedPose {
  poseId: PoseId;
  blob: Blob;
  thumbnailUrl: string;
  timestamp: number;
  /** PNG aplati cliché + maillage + guides ovale (hors analyse). */
  annotatedOvalGuideBlob?: Blob;
  annotatedOvalGuideThumbnailUrl?: string;
  /** PNG aplati cliché + maillage + guides nez/bouche (hors analyse). */
  annotatedNoseMouthGuideBlob?: Blob;
  annotatedNoseMouthGuideThumbnailUrl?: string;
  /** PNG aplati cliché + maillage + médiatrice verticale tiercée yeux/lèvres (hors analyse). */
  annotatedVerticalThirdsGuideBlob?: Blob;
  annotatedVerticalThirdsGuideThumbnailUrl?: string;
  /** PNG aplati profil : cliché + masque + arc mâchoire bleu (hors analyse). */
  annotatedProfileJawGuideBlob?: Blob;
  annotatedProfileJawGuideThumbnailUrl?: string;
  /** PNG aplati menton levé : cliché + masque + arc mandibulaire bas (hors analyse). */
  annotatedJawUpLowerArcGuideBlob?: Blob;
  annotatedJawUpLowerArcGuideThumbnailUrl?: string;
  /** PNG aplati sommet du crâne : photo miroir seule, sans masque (hors analyse). */
  annotatedCrownPhotoFlatBlob?: Blob;
  annotatedCrownPhotoFlatThumbnailUrl?: string;
  /** PNG aplati sourire : cliché + masque + contours lèvres (hors analyse). */
  annotatedSmileLipsGuideBlob?: Blob;
  annotatedSmileLipsGuideThumbnailUrl?: string;
}

export interface AdminCaptureDebugPayload {
  poseId: PoseId;
  blob: Blob;
  thumbnailUrl: string;
  landmarks: LandmarkPoint[];
  sourceVideoWidth: number;
  sourceVideoHeight: number;
  outputWidth: number;
  outputHeight: number;
  annotatedOvalGuideThumbnailUrl?: string;
  annotatedNoseMouthGuideThumbnailUrl?: string;
  annotatedVerticalThirdsGuideThumbnailUrl?: string;
  annotatedProfileJawGuideThumbnailUrl?: string;
  annotatedJawUpLowerArcGuideThumbnailUrl?: string;
  annotatedCrownPhotoFlatThumbnailUrl?: string;
  annotatedSmileLipsGuideThumbnailUrl?: string;
}

export type CaptureSessionEvent =
  | { type: "pose_captured"; poseId: PoseId; blob: Blob }
  /** Déclenchement synchrone : la UI peut passer en `Capturing` sans attendre le poll RAF. */
  | { type: "shutter_started" }
  | { type: "session_complete"; results: CapturedPose[] }
  | { type: "session_error"; error: Error }
  | { type: "admin_capture_debug"; payload: AdminCaptureDebugPayload };


export type CaptureSessionState =
  | "idle"
  | "Initializing"
  | "AwaitFace"
  | "Aligning"
  | "Holding"
  | "Capturing"
  | "Cooldown"
  | "NextPose"
  | "AdminPoseReview"
  | "Done"
  | "error";

export type CaptureSessionCallback = (event: CaptureSessionEvent) => void;

const DEFAULT_CONFIG: CaptureSessionConfig = {
  poseTimeout: 20000,
  captureQuality: 0.95,
  mediaPipeTargetFps: 60,
  cooldownMs: 300,
  holdFrames: 18,
};

/**
 * After session start, pause alignment / hold on the first frontal pose so:
 *   1. the user can settle in front of the camera ;
 *   2. **l'auto-exposition / balance des blancs de la caméra a le temps de
 *      se stabiliser**. Sur mobile, l'AE met typiquement 1.5–2 s à converger
 *      après ouverture du flux ; capturer plus tôt produit une image
 *      visiblement plus sombre que les suivantes (le cas typique : « photo 1
 *      de face plus sombre que les autres »). 2.5 s couvre la grande majorité
 *      des téléphones sans rallonger artificiellement les autres poses.
 */
const FIRST_POSE_WARMUP_MS = 2500;

export class CaptureSession {
  private readonly camera = new CameraManager();
  private readonly detector = new FaceDetector();
  private readonly validator = new PoseValidator();
  private readonly maskRenderer = new MaskRenderer();
  /**
   * Motion-tracking window. Kept for diagnostics / hint logic; hold
   * interruption no longer relies on instantaneous angular speed.
   */
  private readonly motion = new MotionTracker(400);
  /**
   * Hold-interruption : pendant le hold la barre accumule encore malgré une
   * validation « pas ready » ponctuelle, sauf dans les cas suivants :
   *   - **Grande rotation depuis le verrou** : |Δyaw| ou |Δroll| forts
   *     (sans pitch — le pitch est traité séparément pour menton levé /
   *     sommet du crâne, voir seuils ci-dessous).
   *
   * **Poses sans extrapolation** (face, la plupart des gros plans) : plusieurs
   * frames d’affilée hors validation « ready » annulent le hold — sinon un
   * frontal peut dériver hors du cadre ±10° tout en restant sous le plafond
   * |Δyaw| 30° depuis le début du hold. **Exception** `closeup-smile` : pas
   * de série sur validation (blendshapes instables même immobile) ; l’interrupt
   * yaw/roll reste actif ; la tête qui part sur le côté déclenchera encore
   * l’abandon une fois Δyaw assez grand.
   *
   * **Profils** : la perte de visage reste gérée par extrapolation / grace ;
   * en revanche un retour volontaire face caméra (|yaw| dans une bande
   * neutre, disjointe du profil ≥40°) annule le hold après quelques frames.
   *
   * **Menton levé / sommet du crâne** : suivi pitch dédié (retour hors
   * consigne) ; pas d’extrapolation **pendant** le hold sinon la perte de
   * visage en fin de mouvement fige la pose et la capture part quand même.
   */
  private readonly holdInterruptYawDeg = 30;
  private readonly holdInterruptRollDeg = 10;
  /**
   * Poses type frontal / closeup : frames consécutives hors consigne avant
   * d’interrompre (lissage bruit MediaPipe).
   */
  private readonly holdLostPoseStreakToAbort = 4;
  /**
   * Seuil |yaw| « face au centre » plus bas que le bord profil (40°) pour
   * éviter les faux positifs sur la limite de détection.
   */
  private readonly profileReturnNeutralAbsYawDeg = 20;
  private readonly profileReturnCenterStreakToAbort = 3;
  /**
   * jaw-up (`pitch ∈ [-90,-20]` en convention actuelle) : au-dessus de ce seuil,
   * on n’est plus en « menton levé » acceptable.
   */
  private readonly jawUpPitchAbortAbove = -17;
  /** Baisse de menton depuis le début du hold (pitch qui monte vers 0). */
  private readonly jawUpPitchDropFromLockDeg = 11;
  /** crown-down : retour trop « face neutre » (pitch hors plage basse). */
  /** Abandon du hold crown-down si pitch < 20 (trop remonté). Plage valide min = 23°. */
  private readonly crownDownPitchAbortBelow = 20;
  /** Remontée de tête depuis le verrou (pitch qui descend). */
  private readonly crownDownPitchRiseFromLockDeg = 11;
  private readonly pitchDriftStreakToAbort = 4;
  private holdPoseLostStreak = 0;
  private profileReturningCenterStreak = 0;
  private pitchDriftAbandonStreak = 0;
  private readonly config: CaptureSessionConfig;
  /** Définitions effectives des poses pour cette session (peut diverger sur bureau vs mobile). */
  private readonly poses: readonly PoseDefinition[];

  private callback: CaptureSessionCallback | null = null;
  private state: CaptureSessionState = "idle";
  private poseStates: PoseSessionState[] = [];
  private currentPoseIndex = 0;
  private capturedPoses: CapturedPose[] = [];
  private lastValidation: PoseValidation | null = null;
  private lastHeadPose: HeadPose | null = null;
  /**
   * Head pose snapshot at the moment the hold started. We compare every
   * subsequent frame's yaw/roll to this anchor to detect deliberate
   * pose-change motion (see `holdInterruptYawDeg` / `holdInterruptRollDeg`).
   */
  private holdStartHeadPose: HeadPose | null = null;
  /**
   * Face-loss grace deadline. ONLY armed when the face disappears mid-hold
   * (no MediaPipe detection AND no extrapolation possible). Within this
   * window we keep the holding visual frozen instead of resetting; past it
   * we go back to AwaitFace.
   */
  private faceLossGraceUntil: number | null = null;
  private readonly faceLossGraceMs = 1500;
  /**
   * Last successfully detected head pose / landmarks / blendshapes, kept
   * across face-loss frames. Used both for contextual hints AND for pose
   * extrapolation: if MediaPipe loses the face while the user was already in
   * a valid extreme pose, we synthesize a FaceFrame from the cached data so
   * the hold completes and the actual camera frame (over-rotated) gets
   * captured.
   */
  private lastSeenHeadPose: HeadPose | null = null;
  private lastSeenLandmarks: LandmarkPoint[] | null = null;
  private lastSeenBlendshapes: Record<string, number> | null = null;
  private lastSeenAt = 0;
  /**
   * Maximum time we extrapolate from the last good frame after MediaPipe loses
   * the face. Long enough to complete a 2s hold that started 0–500 ms before
   * loss, short enough to fail safe if the user actually walked away.
   */
  private readonly extrapolationMaxMs = 2200;
  private faceInView = false;
  private holdStartAt: number | null = null;
  private holdProgress = 0;
  private cooldownUntil = 0;
  /**
   * True from commit-to-capture until the blob is obtained (or capture fails).
   * Unlike the old immediate lock, we still run landmark-driven mask updates
   * so the overlay does not freeze during exposure wait / takePhoto.
   */
  private captureAwaitingShot = false;
  /**
   * True pendant `encodeAdminGuideFlattenedPair` (souvent lent) : masque toujours piloté
   * par les landmarks alors que la pose est déjà `captured`, sans `processFrame`.
   */
  private captureFinalizeEncodeBusy = false;
  /** Évite plusieurs `captureCurrentPose` pendant que le hold reste ≥ fin (répète le scan bar / sensation « deux clichés »). */
  private holdCompletionCaptureScheduled = false;
  /** Seuil commun pour payloads (JPEG + landmarks appariés côté admin). */
  private static readonly MIN_LANDMARKS_FOR_PAYLOAD = 100;
  private transitionPoseId: PoseId | null = null;
  private transitionThumbnailUrl: string | null = null;
  /** `performance.now()` threshold; until then, first frontal pose skips strict validation (see `FIRST_POSE_WARMUP_MS`). */
  private sessionWarmupUntil = 0;
  /** Suit `requirePullBackBeforeAlign` (ex. hairline après œil). */
  private pullbackGatePoseIndex = -1;
  private pullbackStableStreak = 0;
  private pullbackGateSatisfied = true;

  /** Pose index récemment capturée pendant que l’admin valide le debug visuel. */
  private adminPausedCompletedIdx: number | null = null;

  private videoEl: HTMLVideoElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private guideOverlayCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private frameCbHandle: number | null = null;
  private lastFrameAt = 0;
  private readonly frameIntervalMs: number;

  constructor(config: Partial<CaptureSessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.poses = config.capturePoses ?? CAPTURE_POSES;
    const fps = Math.min(60, Math.max(15, this.config.mediaPipeTargetFps ?? 60));
    this.frameIntervalMs = 1000 / fps;
  }

  onEvent(cb: CaptureSessionCallback): void {
    this.callback = cb;
  }

  async init(
    videoEl: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement,
    guideOverlayCanvas?: HTMLCanvasElement | null,
  ): Promise<void> {
    this.state = "Initializing";
    this.videoEl = videoEl;
    this.overlayCanvas = overlayCanvas;
    this.guideOverlayCanvas = guideOverlayCanvas ?? null;
    await this.camera.start(videoEl);
    this.maskRenderer.init(overlayCanvas);
    await this.detector.init((landmarks, _world, pose, blendshapes) => {
      this.onLandmarks(landmarks, pose, blendshapes);
    });
    this.initPoseStates();
    this.state = "idle";
  }

  async start(): Promise<void> {
    if (this.state !== "idle" && this.state !== "Done") return;
    this.currentPoseIndex = 0;
    this.capturedPoses = [];
    this.faceInView = false;
    this.lastValidation = null;
    this.lastHeadPose = null;
    this.lastSeenHeadPose = null;
    this.lastSeenLandmarks = null;
    this.lastSeenBlendshapes = null;
    this.lastSeenAt = 0;
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.cooldownUntil = 0;
    this.captureAwaitingShot = false;
    this.captureFinalizeEncodeBusy = false;
    this.holdCompletionCaptureScheduled = false;
    this.transitionPoseId = null;
    this.transitionThumbnailUrl = null;
    this.pullbackGatePoseIndex = -1;
    this.pullbackStableStreak = 0;
    this.pullbackGateSatisfied = true;
    this.sessionWarmupUntil = performance.now() + FIRST_POSE_WARMUP_MS;
    this.motion.reset();
    this.resetHoldGestureStreaks();
    this.initPoseStates();
    this.state = "AwaitFace";
    this.scheduleSendLoop();
  }

  stop(): void {
    this.cancelSendLoop();
    this.camera.stop();
    this.detector.destroy();
    this.maskRenderer.dispose();
    this.clearGuideOverlayCanvas();
    this.adminPausedCompletedIdx = null;
    this.state = "idle";
  }

  getState(): CaptureSessionState {
    return this.state;
  }
  getCurrentPose(): PoseSessionState | null {
    return this.poseStates[this.currentPoseIndex] ?? null;
  }
  getAllPoseStates(): PoseSessionState[] {
    return this.poseStates;
  }
  getLastValidation(): PoseValidation | null {
    return this.lastValidation;
  }
  getLastHeadPose(): HeadPose | null {
    return this.lastHeadPose;
  }
  getFaceInView(): boolean {
    return this.faceInView;
  }
  getCapturedCount(): number {
    return this.capturedPoses.length;
  }
  getCapturedPoses(): CapturedPose[] {
    return this.capturedPoses;
  }
  getVideoEl(): HTMLVideoElement | null {
    return this.videoEl;
  }
  getOverlayCanvas(): HTMLCanvasElement | null {
    return this.overlayCanvas;
  }
  getActiveCameraDeviceId(): string | undefined {
    return this.camera.getActiveDeviceId();
  }
  getHoldProgress(): number {
    return this.holdProgress;
  }
  getTransitionPoseId(): PoseId | null {
    return this.transitionPoseId;
  }
  getTransitionThumbnailUrl(): string | null {
    return this.transitionThumbnailUrl;
  }

  async switchCamera(deviceId: string | undefined): Promise<void> {
    if (!this.videoEl) throw new Error("No video element");
    await this.camera.switchDevice(deviceId, this.videoEl);
  }

  private initPoseStates(): void {
    this.poseStates = this.poses.map((pose, index) => ({
      poseId: pose.id,
      index,
      state: "pending",
      validation: {
        poseId: pose.id,
        status: "invalid",
        score: 0,
        reasons: [],
        confidence: 0,
      },
    }));
  }

  private resetHoldGestureStreaks(): void {
    this.holdPoseLostStreak = 0;
    this.profileReturningCenterStreak = 0;
    this.pitchDriftAbandonStreak = 0;
  }

  private scheduleSendLoop(): void {
    const video = this.videoEl;
    if (!video) return;
    this.cancelSendLoop();
    if (typeof video.requestVideoFrameCallback === "function") {
      const onFrame: VideoFrameRequestCallback = () => {
        if (this.state === "idle" || this.state === "Done" || this.state === "error") return;
        const now = performance.now();
        if (video.readyState >= 2 && now - this.lastFrameAt >= this.frameIntervalMs) {
          this.lastFrameAt = now;
          this.detector.sendFrame(video);
        }
        this.frameCbHandle = video.requestVideoFrameCallback(onFrame);
      };
      this.frameCbHandle = video.requestVideoFrameCallback(onFrame);
      return;
    }
    const tick = (now: number) => {
      if (this.state === "idle" || this.state === "Done" || this.state === "error") return;
      if (video.readyState >= 2 && now - this.lastFrameAt >= this.frameIntervalMs) {
        this.lastFrameAt = now;
        this.detector.sendFrame(video);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private cancelSendLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const video = this.videoEl;
    if (
      this.frameCbHandle !== null &&
      video &&
      typeof video.cancelVideoFrameCallback === "function"
    ) {
      video.cancelVideoFrameCallback(this.frameCbHandle);
    }
    this.frameCbHandle = null;
  }

  private clearGuideOverlayCanvas(): void {
    const g = this.guideOverlayCanvas;
    if (!g) return;
    const ctx = g.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, g.width, g.height);
  }

  /** Repères bleus (canvas 2D) — alignés sur MaskRenderer.previewCover après flip CSS selfie. */
  private paintPoseGuideLayers(
    landmarks: LandmarkPoint[],
    vw: number,
    vh: number,
    poseId: PoseId,
  ): void {
    const g = this.guideOverlayCanvas;
    if (!g || !this.videoEl) return;
    const ew = this.videoEl.clientWidth || 1;
    const eh = this.videoEl.clientHeight || 1;
    const pr =
      typeof window !== "undefined"
        ? Math.min(window.devicePixelRatio ?? 1, 1.25)
        : 1;
    const bw = Math.max(2, Math.round(ew * pr));
    const bh = Math.max(2, Math.round(eh * pr));
    if (g.width !== bw || g.height !== bh) {
      g.width = bw;
      g.height = bh;
    }
    g.style.width = `${ew}px`;
    g.style.height = `${eh}px`;
    const ctx = g.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, ew, eh);
    drawLiveColoredPoseGuidesOnOverlayCanvas(ctx, landmarks, vw, vh, ew, eh, poseId);
  }

  /**
   * Masque WebGL (optionnel selon pose) + calque 2D pour les poses « repères bleus seuls ».
   * Barre de scan : inchangée (vert) ; maillage blanc : réactivable via {@link DEBUG_CAPTURE_WHITE_FACE_MESH}.
   */
  private renderPoseOverlays(
    frame: FaceFrame,
    poseDef: PoseDefinition,
    isExtrapolated: boolean,
    alignmentQuality: number,
  ): void {
    if (!this.videoEl) return;
    const vw = frame.frameWidth;
    const vh = frame.frameHeight;
    const ew = this.videoEl.clientWidth || 1;
    const eh = this.videoEl.clientHeight || 1;

    const hideWireMesh =
      posesWithColoredGuideLinesOnly(poseDef.id) && !DEBUG_CAPTURE_WHITE_FACE_MESH;

    if (isExtrapolated) {
      this.maskRenderer.clear();
      this.clearGuideOverlayCanvas();
      return;
    }

    this.maskRenderer.setAlignmentQuality(alignmentQuality);

    if (this.state === "Holding") {
      this.maskRenderer.render(frame.landmarks, vw, vh, ew, eh, {
        holdingProgress: this.holdProgress,
        hideFaceOverlay: hideWireMesh,
      });
    } else {
      this.maskRenderer.render(frame.landmarks, vw, vh, ew, eh, {
        hideFaceOverlay: hideWireMesh,
      });
    }

    if (hideWireMesh) {
      this.paintPoseGuideLayers(frame.landmarks, vw, vh, poseDef.id);
    } else {
      this.clearGuideOverlayCanvas();
    }
  }

  private onLandmarks(
    landmarks: LandmarkPoint[],
    pose: HeadPose,
    blendshapes: Record<string, number>,
  ): void {
    if (!this.videoEl || this.state === "idle" || this.state === "Done" || this.state === "error") return;

    if (this.state === "AdminPoseReview") {
      this.maskRenderer.clear();
      this.clearGuideOverlayCanvas();
      return;
    }

    if (this.captureFinalizeEncodeBusy) {
      this.state = "Capturing";
      const now = performance.now();
      let frameForMask: FaceFrame | null = null;
      if (landmarks.length > 0) {
        this.faceInView = true;
        this.lastHeadPose = pose;
        this.lastSeenHeadPose = pose;
        this.lastSeenLandmarks = landmarks;
        this.lastSeenBlendshapes = blendshapes;
        this.lastSeenAt = now;
        frameForMask = {
          timestamp: now,
          landmarks,
          headPose: pose,
          confidence: this.computeConfidence(landmarks),
          frameWidth: this.videoEl.videoWidth || this.videoEl.clientWidth || 1,
          frameHeight: this.videoEl.videoHeight || this.videoEl.clientHeight || 1,
          blendshapes,
        };
      } else {
        const extrapolated = this.tryBuildExtrapolatedFrame(now);
        if (extrapolated) {
          this.faceInView = true;
          frameForMask = extrapolated;
        }
      }
      if (frameForMask) this.renderMaskDuringCaptureAwait(frameForMask);
      return;
    }

    if (this.captureAwaitingShot) {
      this.state = "Capturing";
      if (landmarks.length > 0) {
        const now = performance.now();
        this.faceInView = true;
        this.lastHeadPose = pose;
        this.lastSeenHeadPose = pose;
        this.lastSeenLandmarks = landmarks;
        this.lastSeenBlendshapes = blendshapes;
        this.lastSeenAt = now;
        this.motion.push(now, pose);

        const frame: FaceFrame = {
          timestamp: now,
          landmarks,
          headPose: pose,
          confidence: this.computeConfidence(landmarks),
          frameWidth: this.videoEl.videoWidth || this.videoEl.clientWidth || 1,
          frameHeight: this.videoEl.videoHeight || this.videoEl.clientHeight || 1,
          blendshapes,
        };
        this.renderMaskDuringCaptureAwait(frame);
      }
      return;
    }

    /**
     * Une fois la pose marquée `captured`, ne plus appeler `processFrame` jusqu’à
     * finalize / admin — sinon pendant `await encodeAdminGuideFlattenedPair` la FSM
     * relançait un hold → barre / analyse visuelle deux fois (voir garde dédiée
     * `captureFinalizeEncodeBusy` pour garder le masque vivant sans `processFrame`).
     */
    if (this.poseStates[this.currentPoseIndex]?.state === "captured") {
      return;
    }

    const now = performance.now();

    if (now < this.cooldownUntil) {
      this.state = "Cooldown";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.holdCompletionCaptureScheduled = false;
      this.resetHoldGestureStreaks();
      this.motion.reset();
      return;
    }

    if (landmarks.length > 0) {
      this.faceInView = true;
      this.lastHeadPose = pose;
      this.lastSeenHeadPose = pose;
      this.lastSeenLandmarks = landmarks;
      this.lastSeenBlendshapes = blendshapes;
      this.lastSeenAt = now;
      this.motion.push(now, pose);

      this.processFrame(
        {
          timestamp: now,
          landmarks,
          headPose: pose,
          confidence: this.computeConfidence(landmarks),
          frameWidth: this.videoEl.videoWidth || this.videoEl.clientWidth || 1,
          frameHeight: this.videoEl.videoHeight || this.videoEl.clientHeight || 1,
          blendshapes,
        },
        false,
      );
      return;
    }

    /**
     * Try extrapolation first: if we can synthesize a frame from the last
     * good detection (directional poses, within `extrapolationMaxMs`), we
     * keep behaving as if the face is in view so the UI doesn't flash the
     * "no face" overlay over the flash border, and the hold continues to
     * completion.
     */
    const extrapolated = this.tryBuildExtrapolatedFrame(now);
    if (extrapolated) {
      this.faceInView = true;
      this.lastHeadPose = extrapolated.headPose;
      this.processFrame(extrapolated, true);
      return;
    }

    /**
     * Face-loss grace fallback: if we were already in Holding when the
     * face dropped out (and extrapolation isn't applicable — non-directional
     * pose, or last-seen too old), we keep `state = Holding` for up to
     * `faceLossGraceMs`. During that window the white flash border stays on,
     * `holdProgress` is frozen, and if the face comes back the hold resumes
     * from where it was. Past the grace, we hard-reset to AwaitFace.
     */
    if (this.state === "Holding" && this.holdStartAt !== null) {
      if (this.faceLossGraceUntil === null) {
        this.faceLossGraceUntil = now + this.faceLossGraceMs;
      }
      if (now < this.faceLossGraceUntil) {
        this.faceInView = true;
        this.maskRenderer.clear();
        this.clearGuideOverlayCanvas();
        return;
      }
    }

    this.faceInView = false;
    this.lastHeadPose = null;

    const currentPoseId = this.poses[this.currentPoseIndex]!.id;
    this.lastValidation = {
      poseId: currentPoseId,
      status: "invalid",
      score: 0,
      reasons: this.contextualLossReasons(currentPoseId, now),
      confidence: 0,
    };
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.holdCompletionCaptureScheduled = false;
    this.faceLossGraceUntil = null;
    this.resetHoldGestureStreaks();
    this.motion.reset();
    this.state = "AwaitFace";
    this.maskRenderer.clear();
    this.clearGuideOverlayCanvas();
  }

  /**
   * Single processing pipeline for both live frames and extrapolated frames.
   * When `isExtrapolated` is true, we skip the motion-stability gate (no
   * recent live samples to reason about — and the very fact MediaPipe lost
   * the face means the user pushed past detection limits, which is exactly
   * what we want to capture). L’overlay masque est aussi masqué car les
   * landmarks en cache ne correspondent plus au flux caméra.
   */
  private processFrame(frame: FaceFrame, isExtrapolated: boolean): void {
    if (!this.videoEl) return;
    if (this.state === "AdminPoseReview") return;

    const curPoseState = this.poseStates[this.currentPoseIndex];
    if (curPoseState?.state === "captured") return;

    const poseDef = this.poses[this.currentPoseIndex]!;
    const inFirstPoseWarmup =
      this.currentPoseIndex === 0 &&
      poseDef.id === "frontal" &&
      frame.timestamp < this.sessionWarmupUntil;

    if (inFirstPoseWarmup) {
      this.state = "AwaitFace";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.holdCompletionCaptureScheduled = false;
      this.faceLossGraceUntil = null;
      this.resetHoldGestureStreaks();
      this.poseStates[0]!.state = "pending";
      const warmupValidation: PoseValidation = {
        poseId: "frontal",
        status: "invalid",
        score: 0,
        reasons: [],
        confidence: frame.confidence,
      };
      this.lastValidation = warmupValidation;
      this.poseStates[0]!.validation = warmupValidation;
      if (isExtrapolated) {
        this.maskRenderer.clear();
        this.clearGuideOverlayCanvas();
      } else {
        this.renderPoseOverlays(frame, poseDef, false, 0);
      }
      return;
    }

    if (this.currentPoseIndex !== this.pullbackGatePoseIndex) {
      this.pullbackGatePoseIndex = this.currentPoseIndex;
      this.pullbackStableStreak = 0;
      this.pullbackGateSatisfied = !poseDef.requirePullBackBeforeAlign;
    }

    if (
      poseDef.requirePullBackBeforeAlign &&
      !this.pullbackGateSatisfied &&
      !isExtrapolated
    ) {
      const cfg = poseDef.requirePullBackBeforeAlign;
      const fr = faceRatio(frame);
      const minStable = cfg.minStableFrames ?? 12;
      if (fr < cfg.maxFaceRatio && fr > 0.02) {
        this.pullbackStableStreak += 1;
        if (this.pullbackStableStreak >= minStable) {
          this.pullbackGateSatisfied = true;
        }
      } else {
        this.pullbackStableStreak = 0;
      }
    }

    /**
     * Once the hold has started for this pose, ask strategies to evaluate
     * with looser tolerance: this avoids kicking the user out on transient
     * detection wobble (especially for zoomed-in poses like the hairline,
     * where MediaPipe is less stable). We pass `holding=false` for the
     * very first ready frame so the entry criteria stay strict.
     */
    const holding = this.holdStartAt !== null;
    const validation = this.validator.validate(frame, poseDef, {
      holding,
      pullBackSatisfied: this.pullbackGateSatisfied,
    });
    this.lastValidation = validation;
    this.poseStates[this.currentPoseIndex]!.validation = validation;

    const ready = validation.status === "ready";
    /**
     * Interruption pendant le hold :
     *   - |Δyaw| / |Δroll| depuis le verrou (seuils fixes) ;
     *   - poses sans extrapolation : plusieurs frames d’affilée hors consigne
     *     (validation ≠ ready) ;
     *   - profil : retour face caméra (|yaw| dans une bande neutre sous le
     *     profil requis), pour annuler si l’utilisateur abandonne le geste.
     *   - menton levé / sommet : dérive hors plage ou retour évident vers une
     *     tête trop « neutre » en pitch (frames live uniquement ; pas d’exo
     *     pendant le hold pour ces deux-là — voir `tryBuildExtrapolatedFrame`).
     */
    let bigMovementInterrupt = false;
    if (this.holdStartAt !== null && this.holdStartHeadPose) {
      const dyaw = Math.abs(frame.headPose.yaw - this.holdStartHeadPose.yaw);
      const droll = Math.abs(frame.headPose.roll - this.holdStartHeadPose.roll);
      if (dyaw > this.holdInterruptYawDeg || droll > this.holdInterruptRollDeg) {
        bigMovementInterrupt = true;
      }
    }

    let abandonHoldGesture = bigMovementInterrupt;
    if (
      this.holdStartAt !== null &&
      !isExtrapolated &&
      !bigMovementInterrupt
    ) {
      if (!this.canExtrapolatePose(poseDef.id)) {
        const usePoseLostStreak = poseDef.id !== "closeup-smile";
        if (usePoseLostStreak) {
          if (!ready) {
            this.holdPoseLostStreak += 1;
            if (this.holdPoseLostStreak >= this.holdLostPoseStreakToAbort) {
              abandonHoldGesture = true;
            }
          } else {
            this.holdPoseLostStreak = 0;
          }
        } else {
          this.holdPoseLostStreak = 0;
        }
        this.profileReturningCenterStreak = 0;
        this.pitchDriftAbandonStreak = 0;
      } else if (poseDef.id === "profile-right" || poseDef.id === "profile-left") {
        if (Math.abs(frame.headPose.yaw) <= this.profileReturnNeutralAbsYawDeg) {
          this.profileReturningCenterStreak += 1;
          if (this.profileReturningCenterStreak >= this.profileReturnCenterStreakToAbort) {
            abandonHoldGesture = true;
          }
        } else {
          this.profileReturningCenterStreak = 0;
        }
        this.holdPoseLostStreak = 0;
        this.pitchDriftAbandonStreak = 0;
      } else if (poseDef.id === "jaw-up" || poseDef.id === "crown-down") {
        this.holdPoseLostStreak = 0;
        this.profileReturningCenterStreak = 0;

        let pitchDriftSuspect = false;
        if (this.holdStartHeadPose) {
          if (poseDef.id === "jaw-up") {
            const dp = frame.headPose.pitch - this.holdStartHeadPose.pitch;
            pitchDriftSuspect =
              frame.headPose.pitch > this.jawUpPitchAbortAbove ||
              dp > this.jawUpPitchDropFromLockDeg;
          } else {
            const dp = frame.headPose.pitch - this.holdStartHeadPose.pitch;
            pitchDriftSuspect =
              frame.headPose.pitch < this.crownDownPitchAbortBelow ||
              dp < -this.crownDownPitchRiseFromLockDeg;
          }
        }
        if (pitchDriftSuspect) {
          this.pitchDriftAbandonStreak += 1;
          if (this.pitchDriftAbandonStreak >= this.pitchDriftStreakToAbort) {
            abandonHoldGesture = true;
          }
        } else {
          this.pitchDriftAbandonStreak = 0;
        }
      } else {
        this.holdPoseLostStreak = 0;
        this.profileReturningCenterStreak = 0;
        this.pitchDriftAbandonStreak = 0;
      }
    }

    let triggerCapture = false;

    if (abandonHoldGesture) {
      this.resetHoldGestureStreaks();
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.holdCompletionCaptureScheduled = false;
      this.faceLossGraceUntil = null;
      this.state = "Aligning";
      this.poseStates[this.currentPoseIndex]!.state = "aligning";
    } else if (this.holdStartAt !== null) {
      /**
       * Already holding: progress selon la pose ; abandons via les règles
       * ci-dessus (profil, pitch jaw/crown, validation poses sans exo, etc.)
       * ou capture.
       */
      this.faceLossGraceUntil = null;
      this.state = "Holding";
      this.poseStates[this.currentPoseIndex]!.state = "holding";
      const holdMs = poseDef.holdMs || ((this.config.holdFrames ?? 18) * this.frameIntervalMs);
      this.holdProgress = Math.max(0, Math.min(1, (frame.timestamp - this.holdStartAt) / holdMs));
      const triggerSoon = this.holdProgress >= 1;
      if (triggerSoon && !this.holdCompletionCaptureScheduled) {
        this.holdCompletionCaptureScheduled = true;
        triggerCapture = true;
      }
    } else if (ready) {
      this.resetHoldGestureStreaks();
      this.holdCompletionCaptureScheduled = false;
      this.holdStartAt = frame.timestamp;
      this.holdStartHeadPose = frame.headPose;
      this.faceLossGraceUntil = null;
      this.state = "Holding";
      this.poseStates[this.currentPoseIndex]!.state = "holding";
      const holdMs = poseDef.holdMs || ((this.config.holdFrames ?? 18) * this.frameIntervalMs);
      this.holdProgress = Math.max(0, Math.min(1, (frame.timestamp - this.holdStartAt) / holdMs));
      const triggerSoon = this.holdProgress >= 1;
      if (triggerSoon && !this.holdCompletionCaptureScheduled) {
        this.holdCompletionCaptureScheduled = true;
        triggerCapture = true;
      }
    } else {
      this.state = "Aligning";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.holdCompletionCaptureScheduled = false;
      this.resetHoldGestureStreaks();
      this.poseStates[this.currentPoseIndex]!.state = "aligning";
    }

    /**
     * Rendu : maillage ovale debug (réactivable) ou repères 2D bleu clair seuls selon pose ;
     * barre de scan en Holding. En extrapolation, on vide l’overlay.
     */
    if (isExtrapolated) {
      this.maskRenderer.clear();
      this.clearGuideOverlayCanvas();
    } else {
      this.renderPoseOverlays(frame, poseDef, false, validation.score);
    }

    if (triggerCapture) {
      void this.captureCurrentPose();
    }
  }

  /**
   * Build a synthetic FaceFrame from the last successfully detected frame,
   * usable when MediaPipe momentarily loses the face during a directional
   * pose (profile / jaw / crown). Returns null when extrapolation isn't
   * appropriate (wrong pose type, last-seen too old, last-seen wasn't yet in
   * the valid range, no cached data).
   */
  private tryBuildExtrapolatedFrame(now: number): FaceFrame | null {
    if (!this.videoEl) return null;
    if (!this.lastSeenHeadPose || !this.lastSeenLandmarks) return null;
    if (now - this.lastSeenAt > this.extrapolationMaxMs) return null;

    const poseDef = this.poses[this.currentPoseIndex];
    if (!poseDef) return null;
    if (!this.canExtrapolatePose(poseDef.id)) return null;
    /**
     * Pendant le hold sur pitches extrêmes, ne pas extrapoler : sinon un
     * utilisateur qui sort du cadre / relâche la pose après un alignement bon
     * fige encore la vieille pose et la barre aboutit à une capture refusée
     * en pratique par l’analyse ensuite.
     */
    if (
      (poseDef.id === "jaw-up" || poseDef.id === "crown-down") &&
      this.holdStartAt !== null
    ) {
      return null;
    }
    if (!this.lastSeenWasInPoseRange(this.lastSeenHeadPose, poseDef)) return null;

    return {
      timestamp: now,
      landmarks: this.lastSeenLandmarks,
      headPose: this.lastSeenHeadPose,
      confidence: 0.6,
      frameWidth: this.videoEl.videoWidth || this.videoEl.clientWidth || 1,
      frameHeight: this.videoEl.videoHeight || this.videoEl.clientHeight || 1,
      blendshapes: this.lastSeenBlendshapes ?? {},
    };
  }

  private canExtrapolatePose(poseId: PoseId): boolean {
    return (
      poseId === "profile-right" ||
      poseId === "profile-left" ||
      poseId === "jaw-up" ||
      poseId === "crown-down"
    );
  }

  private lastSeenWasInPoseRange(pose: HeadPose, poseDef: PoseDefinition): boolean {
    if (poseDef.id === "profile-right" || poseDef.id === "profile-left") {
      return pose.yaw >= poseDef.yawRange[0] && pose.yaw <= poseDef.yawRange[1];
    }
    if (poseDef.id === "jaw-up" || poseDef.id === "crown-down") {
      return pose.pitch >= poseDef.pitchRange[0] && pose.pitch <= poseDef.pitchRange[1];
    }
    return false;
  }

  resumeAfterAdminPoseReview(): void {
    if (this.state !== "AdminPoseReview" || this.adminPausedCompletedIdx === null) return;
    const idx = this.adminPausedCompletedIdx;
    this.adminPausedCompletedIdx = null;
    this.finalizeAdvanceAfterSuccessfulCapture(idx);
  }

  /**
   * Incrémente pose / cooldown après un cliché réussi (`admin` reprend après pause).
   */
  private finalizeAdvanceAfterSuccessfulCapture(idx: number): void {
    const poseState = this.poseStates[idx]!;
    const blob = [...this.capturedPoses]
      .reverse()
      .find((c) => c.poseId === poseState.poseId)?.blob;
    if (!blob || !poseState.thumbnailUrl) return;

    const cooldownMs = this.config.cooldownMs ?? 300;
    this.transitionPoseId = poseState.poseId;
    this.transitionThumbnailUrl = poseState.thumbnailUrl;
    const nextPoseDef = this.poses[idx + 1];
    const nextPoseEntryDelayMs = nextPoseDef?.entryDelayMs ?? 0;
    const nextPoseWarmupMs =
      nextPoseDef?.id === "frontal"
        ? 1200
        : nextPoseDef?.id === "closeup-smile"
          ? 500
          : 0;
    const transitionMs = Math.max(
      cooldownMs,
      nextPoseEntryDelayMs,
      nextPoseWarmupMs,
    );
    this.cooldownUntil = performance.now() + transitionMs;
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.holdCompletionCaptureScheduled = false;
    this.faceLossGraceUntil = null;
    this.resetHoldGestureStreaks();
    this.currentPoseIndex = idx + 1;
    this.state = "NextPose";

    if (this.currentPoseIndex >= this.poses.length) {
      this.state = "Done";
      this.cancelSendLoop();
      this.callback?.({ type: "pose_captured", poseId: poseState.poseId, blob });
      this.callback?.({ type: "session_complete", results: this.capturedPoses });
      return;
    }

    this.poseStates[this.currentPoseIndex]!.state = "pending";
    this.callback?.({ type: "pose_captured", poseId: poseState.poseId, blob });
  }

  /**
   * Copie des landmarks tout de suite après que `captureFrame` a résolu son promesse,
   * sans await intercalé — évite une détection bien postérieure au JPEG encore basé sur
   * une frame précédente pendant l’encodage (~ordre grandeurs : prise vidéo + pipeline).
   */
  private landmarksSnapshotAfterShutterBlob(): LandmarkPoint[] {
    const src = this.lastSeenLandmarks;
    if (!src || src.length < CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD) return [];
    return src.map(p => ({
      x: p.x,
      y: p.y,
      z: p.z ?? 0,
      visibility: p.visibility,
    }));
  }

  private async captureCurrentPose(): Promise<void> {
    if (!this.videoEl) return;
    const idx = this.currentPoseIndex;
    const poseState = this.poseStates[idx]!;
    if (poseState.state === "capturing" || poseState.state === "captured") return;
    if (performance.now() < this.cooldownUntil) return;

    this.captureAwaitingShot = true;
    poseState.state = "capturing";
    this.state = "Capturing";
    this.callback?.({ type: "shutter_started" });
    /**
     * Quality gate is intentionally NOT used as a hard reject here: by the
     * time we reach this code path the user has already held the pose for
     * `holdMs` (1.8 s) without triggering a hold abandon (see interrupt rules),
     * so we owe them a capture. A failing quality check that bounces them back to Aligning
     * is exactly the "bar finishes but nothing happens, then restarts"
     * symptom the user reported. We rely on the held-pose stability
     * window itself as the quality signal.
     *
     * **Exception : sous-exposition manifeste sur la 1ʳᵉ pose.** Quand la
     * caméra vient d'ouvrir, l'AE peut ne pas avoir convergé et la frame
     * peut sortir nettement plus sombre que les suivantes. On laisse
     * jusqu'à `EXPOSURE_STABILIZATION_MS` à la caméra pour s'éclaircir
     * avant de capturer ; au-delà, on capture quand même (le hold a déjà
     * été tenu, on ne va pas faire poireauter l'utilisateur indéfiniment).
     *
     * Pour les poses **suivantes**, l'exposition caméra suit déjà le flux depuis
     * plusieurs secondes : on borne beaucoup plus court pour éviter le masque figé trop longtemps (4+1).
     */
    const isFirstExposureCriticalShot =
      poseState.poseId === "frontal" && idx === 0 && this.capturedPoses.length === 0;

    const EXPOSURE_STABILIZATION_MS = isFirstExposureCriticalShot ? 1400 : 380;
    const EXPOSURE_POLL_MS = isFirstExposureCriticalShot ? 100 : 40;
    const MIN_ACCEPTABLE_LUMA = 42;
    const exposureStartedAt = performance.now();
    while (
      this.videoEl &&
      this.videoEl.videoWidth > 0 &&
      performance.now() - exposureStartedAt < EXPOSURE_STABILIZATION_MS
    ) {
      const stats = evaluateFrameQualityForCapture(this.videoEl);
      if (stats.meanLuma >= MIN_ACCEPTABLE_LUMA) break;
      await new Promise((r) => setTimeout(r, EXPOSURE_POLL_MS));
    }

    const settleDelayMs = isFirstExposureCriticalShot ? 52 : 18;
    if (this.videoEl?.videoWidth && this.videoEl.videoHeight) {
      await new Promise((r) => setTimeout(r, settleDelayMs));
    }

    const cooldownMs = this.config.cooldownMs ?? 300;
    /** Pre-arm cooldown BEFORE the async takePhoto so subsequent frames can't sneak past. */
    this.cooldownUntil = performance.now() + cooldownMs;
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.faceLossGraceUntil = null;
    this.resetHoldGestureStreaks();

    let lmSnap: LandmarkPoint[] = [];
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4 && !blob; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 45 * attempt));
      }
      blob = await this.camera.captureFrame(() => {
        if (!this.videoEl) return;
        /**
         * Même photogramme que le `drawImage` du JPEG : avant, on lisait `lastSeen`
         * après `await toBlob` — plusieurs frames pouvaient s’écouler ; cliché en profil
         * + landmarks encore « de face » (masque fantôme décalé sur l’aplati admin).
         */
        this.detector.sendFrame(this.videoEl);
        const snap = this.landmarksSnapshotAfterShutterBlob();
        if (snap.length >= CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD) {
          lmSnap = snap;
        }
      });
    }
    if (!blob) {
      poseState.state = "aligning";
      this.state = "Aligning";
      this.cooldownUntil = 0;
      this.captureAwaitingShot = false;
      this.holdCompletionCaptureScheduled = false;
      return;
    }

    if (lmSnap.length < CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD) {
      const fallback = this.landmarksSnapshotAfterShutterBlob();
      if (fallback.length >= CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD) {
        lmSnap = fallback;
      }
    }

    /** Fin du blocage overlay : fichier obtenu, on quitte avant la mutation d’état suivante. */
    this.captureAwaitingShot = false;

    const vw = this.videoEl.videoWidth || this.videoEl.clientWidth || 1;
    const vh = this.videoEl.videoHeight || this.videoEl.clientHeight || 1;
    const jpegDims = jpegOutputDimensions(vw, vh);

    /** Repères aplatis pour tous les comptes (R2 / `GUIDE_TRACE_*`), pas réservé admin. */
    const shouldEncodeFlattenedGuides =
      lmSnap.length >= CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD &&
      jpegDims.outW >= 64 &&
      jpegDims.outH >= 64;

    if (shouldEncodeFlattenedGuides) {
      this.captureFinalizeEncodeBusy = true;
    }

    const thumbnailUrl = URL.createObjectURL(blob);
    poseState.state = "captured";
    poseState.captureTime = performance.now();
    poseState.thumbnailUrl = thumbnailUrl;

    let annotatedOvalGuideBlob: Blob | undefined;
    let annotatedOvalGuideThumbnailUrl: string | undefined;
    let annotatedNoseMouthGuideBlob: Blob | undefined;
    let annotatedNoseMouthGuideThumbnailUrl: string | undefined;
    let annotatedVerticalThirdsGuideBlob: Blob | undefined;
    let annotatedVerticalThirdsGuideThumbnailUrl: string | undefined;
    let annotatedProfileJawGuideBlob: Blob | undefined;
    let annotatedProfileJawGuideThumbnailUrl: string | undefined;
    let annotatedJawUpLowerArcGuideBlob: Blob | undefined;
    let annotatedJawUpLowerArcGuideThumbnailUrl: string | undefined;
    let annotatedCrownPhotoFlatBlob: Blob | undefined;
    let annotatedCrownPhotoFlatThumbnailUrl: string | undefined;
    let annotatedSmileLipsGuideBlob: Blob | undefined;
    let annotatedSmileLipsGuideThumbnailUrl: string | undefined;

    if (shouldEncodeFlattenedGuides) {
      try {
        const flattened = await encodeAdminGuideFlattenedPair({
          photoBlob: blob,
          landmarks: lmSnap,
          sourceVideoWidth: vw,
          sourceVideoHeight: vh,
          poseId: poseState.poseId,
        });
        if (flattened?.variant === "frontal") {
          annotatedOvalGuideBlob = flattened.ovalFlat;
          annotatedNoseMouthGuideBlob = flattened.noseMouthFlat;
          annotatedVerticalThirdsGuideBlob = flattened.verticalThirdsFlat;
          annotatedOvalGuideThumbnailUrl = URL.createObjectURL(flattened.ovalFlat);
          annotatedNoseMouthGuideThumbnailUrl = URL.createObjectURL(flattened.noseMouthFlat);
          annotatedVerticalThirdsGuideThumbnailUrl = URL.createObjectURL(
            flattened.verticalThirdsFlat,
          );
        } else if (flattened?.variant === "profile") {
          annotatedProfileJawGuideBlob = flattened.profileJawFlat;
          annotatedProfileJawGuideThumbnailUrl = URL.createObjectURL(flattened.profileJawFlat);
        } else if (flattened?.variant === "jawUp") {
          annotatedJawUpLowerArcGuideBlob = flattened.jawLowerArcFlat;
          annotatedJawUpLowerArcGuideThumbnailUrl = URL.createObjectURL(flattened.jawLowerArcFlat);
        } else if (flattened?.variant === "crownPhoto") {
          annotatedCrownPhotoFlatBlob = flattened.photoFlat;
          annotatedCrownPhotoFlatThumbnailUrl = URL.createObjectURL(flattened.photoFlat);
        } else if (flattened?.variant === "smileLips") {
          annotatedSmileLipsGuideBlob = flattened.smileLipsFlat;
          annotatedSmileLipsGuideThumbnailUrl = URL.createObjectURL(flattened.smileLipsFlat);
        }
      } finally {
        this.captureFinalizeEncodeBusy = false;
      }
    }

    const captured: CapturedPose = {
      poseId: poseState.poseId,
      blob,
      thumbnailUrl,
      timestamp: performance.now(),
      ...(annotatedOvalGuideBlob &&
      annotatedNoseMouthGuideBlob &&
      annotatedVerticalThirdsGuideBlob &&
      annotatedOvalGuideThumbnailUrl &&
      annotatedNoseMouthGuideThumbnailUrl &&
      annotatedVerticalThirdsGuideThumbnailUrl
        ? {
            annotatedOvalGuideBlob,
            annotatedNoseMouthGuideBlob,
            annotatedVerticalThirdsGuideBlob,
            annotatedOvalGuideThumbnailUrl,
            annotatedNoseMouthGuideThumbnailUrl,
            annotatedVerticalThirdsGuideThumbnailUrl,
          }
        : {}),
      ...(annotatedProfileJawGuideBlob && annotatedProfileJawGuideThumbnailUrl
        ? {
            annotatedProfileJawGuideBlob,
            annotatedProfileJawGuideThumbnailUrl,
          }
        : {}),
      ...(annotatedJawUpLowerArcGuideBlob && annotatedJawUpLowerArcGuideThumbnailUrl
        ? {
            annotatedJawUpLowerArcGuideBlob,
            annotatedJawUpLowerArcGuideThumbnailUrl,
          }
        : {}),
      ...(annotatedCrownPhotoFlatBlob && annotatedCrownPhotoFlatThumbnailUrl
        ? {
            annotatedCrownPhotoFlatBlob,
            annotatedCrownPhotoFlatThumbnailUrl,
          }
        : {}),
      ...(annotatedSmileLipsGuideBlob && annotatedSmileLipsGuideThumbnailUrl
        ? {
            annotatedSmileLipsGuideBlob,
            annotatedSmileLipsGuideThumbnailUrl,
          }
        : {}),
    };
    this.capturedPoses.push(captured);

    if (typeof console !== "undefined" && this.config.pauseForAdminCaptureReview === true) {
      console.info(
        `[face-capture] captured ${poseState.poseId} | yaw=${this.lastHeadPose?.yaw} pitch=${this.lastHeadPose?.pitch} roll=${this.lastHeadPose?.roll}`,
      );
    }

    if (
      this.config.pauseForAdminCaptureReview === true &&
      lmSnap.length >= CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD &&
      jpegDims.outW >= 64 &&
      jpegDims.outH >= 64
    ) {
      this.adminPausedCompletedIdx = idx;
      this.cooldownUntil = 0;
      this.state = "AdminPoseReview";
      this.maskRenderer.clear();
      this.clearGuideOverlayCanvas();
      this.callback?.({
        type: "admin_capture_debug",
        payload: {
          poseId: poseState.poseId,
          blob,
          thumbnailUrl,
          landmarks: lmSnap,
          sourceVideoWidth: vw,
          sourceVideoHeight: vh,
          outputWidth: jpegDims.outW,
          outputHeight: jpegDims.outH,
          annotatedOvalGuideThumbnailUrl,
          annotatedNoseMouthGuideThumbnailUrl,
          annotatedVerticalThirdsGuideThumbnailUrl,
          annotatedProfileJawGuideThumbnailUrl,
          annotatedJawUpLowerArcGuideThumbnailUrl,
          annotatedCrownPhotoFlatThumbnailUrl,
          annotatedSmileLipsGuideThumbnailUrl,
        },
      });
      return;
    }

    this.finalizeAdvanceAfterSuccessfulCapture(idx);
  }

  /**
   * Masque seulement pendant l’attente exposition / takePhoto : évite de geler
   * l’overlay sans repasser par la FSM (hold, abandon, etc.).
   */
  private renderMaskDuringCaptureAwait(frame: FaceFrame): void {
    if (!this.videoEl) return;
    const poseDef = this.poses[this.currentPoseIndex];
    if (!poseDef) return;

    const validation = this.validator.validate(frame, poseDef, {
      holding: true,
      pullBackSatisfied: this.pullbackGateSatisfied,
    });
    this.lastValidation = validation;
    const ps = this.poseStates[this.currentPoseIndex];
    if (ps) ps.validation = validation;

    this.renderPoseOverlays(frame, poseDef, false, validation.score);
  }

  private computeConfidence(landmarks: LandmarkPoint[]): number {
    const indices = [1, 33, 263, 61, 291, 152];
    const vis =
      indices.reduce((sum, i) => sum + (landmarks[i]?.visibility ?? 0), 0) / indices.length;
    return Math.max(0, Math.min(1, vis));
  }

  /**
   * If the face was visible up to ~1.5 s ago at an extreme angle and we just
   * lost it, MediaPipe most likely dropped the detection past its training
   * envelope (yaw > ±60°, pitch > ~50°). Return a hint nudging the user back
   * into range instead of the bare "no face detected" message.
   */
  private contextualLossReasons(currentPoseId: PoseId, now: number): string[] {
    if (!this.lastSeenHeadPose) return [];
    if (now - this.lastSeenAt > 1500) return [];
    const { yaw, pitch } = this.lastSeenHeadPose;
    if (currentPoseId === "profile-right" || currentPoseId === "profile-left") {
      if (Math.abs(yaw) > 55) return ["Tournez un peu moins fort"];
    }
    if (currentPoseId === "jaw-up" && pitch < -45) {
      return ["Levez le menton un peu moins fort"];
    }
    if (currentPoseId === "crown-down" && pitch > 50) {
      return ["Baissez la tête un peu moins fort"];
    }
    return [];
  }
}
