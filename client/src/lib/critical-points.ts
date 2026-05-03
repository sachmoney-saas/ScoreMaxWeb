import { listWorkerAggregateCatalog } from "@/lib/face-analysis-display";
import {
  matchRecommendations,
  type MatchedRecommendation,
  type Recommendation,
} from "@/lib/recommendations";

/* ============================================================================
 * Types
 * ========================================================================= */

export interface ScorableAggregate {
  key: string;
  label: string;
  score: number;
}

export interface CriticalPoint {
  worker: string;
  aggregateKey: string;
  aggregateLabel: string;
  score: number;
  matchedRecommendations: MatchedRecommendation[];
  /** Whether the recommendation list is partial (only those targeting this point). */
  hasMore: boolean;
}

export interface OrphanRecommendations {
  worker: string;
  recommendations: MatchedRecommendation[];
}

/* ============================================================================
 * Score reading — must mirror RecommendationsSection / face-analysis-score
 * ========================================================================= */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScore10(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 10);
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 10) : null;
  }
  if (isRecord(value)) {
    for (const key of ["score", "value", "mean", "median"]) {
      const parsed = parseScore10(value[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function getNestedValue(
  record: Record<string, unknown>,
  dottedPath: string,
): unknown {
  if (dottedPath in record) return record[dottedPath];
  let current: unknown = record;
  for (const segment of dottedPath.split(".")) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Reads the score for an aggregate key, tolerating both the flat
 * `key.score` form (most common) and the nested `{ key: { score } }` form.
 */
function readAggregateScore(
  aggregates: Record<string, unknown>,
  key: string,
): number | null {
  const direct = parseScore10(getNestedValue(aggregates, `${key}.score`));
  if (direct !== null) return direct;
  return parseScore10(getNestedValue(aggregates, key));
}

/* ============================================================================
 * Aggregate scoring — list all scorable points for a worker
 * ========================================================================= */

const OVERALL_SCORE_PATTERN = /^overall_/;

/**
 * Returns the list of scorable aggregates for a given worker analysis,
 * filtering out the worker-level "overall_*_score" because that one is
 * already shown elsewhere and isn't a "point critique" per se.
 */
export function listScorableAggregates(
  worker: string,
  aggregates: Record<string, unknown>,
  locale: "fr" | "en" = "fr",
): ScorableAggregate[] {
  const catalog = listWorkerAggregateCatalog(worker, locale);
  const out: ScorableAggregate[] = [];

  for (const entry of catalog) {
    if (entry.kind !== "score") continue;
    if (entry.hidden) continue;
    if (OVERALL_SCORE_PATTERN.test(entry.key)) continue;

    const score = readAggregateScore(aggregates, entry.key);
    if (score === null) continue;

    out.push({ key: entry.key, label: entry.label, score });
  }

  return out;
}

/* ============================================================================
 * Critical points — selects worst-scoring aggregates and binds matching recs
 * ========================================================================= */

export interface BuildCriticalPointsInput {
  worker: string;
  aggregates: Record<string, unknown>;
  recommendations: Recommendation[];
}

export interface BuildCriticalPointsOptions {
  /**
   * Aggregates with a score strictly above this threshold are not flagged as
   * critical. Default: 7 — i.e. anything 7+ is considered "healthy enough".
   */
  scoreThreshold?: number;
  /**
   * Hard cap on the number of critical points returned. Sorted by ascending
   * score so the worst ones survive the cut. Default: 8.
   */
  maxPoints?: number;
  locale?: "fr" | "en";
}

export interface CriticalPointsWorkerGroup {
  worker: string;
  /** Within this worker: worst scores first (ascending), capped by `maxPoints`. */
  criticalPoints: CriticalPoint[];
}

export interface BuildCriticalPointsResult {
  /**
   * Every worker with editorial recommendations, ordered for tabs: most critical
   * worker first (lowest minimum score among their critical points), then
   * workers with no surfaced critical point (orphan-only) in original order.
   */
  workerGroupsOrdered: CriticalPointsWorkerGroup[];
  /**
   * Recommendations matched for a worker but not attached to any displayed
   * critical point — show beside that worker under their tab.
   */
  orphans: OrphanRecommendations[];
  /** Workers we found at least one recommendation for, even if no match. */
  workersWithContent: string[];
  /** Workers with no editorial content yet. */
  workersAwaitingContent: string[];
}

/**
 * Combines per-worker analysis data with their fetched recommendations to
 * produce a single, prioritised "critical points" view.
 *
 * Pure function — easy to unit-test, no React.
 */
export function buildCriticalPoints(
  inputs: BuildCriticalPointsInput[],
  options: BuildCriticalPointsOptions = {},
): BuildCriticalPointsResult {
  const threshold = options.scoreThreshold ?? 7;
  const maxPoints = options.maxPoints ?? 8;
  const locale = options.locale ?? "fr";

  const workersWithContent: string[] = [];
  const workersAwaitingContent: string[] = [];
  const matchedByWorker = new Map<string, MatchedRecommendation[]>();
  /** Per-worker critical candidates before slicing */
  const candidatesByWorker = new Map<string, CriticalPoint[]>();

  for (const input of inputs) {
    if (input.recommendations.length === 0) {
      workersAwaitingContent.push(input.worker);
      continue;
    }
    workersWithContent.push(input.worker);

    const matched = matchRecommendations(
      input.recommendations,
      input.aggregates,
    );
    matchedByWorker.set(input.worker, matched);

    const bucket: CriticalPoint[] = [];
    candidatesByWorker.set(input.worker, bucket);

    const scorables = listScorableAggregates(
      input.worker,
      input.aggregates,
      locale,
    );

    for (const agg of scorables) {
      if (agg.score > threshold) continue;

      const targeted = matched.filter((rec) =>
        rec.targets.includes(agg.key),
      );
      if (targeted.length === 0) continue;

      bucket.push({
        worker: input.worker,
        aggregateKey: agg.key,
        aggregateLabel: agg.label,
        score: agg.score,
        matchedRecommendations: targeted,
        hasMore: false,
      });
    }
  }

  const workerGroupsOrdered: CriticalPointsWorkerGroup[] =
    workersWithContent.map((worker) => ({
      worker,
      criticalPoints: [...(candidatesByWorker.get(worker) ?? [])].sort(
        (a, b) => a.score - b.score,
      ).slice(0, maxPoints),
    }));

  workerGroupsOrdered.sort((a, b) => {
    const minScore = (g: CriticalPointsWorkerGroup): number =>
      g.criticalPoints.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...g.criticalPoints.map((p) => p.score));
    const d = minScore(a) - minScore(b);
    if (d !== 0) return d;
    return workersWithContent.indexOf(a.worker) - workersWithContent.indexOf(b.worker);
  });

  const surfacedRecIds = new Set<string>();
  for (const g of workerGroupsOrdered) {
    for (const cp of g.criticalPoints) {
      for (const rec of cp.matchedRecommendations) surfacedRecIds.add(rec.id);
    }
  }

  const orphans: OrphanRecommendations[] = [];
  for (const [worker, recs] of matchedByWorker.entries()) {
    const remaining = recs.filter((r) => !surfacedRecIds.has(r.id));
    if (remaining.length > 0) {
      orphans.push({ worker, recommendations: remaining });
    }
  }

  return {
    workerGroupsOrdered,
    orphans,
    workersWithContent,
    workersAwaitingContent,
  };
}
