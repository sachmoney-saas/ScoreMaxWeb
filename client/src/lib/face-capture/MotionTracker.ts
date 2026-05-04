import type { HeadPose } from "./types";

/**
 * Rolling-window head-motion tracker.
 *
 * Records (timestamp, yaw, pitch, roll) samples and reports the maximum
 * angular speed (deg/sec) observed across the configured window.
 *
 * Used by `CaptureSession` to gate the Holding phase: capture only when the
 * head has actually stabilized, so we don't shoot mid-rotation (blurry frames,
 * wrong-angle captures).
 *
 * Intentionally ignores small windows (<2 samples or <30ms span) and reports
 * 0 deg/sec in that case — the session should treat that as "not yet known"
 * rather than "stable".
 */

export interface MotionSample {
  t: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export class MotionTracker {
  private readonly samples: MotionSample[] = [];

  constructor(private readonly windowMs: number = 300) {}

  push(now: number, pose: HeadPose): void {
    this.samples.push({ t: now, yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0]!.t < cutoff) {
      this.samples.shift();
    }
  }

  reset(): void {
    this.samples.length = 0;
  }

  /** Max angular speed (deg/sec) observed in the window across yaw/pitch/roll. */
  angularSpeed(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    if (dt < 0.03) return 0;
    const dy = Math.abs(last.yaw - first.yaw);
    const dp = Math.abs(last.pitch - first.pitch);
    const dr = Math.abs(last.roll - first.roll);
    return Math.max(dy, dp, dr) / dt;
  }

  isStable(maxDegPerSec = 12): boolean {
    if (this.samples.length < 2) return false;
    return this.angularSpeed() <= maxDegPerSec;
  }
}
