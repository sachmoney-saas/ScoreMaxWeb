import * as React from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  LatestAnalysisResponse,
  PersistedWorkerAnalysisResult,
} from "@/lib/face-analysis";
import {
  getWorkerDisplayLabel,
  type FaceAnalysisLocale,
} from "@/lib/face-analysis-display";
import {
  calculateGlobalFaceScore,
  calculateWorkerFaceScore,
  SCOREMAX_WORKER_WEIGHTS,
} from "@/lib/face-analysis-score";
import type { GlobalFaceScore } from "@/lib/face-analysis-score";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
import {
  getWorkerPreviewHeadlineScore,
  MiniRing,
  type MiniRingHighlight,
  WorkerPreviewContent,
} from "@/components/analysis/WorkerPreviewContent";
import { CriticalPointsRecommendations } from "@/components/analysis/CriticalPointsRecommendations";
import {
  analysisSurfaceCardClassName,
  ScoreRing,
} from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";
import { getScoreRank, SCORE_TIERS } from "@/lib/global-score-tiers";

type AnalysisResultsSectionProps = {
  analysis: LatestAnalysisResponse | null | undefined;
  isLoading: boolean;
};

type NormalizedWorkerResult = {
  worker: string;
  promptVersion: string;
  outputAggregates: Record<string, unknown>;
  createdAt: string;
};

const EMPTY_RESULT: PersistedWorkerAnalysisResult = {
  worker: "unknown",
  promptVersion: "unknown",
  provider: "unknown",
  requestedRuns: 0,
  completedRuns: 0,
  outputAggregates: {},
  rawRuns: [],
};

/** Active tab: crisp inner border + outer halo (same family as focus-visible ring). */
const ANALYSIS_TAB_TRIGGER_CLASS = cn(
  "rounded-xl border border-transparent px-5 py-2.5 text-sm text-black transition-all",
  "ring-0 ring-offset-0 focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white/[0.07]",
  "data-[state=active]:border-white data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none",
  "data-[state=active]:ring-2 data-[state=active]:ring-white/45 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-white/[0.07]",
);

const WORKER_DISPLAY_ORDER = [
  "age",
  "coloring",
  "skin",
  "bodyfat",
  "jaw",
  "chin",
  "lips",
  "smile",
  "hair",
  "eye_brows",
  "cheeks",
  "eyes",
  "nose",
  "neck",
  "ear",
  "skin_tint",
  "symmetry_shape",
] as const;

const workerDisplayOrderIndex = new Map<string, number>(
  WORKER_DISPLAY_ORDER.map((worker, index) => [worker, index]),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeWorkerResult(
  row: LatestAnalysisResponse["results"][number],
): NormalizedWorkerResult {
  const result = isRecord(row.result) ? row.result : EMPTY_RESULT;
  const outputAggregates = isRecord(result.outputAggregates)
    ? result.outputAggregates
    : {};

  return {
    worker: getString(result.worker, row.worker),
    promptVersion: getString(result.promptVersion, row.prompt_version),
    outputAggregates,
    createdAt: row.created_at,
  };
}

function sortWorkerResults(results: NormalizedWorkerResult[]): NormalizedWorkerResult[] {
  return [...results].sort((resultA, resultB) => {
    const orderA = workerDisplayOrderIndex.get(resultA.worker) ?? Number.MAX_SAFE_INTEGER;
    const orderB = workerDisplayOrderIndex.get(resultB.worker) ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return resultA.worker.localeCompare(resultB.worker, "fr");
  });
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}


function parseAgeCandidate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (isRecord(value)) {
    for (const key of ["value", "mean", "median", "estimate"]) {
      const parsed = parseAgeCandidate(value[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function extractEstimatedAge(aggregates: Record<string, unknown>): number | null {
  for (const key of [
    "estimatedAge",
    "estimated_age",
    "age",
    "apparentAge",
    "apparent_age",
    "ageEstimate",
    "age_estimate",
    "age_analysis.best_estimated_age",
    "age_analysis.best_estimated_age.score",
  ]) {
    const parsed = parseAgeCandidate(aggregates[key]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function isAgeWorker(worker: string): boolean {
  return worker.toLowerCase() === "age";
}

function getAgeNumber(
  aggregates: Record<string, unknown>,
  key: string,
): number | null {
  const v = aggregates[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getAgeArgument(aggregates: Record<string, unknown>): string | null {
  for (const k of [
    "age_analysis.age_argument",
    "age_analysis.argument",
    "age_analysis.best_estimated_age.argument",
  ]) {
    const v = aggregates[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function AgeMiniBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  if (score === null) return null;
  const clamped = Math.max(0, Math.min(score, 10));
  const pct = (clamped / 10) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {label}
        </span>
        <span className="font-display text-[11px] font-bold tabular-nums text-white">
          {clamped.toFixed(0)}
          <span className="ml-0.5 text-[9px] font-semibold text-zinc-500">
            /10
          </span>
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#9aaeb5] via-[#bcd0d6] to-[#e9f1f4]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AgeResultCard({
  result,
  href,
  language,
}: {
  result: NormalizedWorkerResult;
  href: string;
  language: AppLanguage;
}) {
  const estimatedAge = extractEstimatedAge(result.outputAggregates);
  const displayedAge = estimatedAge === null ? "—" : Math.round(estimatedAge);
  const argument = getAgeArgument(result.outputAggregates);

  const epidermal = getAgeNumber(
    result.outputAggregates,
    "skin_quality_and_plumpness.epidermal_plumpness_baby_skin",
  );
  const lipPlumpness = getAgeNumber(
    result.outputAggregates,
    "structural_neoteny.lip_plumpness",
  );
  const lowerSoftness = getAgeNumber(
    result.outputAggregates,
    "facial_neoteny_and_fat.lower_face_softness",
  );

  const card = (
    <Card
      id={workerCardId(result.worker)}
      className={cn(
        analysisSurfaceCardClassName,
        "h-full scroll-mt-24 transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35",
      )}
    >
      <CardContent className="relative space-y-4 p-5">
        <div className="flex justify-center">
          <div className="max-w-lg text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {i18n(language, { en: "Apparent age", fr: "Âge apparent" })}
            </p>
            <h2 className="mt-2 font-display text-6xl font-bold tracking-[-0.08em] text-white sm:text-7xl">
              {displayedAge}
              <span className="ml-2 text-xl tracking-normal text-zinc-300">
                {i18n(language, { en: "yrs", fr: "ans" })}
              </span>
            </h2>
            {argument ? (
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-300 line-clamp-2">
                {argument}
              </p>
            ) : (
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Reading of your apparent age based on detected visual markers.",
                  fr: "Lecture de ton âge apparent basée sur les marqueurs visuels détectés.",
                })}
              </p>
            )}
          </div>
        </div>

        {epidermal !== null || lipPlumpness !== null || lowerSoftness !== null ? (
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
            <AgeMiniBar
              label={i18n(language, { en: "Skin", fr: "Peau" })}
              score={epidermal}
            />
            <AgeMiniBar
              label={i18n(language, { en: "Lips", fr: "Lèvres" })}
              score={lipPlumpness}
            />
            <AgeMiniBar
              label={i18n(language, { en: "Soft jaw", fr: "Bas doux" })}
              score={lowerSoftness}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Link href={href} className="group block h-full">
      {card}
    </Link>
  );
}

function tierScoreLowerBound(rankIndex: number): number {
  return rankIndex <= 0 ? 0 : SCORE_TIERS[rankIndex - 1].maxExclusive;
}

function tierScoreNextExclusive(rankIndex: number): number | null {
  const cap = SCORE_TIERS[rankIndex].maxExclusive;
  return cap === Infinity ? null : cap;
}

function tierProgressDisplayName(
  tierIndex: number,
  language: AppLanguage,
): string {
  const row = SCORE_TIERS[tierIndex];
  return language === "fr" ? row.progressName.fr : row.progressName.en;
}

/** Stable rounding for tier-gap copy (avoids float artefacts like 4.799999999997). */
function roundTierGapPoints(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatTierGapPoints(n: number): string {
  const r = roundTierGapPoints(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Compact copy: gap vs neighbouring tiers (below title); uses progress names, not PSL. */
function GlobalTierRelativeCopy({
  score0to100,
  rankIndex,
  language,
}: {
  score0to100: number;
  rankIndex: number;
  language: AppLanguage;
}) {
  const lowerBound = tierScoreLowerBound(rankIndex);
  const nextExclusive = tierScoreNextExclusive(rankIndex);

  const ptsAbove = score0to100 - lowerBound;
  const ptsToNextRaw =
    nextExclusive !== null ? Math.max(0, nextExclusive - score0to100) : null;
  const ptsAboveRounded = roundTierGapPoints(ptsAbove);
  const ptsToNextRounded =
    ptsToNextRaw !== null ? roundTierGapPoints(ptsToNextRaw) : null;

  const prevTierName =
    rankIndex > 0 ? tierProgressDisplayName(rankIndex - 1, language) : null;
  const nextTierName =
    rankIndex < SCORE_TIERS.length - 1
      ? tierProgressDisplayName(rankIndex + 1, language)
      : null;

  const showAbove =
    rankIndex > 0 && prevTierName !== null && ptsAboveRounded > 0;
  const showToNext =
    ptsToNextRounded !== null &&
    nextTierName !== null &&
    ptsToNextRounded > 0;

  if (!showAbove && !showToNext) {
    return null;
  }

  const frAboveWord = ptsAboveRounded === 1 ? "point" : "points";
  const enAboveWord = ptsAboveRounded === 1 ? "point" : "points";

  return (
    <div className="mx-auto mt-3 max-w-[18rem] space-y-1 text-center text-[11px] leading-snug text-zinc-400 sm:max-w-[22rem] sm:text-xs">
      {showAbove && prevTierName ? (
        <p>
          {language === "fr" ? (
            <>
              <span className="font-semibold tabular-nums text-zinc-300">
                {formatTierGapPoints(ptsAbove)}
              </span>{" "}
              {frAboveWord} au-dessus du palier{" "}
              <span className="font-medium text-zinc-300">{prevTierName}</span>
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-zinc-300">
                {formatTierGapPoints(ptsAbove)}
              </span>{" "}
              {enAboveWord} above{" "}
              <span className="font-medium text-zinc-300">{prevTierName}</span>
            </>
          )}
        </p>
      ) : null}
      {showToNext && nextTierName ? (
        <p>
          {language === "fr" ? (
            <>
              <span className="font-semibold tabular-nums text-zinc-300">
                {formatTierGapPoints(ptsToNextRaw!)}
              </span>{" "}
              {ptsToNextRounded === 1 ? "point" : "points"} avant
              d&apos;atteindre{" "}
              <span className="font-medium text-zinc-300">{nextTierName}</span>
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-zinc-300">
                {formatTierGapPoints(ptsToNextRaw!)}
              </span>{" "}
              {ptsToNextRounded === 1 ? "point" : "points"} to reach{" "}
              <span className="font-medium text-zinc-300">{nextTierName}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

function TierLadder({
  activeIndex,
  pslLabel,
  language,
}: {
  activeIndex: number;
  pslLabel: string;
  language: AppLanguage;
}) {
  const lastIdx = SCORE_TIERS.length - 1;

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label="Tier ladder"
      >
        {SCORE_TIERS.map((_, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div key={i} className="flex flex-1 items-center gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition ${
                  isActive
                    ? "bg-gradient-to-b from-white/90 to-zinc-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_0_0_1px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.35)]"
                    : isPast
                      ? "bg-white/40"
                      : "bg-white/10"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div
        className="grid gap-x-0 text-center"
        style={{
          gridTemplateColumns: `repeat(${SCORE_TIERS.length}, minmax(0, 1fr))`,
        }}
      >
        {SCORE_TIERS.map((_, i) => {
          const pslNode =
            i === activeIndex ? (
              <span className="font-display text-[11px] font-bold leading-none tabular-nums text-white sm:text-xs">
                {pslLabel}
              </span>
            ) : null;

          if (i === 0) {
            return (
              <div
                key={i}
                className="flex min-h-[2.25rem] min-w-0 flex-col items-center justify-center gap-1 px-0.5"
              >
                <span className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-zinc-500 sm:text-[10px]">
                  {i18n(language, {
                    en: "Lowest Tier",
                    fr: "Palier minimal",
                  })}
                </span>
                {pslNode}
              </div>
            );
          }

          if (i === lastIdx) {
            return (
              <div
                key={i}
                className="flex min-h-[2.25rem] min-w-0 flex-col items-center justify-center gap-1 px-0.5"
              >
                {pslNode}
                <span className="text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-zinc-500 sm:text-[10px]">
                  {i18n(language, {
                    en: "Highest Tier",
                    fr: "Palier maximal",
                  })}
                </span>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="flex min-h-[2.25rem] min-w-0 flex-col items-center justify-center px-0.5"
            >
              {pslNode}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Key takeaways — Top 3 strengths / Top 3 weaknesses (clickable anchors)
 * ------------------------------------------------------------------------- */

const KEY_TAKEAWAY_LIMIT = 3;

function workerCardId(worker: string): string {
  return `worker-card-${worker}`;
}

type WorkerScoreEntry = {
  worker: string;
  label: string;
  score: number;
};

function buildWorkerScoreboard(
  results: NormalizedWorkerResult[],
  locale: FaceAnalysisLocale,
): { strengths: WorkerScoreEntry[]; weaknesses: WorkerScoreEntry[] } {
  const entries: WorkerScoreEntry[] = [];

  for (const result of results) {
    if (!(result.worker in SCOREMAX_WORKER_WEIGHTS)) continue;
    const score = calculateWorkerFaceScore(result.worker, result.outputAggregates);
    if (score === null) continue;

    entries.push({
      worker: result.worker,
      label: getWorkerDisplayLabel(result.worker, locale),
      score,
    });
  }

  if (entries.length === 0) {
    return { strengths: [], weaknesses: [] };
  }

  const sortedDesc = [...entries].sort((a, b) => b.score - a.score);
  const sortedAsc = [...entries].sort((a, b) => a.score - b.score);

  const strengths = sortedDesc.slice(0, KEY_TAKEAWAY_LIMIT);
  const strengthKeys = new Set(strengths.map((entry) => entry.worker));
  const weaknesses = sortedAsc
    .filter((entry) => !strengthKeys.has(entry.worker))
    .slice(0, KEY_TAKEAWAY_LIMIT);

  return { strengths, weaknesses };
}

function scrollToWorkerCard(worker: string) {
  if (typeof document === "undefined") return;
  const element = document.getElementById(workerCardId(worker));
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

type TakeawayTone = "positive" | "negative";

function TakeawayList({
  tone,
  title,
  entries,
  emptyLabel,
  wrapperClassName,
  /** Wider rows: single-line labels scroll horizontally instead of truncating. */
  roomyRows = false,
}: {
  tone: TakeawayTone;
  title: string;
  entries: WorkerScoreEntry[];
  emptyLabel: string;
  /** Default: centered narrow column; merge with score card uses full width right rail. */
  wrapperClassName?: string;
  roomyRows?: boolean;
}) {
  const isPositive = tone === "positive";
  const accent = isPositive
    ? {
        chip: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
        score: "text-emerald-200",
        glow: "rgba(52,211,153,0.25)",
        heading: "text-emerald-200",
      }
    : {
        chip: "bg-red-400/18 text-red-200 ring-red-400/35",
        score: "text-red-300",
        glow: "rgba(248,113,113,0.28)",
        heading: "text-red-200",
      };

  return (
    <div
      className={cn(
        "w-full space-y-3",
        wrapperClassName ??
          "mx-auto max-w-[13rem] sm:max-w-[13.5rem]",
      )}
    >
      <p
        className={cn(
          "text-center font-bold uppercase tracking-[0.2em]",
          roomyRows
            ? `text-[9px] sm:text-[10px] ${accent.heading}`
            : `text-[10px] sm:text-[11px] ${accent.heading}`,
        )}
      >
        {title}
      </p>

      {entries.length === 0 ? (
        <p className="text-center text-xs leading-relaxed text-zinc-500">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.worker}>
              <button
                type="button"
                onClick={() => scrollToWorkerCard(entry.worker)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-left transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  roomyRows && "gap-2 py-1.5 px-2 sm:px-2.5",
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-md font-display font-bold tabular-nums ring-1",
                    roomyRows ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]",
                    accent.chip,
                  )}
                  style={{
                    boxShadow: roomyRows
                      ? `0 0 8px ${accent.glow}`
                      : `0 0 10px ${accent.glow}`,
                  }}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 font-display font-semibold text-white",
                    roomyRows
                      ? "overflow-x-auto whitespace-nowrap text-[11px] leading-tight sm:text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      : "truncate text-xs sm:text-sm",
                  )}
                >
                  {entry.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-display font-bold tabular-nums",
                    roomyRows
                      ? `text-[11px] sm:text-xs ${accent.score}`
                      : `text-xs sm:text-sm ${accent.score}`,
                  )}
                >
                  {entry.score.toFixed(2)}
                  <span
                    className={cn(
                      "ml-0.5 font-semibold text-zinc-500",
                      roomyRows ? "text-[8px]" : "text-[9px]",
                    )}
                  >
                    /10
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyTakeawaysCard({
  results,
  language,
}: {
  results: NormalizedWorkerResult[];
  language: AppLanguage;
}) {
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const { strengths, weaknesses } = React.useMemo(
    () => buildWorkerScoreboard(results, locale),
    [results, locale],
  );

  if (strengths.length === 0 && weaknesses.length === 0) {
    return null;
  }

  return (
    <Card className={analysisSurfaceCardClassName}>
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
          <TakeawayList
            tone="positive"
            title={i18n(language, {
              en: "STRENGTHS",
              fr: "POINTS FORTS",
            })}
            entries={strengths}
            emptyLabel={i18n(language, {
              en: "Not enough data yet.",
              fr: "Pas encore assez de données.",
            })}
          />
          <TakeawayList
            tone="negative"
            title={i18n(language, {
              en: "WEAKNESSES",
              fr: "POINTS FAIBLES",
            })}
            entries={weaknesses}
            emptyLabel={i18n(language, {
              en: "Not enough data yet.",
              fr: "Pas encore assez de données.",
            })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

const TAKEAWAY_EMPTY = {
  en: "Not enough data yet.",
  fr: "Pas encore assez de données.",
} as const;

function GlobalScoreCard({
  score,
  results,
  language,
}: {
  score: GlobalFaceScore;
  results: NormalizedWorkerResult[];
  language: AppLanguage;
}) {
  const rank = getScoreRank(score.score);
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
  const { strengths, weaknesses } = React.useMemo(
    () => buildWorkerScoreboard(results, locale),
    [results, locale],
  );
  const hasTakeaways = strengths.length > 0 || weaknesses.length > 0;

  return (
    <Card className={analysisSurfaceCardClassName}>
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.06] blur-3xl"
        aria-hidden="true"
      />
      <CardContent className="relative space-y-5 p-6 sm:p-8">
        <div
          className={cn(
            "flex flex-col gap-8",
            hasTakeaways &&
              "lg:grid lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)] lg:items-stretch lg:gap-8 xl:grid-cols-[minmax(0,34%)_minmax(0,1fr)] xl:gap-10",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-col items-center text-center",
              hasTakeaways && "lg:pt-0.5",
            )}
          >
            <ScoreRing
              score={score.score}
              scale={100}
              fractionDigits={1}
              className="h-40 w-40 sm:h-44 sm:w-44"
            />
            <div
              className="mx-auto mt-5 max-w-xl rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-zinc-100 px-4 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_12px_rgba(15,23,42,0.06),0_16px_42px_-22px_rgba(0,0,0,0.65),0_0_0_1px_rgba(15,23,42,0.06)]"
            >
              <p className="font-display text-sm font-bold leading-snug text-zinc-900 sm:text-base">
                {rank.title}
              </p>
            </div>
            <GlobalTierRelativeCopy
              score0to100={score.score}
              rankIndex={rank.index}
              language={language}
            />
          </div>

          {hasTakeaways ? (
            <div className="flex min-h-0 min-w-0 flex-col justify-center border-t border-white/10 pt-8 lg:h-full lg:border-t-0 lg:border-l lg:border-white/10 lg:pl-6 xl:pl-8 lg:pt-2">
              <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start sm:justify-center sm:gap-4 lg:mt-1 lg:gap-5">
                <TakeawayList
                  tone="positive"
                  title={i18n(language, {
                    en: "STRENGTHS",
                    fr: "POINTS FORTS",
                  })}
                  entries={strengths}
                  emptyLabel={i18n(language, TAKEAWAY_EMPTY)}
                  wrapperClassName="w-full min-w-0 flex-1 basis-0 max-w-none sm:max-w-none"
                  roomyRows
                />
                <TakeawayList
                  tone="negative"
                  title={i18n(language, {
                    en: "WEAKNESSES",
                    fr: "POINTS FAIBLES",
                  })}
                  entries={weaknesses}
                  emptyLabel={i18n(language, TAKEAWAY_EMPTY)}
                  wrapperClassName="w-full min-w-0 flex-1 basis-0 max-w-none sm:max-w-none"
                  roomyRows
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <TierLadder
            activeIndex={rank.index}
            pslLabel={rank.pslLabel}
            language={language}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WorkerResultCard({
  result,
  href,
  language,
  scoreHighlight = "default",
}: {
  result: NormalizedWorkerResult;
  href: string;
  language: ReturnType<typeof useAppLanguage>;
  /** Green/red MiniRing when worker is in global top-3 strengths / weaknesses. */
  scoreHighlight?: MiniRingHighlight;
}) {
  const headlineScore = getWorkerPreviewHeadlineScore(
    result.worker,
    result.outputAggregates,
  );

  return (
    <Link
      href={href}
      id={workerCardId(result.worker)}
      className="group block h-full scroll-mt-24"
    >
      <Card
        className={cn(
          analysisSurfaceCardClassName,
          "h-full transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35",
        )}
      >
        <CardContent className="relative space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-left font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {getWorkerDisplayLabel(
                result.worker,
                language === "fr" ? "fr" : "en",
              )}
            </p>
            {headlineScore !== null ? (
              <MiniRing
                score={headlineScore}
                size={52}
                fractionDigits={2}
                highlight={scoreHighlight}
              />
            ) : null}
          </div>
          <WorkerPreviewContent
            worker={result.worker}
            aggregates={result.outputAggregates}
            language={language}
          />
        </CardContent>
      </Card>
    </Link>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function AnalysisResultsSection({
  analysis,
  isLoading,
}: AnalysisResultsSectionProps) {
  const language = useAppLanguage();

  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (!analysis) {
    return null;
  }

  const isAnalysisLoading = analysis.job.status === "queued" || analysis.job.status === "running";

  if (isAnalysisLoading) {
    return (
      <AnalysisProcessingState
        message={
          analysis.job.status === "queued"
            ? "Analyse en file d'attente..."
            : "Analyse ScoreMax en cours..."
        }
      />
    );
  }

  const results = sortWorkerResults(analysis.results.map(normalizeWorkerResult));
  const globalScore = calculateGlobalFaceScore(results);
  const buildWorkerHref = (worker: string) =>
    `/app/analyses/${analysis.job.id}/workers/${encodeURIComponent(worker)}`;

  const ageResult = results.find((r) => isAgeWorker(r.worker));
  const coloringResult = results.find((r) => r.worker === "coloring");
  const skinResult = results.find((r) => r.worker === "skin");
  const bodyfatResult = results.find((r) => r.worker === "bodyfat");
  const jawResult = results.find((r) => r.worker === "jaw");
  const chinResult = results.find((r) => r.worker === "chin");
  const lipsResult = results.find((r) => r.worker === "lips");
  const smileResult = results.find((r) => r.worker === "smile");
  const hairResult = results.find((r) => r.worker === "hair");
  const browsResult = results.find((r) => r.worker === "eye_brows");
  const cheeksResult = results.find((r) => r.worker === "cheeks");
  const eyesResult = results.find((r) => r.worker === "eyes");
  const noseResult = results.find((r) => r.worker === "nose");
  const neckResult = results.find((r) => r.worker === "neck");
  const earResult = results.find((r) => r.worker === "ear");
  const resultsAfterPinnedPairs = results.filter(
    (r) =>
      !isAgeWorker(r.worker) &&
      r.worker !== "coloring" &&
      r.worker !== "skin" &&
      r.worker !== "bodyfat" &&
      r.worker !== "jaw" &&
      r.worker !== "chin" &&
      r.worker !== "lips" &&
      r.worker !== "smile" &&
      r.worker !== "hair" &&
      r.worker !== "eye_brows" &&
      r.worker !== "cheeks" &&
      r.worker !== "eyes" &&
      r.worker !== "nose" &&
      r.worker !== "neck" &&
      r.worker !== "ear",
  );

  const { strengthSet: takeawayStrengthWorkers, weaknessSet: takeawayWeaknessWorkers } =
    React.useMemo(() => {
      const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";
      const { strengths, weaknesses } = buildWorkerScoreboard(results, locale);
      return {
        strengthSet: new Set(strengths.map((e) => e.worker)),
        weaknessSet: new Set(weaknesses.map((e) => e.worker)),
      };
    }, [results, language]);

  const workerPreviewScoreHighlight = (worker: string): MiniRingHighlight => {
    if (takeawayStrengthWorkers.has(worker)) return "strength";
    if (takeawayWeaknessWorkers.has(worker)) return "weakness";
    return "default";
  };

  return (
    <section className="space-y-5">
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto rounded-2xl border border-white/20 bg-white/[0.07] p-1.5 backdrop-blur-xl">
          <TabsTrigger value="overview" className={ANALYSIS_TAB_TRIGGER_CLASS}>
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="recommendations"
            className={ANALYSIS_TAB_TRIGGER_CLASS}
          >
            Recommandations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="flex flex-col gap-4">
            {globalScore ? (
              <GlobalScoreCard
                score={globalScore}
                results={results}
                language={language}
              />
            ) : (
              <KeyTakeawaysCard results={results} language={language} />
            )}
            {ageResult && coloringResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <AgeResultCard
                    key={`${ageResult.worker}-${ageResult.promptVersion}`}
                    result={ageResult}
                    href={buildWorkerHref(ageResult.worker)}
                    language={language}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${coloringResult.worker}-${coloringResult.promptVersion}`}
                    result={coloringResult}
                    href={buildWorkerHref(coloringResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(coloringResult.worker)}
                  />
                </div>
              </div>
            ) : ageResult ? (
              <AgeResultCard
                key={`${ageResult.worker}-${ageResult.promptVersion}`}
                result={ageResult}
                href={buildWorkerHref(ageResult.worker)}
                language={language}
              />
            ) : coloringResult ? (
              <WorkerResultCard
                key={`${coloringResult.worker}-${coloringResult.promptVersion}`}
                result={coloringResult}
                href={buildWorkerHref(coloringResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(coloringResult.worker)}
              />
            ) : null}
            {skinResult && bodyfatResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${skinResult.worker}-${skinResult.promptVersion}`}
                    result={skinResult}
                    href={buildWorkerHref(skinResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(skinResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${bodyfatResult.worker}-${bodyfatResult.promptVersion}`}
                    result={bodyfatResult}
                    href={buildWorkerHref(bodyfatResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(bodyfatResult.worker)}
                  />
                </div>
              </div>
            ) : skinResult ? (
              <WorkerResultCard
                key={`${skinResult.worker}-${skinResult.promptVersion}`}
                result={skinResult}
                href={buildWorkerHref(skinResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(skinResult.worker)}
              />
            ) : bodyfatResult ? (
              <WorkerResultCard
                key={`${bodyfatResult.worker}-${bodyfatResult.promptVersion}`}
                result={bodyfatResult}
                href={buildWorkerHref(bodyfatResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(bodyfatResult.worker)}
              />
            ) : null}
            {jawResult && chinResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${jawResult.worker}-${jawResult.promptVersion}`}
                    result={jawResult}
                    href={buildWorkerHref(jawResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(jawResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${chinResult.worker}-${chinResult.promptVersion}`}
                    result={chinResult}
                    href={buildWorkerHref(chinResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(chinResult.worker)}
                  />
                </div>
              </div>
            ) : jawResult ? (
              <WorkerResultCard
                key={`${jawResult.worker}-${jawResult.promptVersion}`}
                result={jawResult}
                href={buildWorkerHref(jawResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(jawResult.worker)}
              />
            ) : chinResult ? (
              <WorkerResultCard
                key={`${chinResult.worker}-${chinResult.promptVersion}`}
                result={chinResult}
                href={buildWorkerHref(chinResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(chinResult.worker)}
              />
            ) : null}
            {lipsResult && smileResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${lipsResult.worker}-${lipsResult.promptVersion}`}
                    result={lipsResult}
                    href={buildWorkerHref(lipsResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(lipsResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${smileResult.worker}-${smileResult.promptVersion}`}
                    result={smileResult}
                    href={buildWorkerHref(smileResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(smileResult.worker)}
                  />
                </div>
              </div>
            ) : lipsResult ? (
              <WorkerResultCard
                key={`${lipsResult.worker}-${lipsResult.promptVersion}`}
                result={lipsResult}
                href={buildWorkerHref(lipsResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(lipsResult.worker)}
              />
            ) : smileResult ? (
              <WorkerResultCard
                key={`${smileResult.worker}-${smileResult.promptVersion}`}
                result={smileResult}
                href={buildWorkerHref(smileResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(smileResult.worker)}
              />
            ) : null}
            {hairResult && browsResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${hairResult.worker}-${hairResult.promptVersion}`}
                    result={hairResult}
                    href={buildWorkerHref(hairResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(hairResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${browsResult.worker}-${browsResult.promptVersion}`}
                    result={browsResult}
                    href={buildWorkerHref(browsResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(browsResult.worker)}
                  />
                </div>
              </div>
            ) : hairResult ? (
              <WorkerResultCard
                key={`${hairResult.worker}-${hairResult.promptVersion}`}
                result={hairResult}
                href={buildWorkerHref(hairResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(hairResult.worker)}
              />
            ) : browsResult ? (
              <WorkerResultCard
                key={`${browsResult.worker}-${browsResult.promptVersion}`}
                result={browsResult}
                href={buildWorkerHref(browsResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(browsResult.worker)}
              />
            ) : null}
            {cheeksResult ? (
              <WorkerResultCard
                key={`${cheeksResult.worker}-${cheeksResult.promptVersion}`}
                result={cheeksResult}
                href={buildWorkerHref(cheeksResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(cheeksResult.worker)}
              />
            ) : null}
            {eyesResult && noseResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${eyesResult.worker}-${eyesResult.promptVersion}`}
                    result={eyesResult}
                    href={buildWorkerHref(eyesResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(eyesResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${noseResult.worker}-${noseResult.promptVersion}`}
                    result={noseResult}
                    href={buildWorkerHref(noseResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(noseResult.worker)}
                  />
                </div>
              </div>
            ) : eyesResult ? (
              <WorkerResultCard
                key={`${eyesResult.worker}-${eyesResult.promptVersion}`}
                result={eyesResult}
                href={buildWorkerHref(eyesResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(eyesResult.worker)}
              />
            ) : noseResult ? (
              <WorkerResultCard
                key={`${noseResult.worker}-${noseResult.promptVersion}`}
                result={noseResult}
                href={buildWorkerHref(noseResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(noseResult.worker)}
              />
            ) : null}
            {neckResult && earResult ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${neckResult.worker}-${neckResult.promptVersion}`}
                    result={neckResult}
                    href={buildWorkerHref(neckResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(neckResult.worker)}
                  />
                </div>
                <div className="min-w-0">
                  <WorkerResultCard
                    key={`${earResult.worker}-${earResult.promptVersion}`}
                    result={earResult}
                    href={buildWorkerHref(earResult.worker)}
                    language={language}
                    scoreHighlight={workerPreviewScoreHighlight(earResult.worker)}
                  />
                </div>
              </div>
            ) : neckResult ? (
              <WorkerResultCard
                key={`${neckResult.worker}-${neckResult.promptVersion}`}
                result={neckResult}
                href={buildWorkerHref(neckResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(neckResult.worker)}
              />
            ) : earResult ? (
              <WorkerResultCard
                key={`${earResult.worker}-${earResult.promptVersion}`}
                result={earResult}
                href={buildWorkerHref(earResult.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(earResult.worker)}
              />
            ) : null}
            {resultsAfterPinnedPairs.map((result) => (
              <WorkerResultCard
                key={`${result.worker}-${result.promptVersion}`}
                result={result}
                href={buildWorkerHref(result.worker)}
                language={language}
                scoreHighlight={workerPreviewScoreHighlight(result.worker)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0">
          <CriticalPointsRecommendations
            analysisJobId={analysis.job.id}
            results={results}
            language={language}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
