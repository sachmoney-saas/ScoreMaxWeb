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

export type CaptureSessionEvent =
  | { type: "pose_captured"; poseId: PoseId; blob: Blob }
  | { type: "session_complete"; results: CapturedPose[] }
  | { type: "session_error"; error: Error };

export interface CapturedPose {
  poseId: PoseId;
  blob: Blob;
  thumbnailUrl: string;
  timestamp: number;
}

export type CaptureSessionState =
  | "idle"
  | "Initializing"
  | "AwaitFace"
  | "Aligning"
  | "Holding"
  | "Capturing"
  | "Cooldown"
  | "NextPose"
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

/** After session start, pause alignment / hold on the first frontal pose so the user can settle. */
const FIRST_POSE_WARMUP_MS = 1500;

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
   * Hold-interruption thresholds: once we're holding, the scan bar is NEVER
   * stopped by validation drift, sub-threshold motion, or quality wobble — it
   * is only reset when the user has clearly moved out of the locked pose.
   *
   *   |Δyaw|  > 30°   (deliberate left/right turn — switching to a new pose)
   *   |Δroll| > 10°   (deliberate head tilt that breaks the pose)
   *
   * Pitch is intentionally NOT a hard interrupt: jaw-up / crown-down poses
   * intentionally swing pitch wide, and frontal users tend to nod slightly.
   * Deltas are measured against the head pose at hold start (`holdStartHeadPose`).
   */
  private readonly holdInterruptYawDeg = 30;
  private readonly holdInterruptRollDeg = 10;
  private readonly config: CaptureSessionConfig;

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
  private captureLock = false;
  private transitionPoseId: PoseId | null = null;
  private transitionThumbnailUrl: string | null = null;
  /** `performance.now()` threshold; until then, first frontal pose skips strict validation (see `FIRST_POSE_WARMUP_MS`). */
  private sessionWarmupUntil = 0;

  private videoEl: HTMLVideoElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private frameCbHandle: number | null = null;
  private lastFrameAt = 0;
  private readonly frameIntervalMs: number;

  constructor(config: Partial<CaptureSessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const fps = Math.min(60, Math.max(15, this.config.mediaPipeTargetFps ?? 60));
    this.frameIntervalMs = 1000 / fps;
  }

  onEvent(cb: CaptureSessionCallback): void {
    this.callback = cb;
  }

  async init(videoEl: HTMLVideoElement, overlayCanvas: HTMLCanvasElement): Promise<void> {
    this.state = "Initializing";
    this.videoEl = videoEl;
    this.overlayCanvas = overlayCanvas;
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
    this.captureLock = false;
    this.transitionPoseId = null;
    this.transitionThumbnailUrl = null;
    this.sessionWarmupUntil = performance.now() + FIRST_POSE_WARMUP_MS;
    this.motion.reset();
    this.initPoseStates();
    this.state = "AwaitFace";
    this.scheduleSendLoop();
  }

  stop(): void {
    this.cancelSendLoop();
    this.camera.stop();
    this.detector.destroy();
    this.maskRenderer.dispose();
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
    this.poseStates = CAPTURE_POSES.map((pose, index) => ({
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

  private scheduleSendLoop(): void {
    const video = this.videoEl;
    if (!video) return;
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

  private onLandmarks(
    landmarks: LandmarkPoint[],
    pose: HeadPose,
    blendshapes: Record<string, number>,
  ): void {
    if (!this.videoEl || this.state === "idle" || this.state === "Done" || this.state === "error") return;
    if (this.captureLock) {
      this.state = "Capturing";
      return;
    }
    const now = performance.now();

    if (now < this.cooldownUntil) {
      this.state = "Cooldown";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
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
        return;
      }
    }

    this.faceInView = false;
    this.lastHeadPose = null;

    const currentPoseId = CAPTURE_POSES[this.currentPoseIndex]!.id;
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
    this.faceLossGraceUntil = null;
    this.motion.reset();
    this.state = "AwaitFace";
    this.maskRenderer.clear();
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
    const poseDef = CAPTURE_POSES[this.currentPoseIndex]!;
    const inFirstPoseWarmup =
      this.currentPoseIndex === 0 &&
      poseDef.id === "frontal" &&
      frame.timestamp < this.sessionWarmupUntil;

    if (inFirstPoseWarmup) {
      this.state = "AwaitFace";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.faceLossGraceUntil = null;
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
      } else {
        const vw = frame.frameWidth;
        const vh = frame.frameHeight;
        const ew = this.videoEl.clientWidth || 1;
        const eh = this.videoEl.clientHeight || 1;
        this.maskRenderer.setAlignmentQuality(0);
        this.maskRenderer.render(frame.landmarks, vw, vh, ew, eh);
      }
      return;
    }

    /**
     * Once the hold has started for this pose, ask strategies to evaluate
     * with looser tolerance: this avoids kicking the user out on transient
     * detection wobble (especially for zoomed-in poses like the hairline,
     * where MediaPipe is less stable). We pass `holding=false` for the
     * very first ready frame so the entry criteria stay strict.
     */
    const holding = this.holdStartAt !== null;
    const validation = this.validator.validate(frame, poseDef, { holding });
    this.lastValidation = validation;
    this.poseStates[this.currentPoseIndex]!.validation = validation;

    const ready = validation.status === "ready";
    /**
     * Hold-interruption rule (replaces the old "extreme deg/sec motion +
     * validation grace" combo): once the hold is armed, we ONLY abort if the
     * user has clearly turned away from the locked pose. Concretely, |Δyaw|
     * > 30° or |Δroll| > 10° measured against the head pose at hold start.
     * Pitch is excluded on purpose — jaw-up / crown-down poses can swing
     * pitch wide as the user settles. Extrapolated frames carry the cached
     * head pose, which is by definition stable, so deltas are always 0.
     */
    let bigMovementInterrupt = false;
    if (this.holdStartAt !== null && this.holdStartHeadPose) {
      const dyaw = Math.abs(frame.headPose.yaw - this.holdStartHeadPose.yaw);
      const droll = Math.abs(frame.headPose.roll - this.holdStartHeadPose.roll);
      if (dyaw > this.holdInterruptYawDeg || droll > this.holdInterruptRollDeg) {
        bigMovementInterrupt = true;
      }
    }

    let triggerCapture = false;

    if (bigMovementInterrupt) {
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.faceLossGraceUntil = null;
      this.state = "Aligning";
      this.poseStates[this.currentPoseIndex]!.state = "aligning";
    } else if (this.holdStartAt !== null) {
      /**
       * Already holding: progress accumulates from `holdStartAt` regardless of
       * the per-frame validation status — small drifts, brief MediaPipe
       * wobble, micro-blinks, sub-threshold motion all stay invisible to the
       * user. The scan bar only stops if the user has clearly moved out of
       * the pose (handled above) or completes (triggerCapture).
       */
      this.faceLossGraceUntil = null;
      this.state = "Holding";
      this.poseStates[this.currentPoseIndex]!.state = "holding";
      const holdMs = poseDef.holdMs || ((this.config.holdFrames ?? 18) * this.frameIntervalMs);
      this.holdProgress = Math.max(0, Math.min(1, (frame.timestamp - this.holdStartAt) / holdMs));
      if (this.holdProgress >= 1) {
        triggerCapture = true;
      }
    } else if (ready) {
      this.holdStartAt = frame.timestamp;
      this.holdStartHeadPose = frame.headPose;
      this.faceLossGraceUntil = null;
      this.state = "Holding";
      this.poseStates[this.currentPoseIndex]!.state = "holding";
      const holdMs = poseDef.holdMs || ((this.config.holdFrames ?? 18) * this.frameIntervalMs);
      this.holdProgress = Math.max(0, Math.min(1, (frame.timestamp - this.holdStartAt) / holdMs));
      if (this.holdProgress >= 1) {
        triggerCapture = true;
      }
    } else {
      this.state = "Aligning";
      this.holdStartAt = null;
      this.holdProgress = 0;
      this.holdStartHeadPose = null;
      this.poseStates[this.currentPoseIndex]!.state = "aligning";
    }

    /**
     * Rendu du masque : ovale opaque + maillage / traits intérieurs (~10 %).
     * Barre de scan en phase Holding. En extrapolation, on masque l’overlay.
     */
    if (isExtrapolated) {
      this.maskRenderer.clear();
    } else {
      const vw = frame.frameWidth;
      const vh = frame.frameHeight;
      const ew = this.videoEl.clientWidth || 1;
      const eh = this.videoEl.clientHeight || 1;
      this.maskRenderer.setAlignmentQuality(validation.score);
      if (this.state === "Holding") {
        this.maskRenderer.render(frame.landmarks, vw, vh, ew, eh, {
          holdingProgress: this.holdProgress,
        });
      } else {
        this.maskRenderer.render(frame.landmarks, vw, vh, ew, eh);
      }
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

    const poseDef = CAPTURE_POSES[this.currentPoseIndex];
    if (!poseDef) return null;
    if (!this.canExtrapolatePose(poseDef.id)) return null;
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

  private async captureCurrentPose(): Promise<void> {
    if (!this.videoEl) return;
    if (this.captureLock) return;
    if (performance.now() < this.cooldownUntil) return;

    const idx = this.currentPoseIndex;
    const poseState = this.poseStates[idx]!;
    if (poseState.state === "capturing" || poseState.state === "captured") return;

    this.captureLock = true;
    poseState.state = "capturing";
    this.state = "Capturing";
    /**
     * Quality gate is intentionally NOT used as a hard reject here: by the
     * time we reach this code path the user has already held the pose for
     * `holdMs` (1.8 s) without a >30°/>10° interruption, so we owe them a
     * capture. A failing quality check that bounces them back to Aligning
     * is exactly the "bar finishes but nothing happens, then restarts"
     * symptom the user reported. We rely on the held-pose stability
     * window itself as the quality signal.
     */

    const cooldownMs = this.config.cooldownMs ?? 300;
    /** Pre-arm cooldown BEFORE the async takePhoto so subsequent frames can't sneak past. */
    this.cooldownUntil = performance.now() + cooldownMs;
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.faceLossGraceUntil = null;

    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4 && !blob; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 45 * attempt));
      }
      blob = await this.camera.captureFrame();
    }
    if (!blob) {
      poseState.state = "aligning";
      this.state = "Aligning";
      this.cooldownUntil = 0;
      this.captureLock = false;
      return;
    }

    const thumbnailUrl = URL.createObjectURL(blob);
    poseState.state = "captured";
    poseState.captureTime = performance.now();
    poseState.thumbnailUrl = thumbnailUrl;
    const captured: CapturedPose = {
      poseId: poseState.poseId,
      blob,
      thumbnailUrl,
      timestamp: performance.now(),
    };
    this.capturedPoses.push(captured);
    this.callback?.({ type: "pose_captured", poseId: poseState.poseId, blob });

    if (typeof console !== "undefined") {
      console.info(
        `[face-capture] captured ${poseState.poseId} | yaw=${this.lastHeadPose?.yaw} pitch=${this.lastHeadPose?.pitch} roll=${this.lastHeadPose?.roll}`,
      );
    }

    this.transitionPoseId = poseState.poseId;
    this.transitionThumbnailUrl = thumbnailUrl;
    /** Re-arm from now: the await may have eaten part of the budget. */
    this.cooldownUntil = performance.now() + cooldownMs;
    this.holdStartAt = null;
    this.holdProgress = 0;
    this.holdStartHeadPose = null;
    this.faceLossGraceUntil = null;
    this.currentPoseIndex = idx + 1;
    this.state = "NextPose";
    this.captureLock = false;

    if (this.currentPoseIndex >= CAPTURE_POSES.length) {
      this.state = "Done";
      this.cancelSendLoop();
      this.callback?.({ type: "session_complete", results: this.capturedPoses });
      return;
    }
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
