export type ScoreInputResult = {
  worker: string;
  outputAggregates: Record<string, unknown>;
};

export type GlobalFaceScore = {
  score: number;
  usedWorkerCount: number;
  totalWeight: number;
};

export const SCOREMAX_WORKER_WEIGHTS: Record<string, number> = {
  coloring: 1.1,
  skin: 1.1,
  bodyfat: 1.05,
  jaw: 1.05,
  eye_brows: 1.05,
  cheeks: 1,
  smile: 1,
  hair: 1,
  skin_tint: 1,
  neck: 0.95,
  lips: 0.95,
  chin: 0.65,
  nose: 0.45,
  ear: 0.45,
  eyes: 0.45,
  symmetry_shape: 0.45,
};

export const SCOREMAX_OVERALL_SCORE_KEYS: Record<string, string[]> = {
  coloring: ["global_coloring_score", "global_coloring"],
  skin: ["overall_skin_score", "overall_skin"],
  jaw: ["overall_jaw_score", "overall_jaw"],
  eye_brows: ["overall_brow_score", "overall_brow"],
  cheeks: ["overall_cheek_score", "overall_cheek"],
  smile: ["overall_smile_score", "overall_smile"],
  hair: ["overall_hair_score", "overall_hair"],
  skin_tint: ["overall_colorimetry_score", "overall_colorimetry"],
  neck: ["overall_neck_score", "overall_neck"],
  lips: ["overall_lip_score", "overall_lip"],
  chin: ["overall_chin_score", "overall_chin"],
  nose: ["overall_nose_score", "overall_nose"],
  ear: ["overall_ear_score", "overall_ear"],
  eyes: ["overall_eye_score", "overall_eye"],
  symmetry_shape: ["overall_face_structure_score", "overall_face_structure"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampScore10(value: number): number {
  return Math.min(Math.max(value, 0), 10);
}

function parseScore10(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampScore10(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? clampScore10(parsed) : null;
  }

  if (isRecord(value)) {
    for (const key of ["score", "value", "mean", "median"]) {
      const parsed = parseScore10(value[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function getNestedValue(record: Record<string, unknown>, dottedPath: string): unknown {
  if (dottedPath in record) {
    return record[dottedPath];
  }

  let current: unknown = record;
  for (const segment of dottedPath.split(".")) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Nine radar metrics used to derive the skin worker overall (mean), aligned with `SkinWorkerView`.
 */
export const SKIN_RADAR_METRIC_KEYS = [
  "texture_and_pores.pore_size_visibility",
  "texture_and_pores.blackheads_and_congestion",
  "texture_and_pores.surface_smoothness",
  "acne_and_scarring.active_acne",
  "acne_and_scarring.atrophic_scarring",
  "pigmentation_and_tone.color_uniformity",
  "pigmentation_and_tone.redness_and_erythema",
  "hydration_and_vitality.sebum_hydration_balance",
  "hydration_and_vitality.firmness_and_elasticity",
] as const;

/**
 * Mean of all nine skin radar metrics (0–10). All nine must be present; otherwise returns null
 * and callers fall back to API `overall_skin*`.
 */
export function computeSkinDerivedOverall10(
  aggregates: Record<string, unknown>,
): number | null {
  const values: number[] = [];
  for (const key of SKIN_RADAR_METRIC_KEYS) {
    let v = parseScore10(getNestedValue(aggregates, key));
    if (v === null) {
      v = parseScore10(getNestedValue(aggregates, `${key}.score`));
    }
    if (v === null) {
      return null;
    }
    values.push(v);
  }
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

function getOverallScore(worker: string, aggregates: Record<string, unknown>): number | null {
  const keys = SCOREMAX_OVERALL_SCORE_KEYS[worker] ?? [];

  for (const key of keys) {
    const direct = parseScore10(getNestedValue(aggregates, key));
    if (direct !== null) {
      return direct;
    }

    const v1Score = parseScore10(getNestedValue(aggregates, `${key}.score`));
    if (v1Score !== null) {
      return v1Score;
    }
  }

  return null;
}

function isScoreField(key: string): boolean {
  return key.endsWith(".score") || key.endsWith("_score");
}

type ScorePathValue = { path: string; score: number };

function collectScorePaths(value: unknown, parentKey = ""): ScorePathValue[] {
  if (!isRecord(value)) {
    return [];
  }

  const out: ScorePathValue[] = [];

  for (const [key, childValue] of Object.entries(value)) {
    const path = parentKey ? `${parentKey}.${key}` : key;

    if (isScoreField(path)) {
      const score = parseScore10(childValue);
      if (score !== null) {
        out.push({ path, score });
      }
      continue;
    }

    out.push(...collectScorePaths(childValue, path));
  }

  return out;
}

function collectScores(value: unknown, parentKey = ""): number[] {
  return collectScorePaths(value, parentKey).map((p) => p.score);
}

function buildExcludedOverallPaths(worker: string): Set<string> {
  const keys = SCOREMAX_OVERALL_SCORE_KEYS[worker] ?? [];
  const excluded = new Set<string>();
  for (const k of keys) {
    excluded.add(`${k}.score`);
    if (isScoreField(k)) {
      excluded.add(k);
    }
  }
  return excluded;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Mean of all leaf metrics (paths ending in `.score` / `_score`) — workers outside weights / fallback. */
export function computeMeanLeafScores10(
  aggregates: Record<string, unknown>,
  minMetrics = 1,
): number | null {
  const pairs = collectScorePaths(aggregates);
  if (pairs.length < minMetrics) {
    return null;
  }
  return average(pairs.map((p) => p.score))!;
}

export function calculateWorkerFaceScore(
  worker: string,
  aggregates: Record<string, unknown>,
): number | null {
  if (!(worker in SCOREMAX_WORKER_WEIGHTS)) {
    return null;
  }

  if (worker === "skin") {
    const derived = computeSkinDerivedOverall10(aggregates);
    if (derived !== null) {
      return derived;
    }
  }

  const pairs = collectScorePaths(aggregates);
  const excluded = buildExcludedOverallPaths(worker);
  const metricScores = pairs
    .filter((p) => !excluded.has(p.path))
    .map((p) => p.score);

  if (metricScores.length >= 3) {
    return average(metricScores)!;
  }

  const overallScore = getOverallScore(worker, aggregates);
  if (overallScore !== null) {
    return overallScore;
  }

  if (metricScores.length > 0) {
    return average(metricScores)!;
  }

  return pairs.length > 0 ? average(pairs.map((p) => p.score)) : null;
}

export function calculateGlobalFaceScore(results: ScoreInputResult[]): GlobalFaceScore | null {
  let weightedSum = 0;
  let totalWeight = 0;
  let usedWorkerCount = 0;

  for (const result of results) {
    const weight = SCOREMAX_WORKER_WEIGHTS[result.worker];
    if (!weight) {
      continue;
    }

    const workerScore = calculateWorkerFaceScore(result.worker, result.outputAggregates);
    if (workerScore === null) {
      continue;
    }

    weightedSum += workerScore * weight;
    totalWeight += weight;
    usedWorkerCount += 1;
  }

  if (totalWeight === 0) {
    return null;
  }

  const raw0to100 = (weightedSum / totalWeight) * 10;
  return {
    score: Math.round(raw0to100 * 10) / 10,
    usedWorkerCount,
    totalWeight,
  };
}

/**
 * Human-readable PSL / tier label for a global face score (0–100).
 * Thresholds match the Overview `GlobalScoreCard` ladder.
 */
export function getGlobalScoreTierLabel(score0to100: number): string {
  if (score0to100 < 25) {
    return "Sub-human Bottom Percentile";
  }
  if (score0to100 < 35) {
    return "Sub-5 / Low-Tier Sub-Normie";
  }
  if (score0to100 < 45) {
    return "LTN (Low-Tier Normie) / Invisible";
  }
  if (score0to100 < 55) {
    return "MTN (Mid-Tier Normie) / Ultimate NPC";
  }
  if (score0to100 < 60) {
    return "True Normie / Baseline";
  }
  if (score0to100 < 70) {
    return "HTN (High-Tier Normie) / Local Chad";
  }
  if (score0to100 < 80) {
    return "Chadlite / Stacylite / Mogger";
  }
  if (score0to100 < 85) {
    return "Model-Tier Chad";
  }
  if (score0to100 < 95) {
    return "Genetic Freak Gigachad PSL God";
  }
  return "Alien Tier Ascended";
}

/** Radar peau : met en évidence les 3 axes les plus bas (rouge) et le(s) plus haut(s) (vert). */
export type SkinRadarAxisHighlight = "weak" | "strong" | "neutral";

export function skinRadarAxisHighlights(
  scores: readonly number[],
): SkinRadarAxisHighlight[] {
  const n = scores.length;
  if (n === 0) return [];

  const maxScore = Math.max(...scores);
  const indexed = scores.map((score, index) => ({ score, index }));
  const sortedAsc = [...indexed].sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.index - b.index,
  );
  const weakIndices = new Set(
    sortedAsc.slice(0, Math.min(3, n)).map((x) => x.index),
  );
  const strongIndices = new Set(
    indexed.filter((x) => x.score === maxScore).map((x) => x.index),
  );

  return scores.map((_, i) => {
    if (strongIndices.has(i)) return "strong";
    if (weakIndices.has(i)) return "weak";
    return "neutral";
  });
}

/** Couleurs SVG partagées (carte worker + preview). */
export function skinRadarAxisPaint(highlight: SkinRadarAxisHighlight): {
  labelFill: string;
  previewScoreFill: string;
  previewMutedFill: string;
  dotFill: string;
  dotStroke: string;
} {
  switch (highlight) {
    case "weak":
      return {
        labelFill: "#f87171",
        previewScoreFill: "#fca5a5",
        previewMutedFill: "#ef4444",
        dotFill: "#fecaca",
        dotStroke: "#f87171",
      };
    case "strong":
      return {
        labelFill: "#6ee7b7",
        previewScoreFill: "#6ee7b7",
        previewMutedFill: "#34d399",
        dotFill: "#d1fae5",
        dotStroke: "#34d399",
      };
    default:
      return {
        labelFill: "#aab2bd",
        previewScoreFill: "#e9f1f4",
        previewMutedFill: "#6b7280",
        dotFill: "#ffffff",
        dotStroke: "#9aaeb5",
      };
  }
}
