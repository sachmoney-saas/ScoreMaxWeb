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

function collectScores(value: unknown, parentKey = ""): number[] {
  if (!isRecord(value)) {
    return [];
  }

  const scores: number[] = [];

  for (const [key, childValue] of Object.entries(value)) {
    const path = parentKey ? `${parentKey}.${key}` : key;

    if (isScoreField(path)) {
      const score = parseScore10(childValue);
      if (score !== null) {
        scores.push(score);
      }
      continue;
    }

    scores.push(...collectScores(childValue, path));
  }

  return scores;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateWorkerFaceScore(
  worker: string,
  aggregates: Record<string, unknown>,
): number | null {
  if (!(worker in SCOREMAX_WORKER_WEIGHTS)) {
    return null;
  }

  const overallScore = getOverallScore(worker, aggregates);
  if (overallScore !== null) {
    return overallScore;
  }

  return average(collectScores(aggregates));
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

  return {
    score: Math.round((weightedSum / totalWeight) * 10),
    usedWorkerCount,
    totalWeight,
  };
}
