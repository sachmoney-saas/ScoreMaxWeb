import { type FaceFrame, type PoseDefinition, type PoseValidation } from "./types";
import { POSE_STRATEGIES } from "./strategies";
import type { StrategyOptions } from "./strategies/PoseStrategy";

export class PoseValidator {
  validate(frame: FaceFrame, target: PoseDefinition, opts?: StrategyOptions): PoseValidation {
    const strategy = POSE_STRATEGIES.find((s) => s.poseId === target.id);
    if (!strategy) {
      return {
        poseId: target.id,
        status: "invalid",
        score: 0,
        reasons: ["Aucune stratégie de validation"],
        confidence: frame.confidence,
      };
    }
    const result = strategy.evaluate(frame, target, opts);
    const status = result.ok ? "ready" : result.progress >= 0.45 ? "aligning" : "invalid";
    return {
      poseId: target.id,
      status,
      score: Math.round(result.progress * 100) / 100,
      reasons: result.hints,
      confidence: frame.confidence,
    };
  }
}
