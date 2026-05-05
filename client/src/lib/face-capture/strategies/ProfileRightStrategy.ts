import type { FaceFrame, PoseDefinition } from "../types";
import {
  PoseStrategy,
  faceRatio,
  inRange,
  rangeProgress,
  widenRange,
  type StrategyOptions,
} from "./PoseStrategy";

const PROFILE_HOLDING_YAW_EXPAND_DEG = 6;

export class ProfileRightStrategy implements PoseStrategy {
  readonly poseId = "profile-right" as const;

  evaluate(frame: FaceFrame, pose: PoseDefinition, opts?: StrategyOptions) {
    const hints: string[] = [];
    const holding = opts?.holding === true;
    const yawRange = holding
      ? widenRange(pose.yawRange, PROFILE_HOLDING_YAW_EXPAND_DEG)
      : pose.yawRange;
    const [yLo] = yawRange;
    const y = frame.headPose.yaw;
    if (!inRange(y, yawRange)) {
      if (y < yLo) hints.push("Tournez davantage la tête vers la droite.");
      else hints.push("Tournez un peu vers la gauche.");
    }
    if (!inRange(frame.headPose.pitch, pose.pitchRange)) hints.push("Gardez la tête horizontale");
    if (!inRange(frame.headPose.roll, pose.rollRange)) hints.push("Redressez la tête");
    if (faceRatio(frame) < pose.minFaceRatio) hints.push("Restez bien cadré");
    const progress = rangeProgress(y, yawRange, holding ? 36 : 32);
    return { ok: hints.length === 0, hints, progress };
  }
}