import type { FaceFrame, PoseDefinition, PoseId } from "../types";

export interface StrategyResult {
  ok: boolean;
  progress: number;
  hints: string[];
}

/**
 * Optional context passed to a strategy. `holding` is set to true once the
 * session has already entered the Holding state for this pose: strategies
 * may use it to widen their tolerance so brief detection drifts during the
 * 1.8 s scan don't kick the user out (they're already locked in — only a
 * deliberate move should break the hold).
 */
export interface StrategyOptions {
  holding?: boolean;
}

export interface PoseStrategy {
  readonly poseId: PoseId;
  evaluate(frame: FaceFrame, pose: PoseDefinition, opts?: StrategyOptions): StrategyResult;
}

/** Widen a [min, max] range outward by `expand` degrees on each side. */
export function widenRange(
  range: [number, number],
  expand: number,
): [number, number] {
  return [range[0] - expand, range[1] + expand];
}

export function inRange(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

export function rangeProgress(
  value: number,
  [min, max]: [number, number],
  tolerance = 20,
): number {
  if (inRange(value, [min, max])) return 1;
  const target = value < min ? min : max;
  const delta = Math.abs(target - value);
  return Math.max(0, 1 - delta / Math.max(1, tolerance));
}

export function faceRatio(frame: FaceFrame): number {
  const left = frame.landmarks[234] ?? frame.landmarks[33];
  const right = frame.landmarks[454] ?? frame.landmarks[263];
  if (!left || !right) return 0;
  return Math.abs(right.x - left.x);
}

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
