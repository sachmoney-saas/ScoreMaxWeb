import { calculateGlobalFaceScore } from "@/lib/face-analysis-score";
import { getScoreRank } from "@/lib/global-score-tiers";
import type { AnalysisHistoryItem } from "@/lib/face-analysis";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Score harmonisé sidebar / liste protocole (PSL 0–100). */
export function analysisHistoryGlobalScoreSummary(
  results: AnalysisHistoryItem["results"],
): { score0to100: number | null; rankTitle: string | null } {
  const global = calculateGlobalFaceScore(
    results.map((row) => {
      const outputAggregates = isRecord(row.result.outputAggregates)
        ? row.result.outputAggregates
        : {};

      return {
        worker: row.worker,
        outputAggregates,
      };
    }),
  );

  if (!global) {
    return { score0to100: null, rankTitle: null };
  }

  return {
    score0to100: global.score,
    rankTitle: getScoreRank(global.score).title,
  };
}
