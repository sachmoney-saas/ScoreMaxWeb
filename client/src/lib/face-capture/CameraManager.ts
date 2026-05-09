// ============================================================
// CameraManager — Webcam lifecycle + frame streaming
// ============================================================

import type { CameraConfig } from './types';

export type CameraState = 'idle' | 'requesting' | 'starting' | 'running' | 'stopped' | 'error';

/** Même valeur que `_encodeBoundedJpeg` ; exportée pour le repère admin aligné JPEG. */
export const CAPTURE_MAX_LONG_EDGE_PX = 1600;

export class CameraManager {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private config: CameraConfig;
  private state: CameraState = 'idle';
  private processor: ImageCapture | null = null;
  private animFrameId: number | null = null;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = {
      facingMode: 'user',
      // Lower resolution → less work for MediaPipe / WebGL while staying sharp on preview
      width: 960,
      height: 540,
      frameRate: 30,
      ...config,
    };
  }

  private buildVideoConstraints(): MediaTrackConstraints {
    const { width, height, frameRate, facingMode, deviceId } = this.config;
    const base: MediaTrackConstraints = {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate },
    };
    if (deviceId) {
      return { ...base, deviceId: { exact: deviceId } };
    }
    return { ...base, facingMode };
  }

  private async attachStreamToVideo(
    videoEl: HTMLVideoElement,
    stream: MediaStream,
  ): Promise<void> {
    videoEl.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      const onMeta = () => {
        videoEl.removeEventListener('loadedmetadata', onMeta);
        resolve();
      };
      const onErr = () => {
        videoEl.removeEventListener('error', onErr);
        reject(new Error('Video load error'));
      };
      videoEl.addEventListener('loadedmetadata', onMeta);
      videoEl.addEventListener('error', onErr);
      if (videoEl.readyState >= 1) {
        videoEl.removeEventListener('loadedmetadata', onMeta);
        videoEl.removeEventListener('error', onErr);
        resolve();
      }
    });

    await videoEl.play().catch(() => {
      // Autoplay policies / iOS: stream may still render after user gesture
    });
  }

  private initImageCapture(): void {
    this.processor = null;
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !('ImageCapture' in window) || !ImageCapture) return;
    try {
      this.processor = new ImageCapture(track);
    } catch {
      // ImageCapture not supported for this track
    }
  }

  // ---- Public API ----

  async start(videoEl: HTMLVideoElement): Promise<void> {
    this.state = 'requesting';
    this.video = videoEl;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: this.buildVideoConstraints(),
        audio: false,
      });

      await this.attachStreamToVideo(videoEl, this.stream);
      this.initImageCapture();

      this.state = 'running';
    } catch (err) {
      this.state = 'error';
      throw err;
    }
  }

  /**
   * Swap the active camera without tearing down the video element (keeps MediaPipe stable).
   */
  async switchDevice(deviceId: string | undefined, videoEl: HTMLVideoElement): Promise<void> {
    const next: CameraConfig = { ...this.config };
    if (deviceId) {
      next.deviceId = deviceId;
    } else {
      delete next.deviceId;
    }
    this.config = next;

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.processor = null;
    this.video = videoEl;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: this.buildVideoConstraints(),
      audio: false,
    });

    await this.attachStreamToVideo(videoEl, this.stream);
    this.initImageCapture();
    this.state = 'running';
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.processor = null;
    this.state = 'stopped';
  }

  /**
   * Grab the current video frame as a JPEG blob.
   *
   * Both paths are normalized through `_encodeBoundedJpeg` so the resulting
   * blob is bounded in size: max `MAX_CAPTURE_EDGE` px on the long edge,
   * JPEG quality `CAPTURE_JPEG_QUALITY`. Without this cap, `ImageCapture.takePhoto()`
   * returns the camera's *native* resolution (often 4K) — even compressed,
   * 8 captures × 6–15 MB push the analysis payload past the server's 12 MB
   * body limit and the upstream ScoreMax API limit (PAYLOAD_TOO_LARGE).
   */
  /**
   * @param onPixelsDrawn Appelé **synchrone** juste après `drawImage` sur le canvas d’encodage,
   *   avant l’`await` de `toBlob`. Permet d’aligner MediaPipe sur le **même** photogramme que le JPEG.
   */
  async captureFrame(onPixelsDrawn?: () => void): Promise<Blob | null> {
    if (!this.stream) return null;

    /**
     * Priorité au photogramme tiré du même bitmap que MediaPipe (`<video>` intrinsèque).
     * `ImageCapture.takePhoto()` renvoie souvent un autre recadrage / une autre géométrie que
     * le flux preview — les landmarks restent alignés sur preview : le masque / les guides 2D
     * sur JPEG aplati se retrouvent alors décalés (même bug côté analyse si on mélange pixels
     * et repères). `takePhoto` ne sert que de repli si la copie canvas est impossible.
     */
    const fromVideo = await this._captureViaCanvas(onPixelsDrawn);
    if (fromVideo) return fromVideo;

    if (this.processor) {
      try {
        const rawBlob = await this.processor.takePhoto();
        const bounded = await this._encodeBoundedJpeg(rawBlob);
        if (bounded) return bounded;
      } catch {
        // no-op
      }
    }

    return null;
  }

  private async _captureViaCanvas(onPixelsDrawn?: () => void): Promise<Blob | null> {
    if (!this.video || !this.video.videoWidth) return null;
    return this._encodeBoundedJpeg(this.video, onPixelsDrawn);
  }

  /**
   * Draws an `ImageBitmap`-decodable source (Blob) or `HTMLVideoElement` to
   * a canvas, scaled so the long edge ≤ `MAX_CAPTURE_EDGE`, then encodes
   * JPEG at `CAPTURE_JPEG_QUALITY`. Bounded output: ~150–500 KB per shot.
   */
  private async _encodeBoundedJpeg(
    source: Blob | HTMLVideoElement,
    onPixelsDrawn?: () => void,
  ): Promise<Blob | null> {
    let srcW = 0;
    let srcH = 0;
    let drawSource: CanvasImageSource | null = null;
    let bitmap: ImageBitmap | null = null;

    if (source instanceof Blob) {
      try {
        bitmap = await createImageBitmap(source);
      } catch {
        return source.type === 'image/jpeg' ? source : null;
      }
      srcW = bitmap.width;
      srcH = bitmap.height;
      drawSource = bitmap;
    } else {
      srcW = source.videoWidth;
      srcH = source.videoHeight;
      if (!srcW || !srcH) return null;
      drawSource = source;
    }

    const longEdge = Math.max(srcW, srcH);
    const scale =
      longEdge > CAPTURE_MAX_LONG_EDGE_PX ? CAPTURE_MAX_LONG_EDGE_PX / longEdge : 1;
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap?.close?.();
      return null;
    }
    ctx.drawImage(drawSource, 0, 0, targetW, targetH);
    onPixelsDrawn?.();
    bitmap?.close?.();

    return new Promise(resolve =>
      canvas.toBlob(
        b => resolve(b),
        'image/jpeg',
        CameraManager.CAPTURE_JPEG_QUALITY,
      ),
    );
  }

  /** Long-edge cap for any captured frame (px). Keeps payloads under server limits. */
  private static readonly MAX_CAPTURE_EDGE = CAPTURE_MAX_LONG_EDGE_PX;
  /** JPEG quality used for all captured frames. */
  private static readonly CAPTURE_JPEG_QUALITY = 0.9;

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  /** Device id of the current video track, if known. */
  getActiveDeviceId(): string | undefined {
    const track = this.stream?.getVideoTracks()[0];
    const fromTrack = track?.getSettings().deviceId;
    if (fromTrack) return fromTrack;
    return this.config.deviceId;
  }

  getState(): CameraState {
    return this.state;
  }

  getTrack(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }
}