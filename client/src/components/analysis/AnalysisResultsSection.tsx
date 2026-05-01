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
import { getWorkerDisplayLabel } from "@/lib/face-analysis-display";
import { calculateGlobalFaceScore } from "@/lib/face-analysis-score";
import type { GlobalFaceScore } from "@/lib/face-analysis-score";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
import { WorkerPreviewContent } from "@/components/analysis/WorkerPreviewContent";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";
import {
  ArrowUpRight,
  AlertTriangle,
  Circle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Crown,
  Star,
  Gem,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const WORKER_DISPLAY_ORDER = [
  "age",
  "coloring",
  "skin",
  "bodyfat",
  "jaw",
  "eye_brows",
  "cheeks",
  "smile",
  "hair",
  "skin_tint",
  "neck",
  "lips",
  "chin",
  "nose",
  "ear",
  "eyes",
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
    <Card className="relative h-full overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute right-8 top-8 h-20 w-20 rounded-full border border-white/10" />
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
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
              <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-300 line-clamp-2">
                {argument}
              </p>
            ) : (
              <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
                {i18n(language, {
                  en: "Reading of your apparent age based on detected visual markers.",
                  fr: "Lecture de ton âge apparent basée sur les marqueurs visuels détectés.",
                })}
              </p>
            )}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 transition group-hover:bg-white/15">
            <ArrowUpRight className="h-4 w-4" />
          </span>
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

type ScoreRank = {
  index: number;
  title: string;
  pslLabel: string;
  Icon: LucideIcon;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
};

const SCORE_TIERS: {
  maxExclusive: number;
  title: string;
  pslLabel: string;
  Icon: LucideIcon;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
}[] = [
  {
    maxExclusive: 25,
    title: "Sub-human Bottom Percentile (PSL 1-2)",
    pslLabel: "PSL 1-2",
    Icon: AlertTriangle,
    color: "#f87171",
    badgeBg: "bg-rose-400/15",
    badgeText: "text-rose-200",
    badgeRing: "ring-rose-400/30",
  },
  {
    maxExclusive: 35,
    title: "Sub-5 / Low-Tier Sub-Normie (PSL 3)",
    pslLabel: "PSL 3",
    Icon: AlertTriangle,
    color: "#fb923c",
    badgeBg: "bg-orange-400/15",
    badgeText: "text-orange-200",
    badgeRing: "ring-orange-400/30",
  },
  {
    maxExclusive: 45,
    title: "LTN (Low-Tier Normie) / Invisible",
    pslLabel: "PSL 4",
    Icon: Circle,
    color: "#fbbf24",
    badgeBg: "bg-amber-400/15",
    badgeText: "text-amber-200",
    badgeRing: "ring-amber-400/30",
  },
  {
    maxExclusive: 55,
    title: "MTN (Mid-Tier Normie) / Ultimate NPC (PSL 4.5)",
    pslLabel: "PSL 4.5",
    Icon: Circle,
    color: "#facc15",
    badgeBg: "bg-yellow-400/15",
    badgeText: "text-yellow-200",
    badgeRing: "ring-yellow-400/30",
  },
  {
    maxExclusive: 60,
    title: "True Normie / Baseline (PSL 5)",
    pslLabel: "PSL 5",
    Icon: CheckCircle2,
    color: "#34d399",
    badgeBg: "bg-emerald-400/15",
    badgeText: "text-emerald-200",
    badgeRing: "ring-emerald-400/30",
  },
  {
    maxExclusive: 70,
    title: "HTN (High-Tier Normie) / Local Chad (PSL 5.5)",
    pslLabel: "PSL 5.5",
    Icon: TrendingUp,
    color: "#22d3ee",
    badgeBg: "bg-cyan-400/15",
    badgeText: "text-cyan-200",
    badgeRing: "ring-cyan-400/30",
  },
  {
    maxExclusive: 80,
    title: "Chadlite / Stacylite / Mogger (PSL 6)",
    pslLabel: "PSL 6",
    Icon: Star,
    color: "#60a5fa",
    badgeBg: "bg-sky-400/15",
    badgeText: "text-sky-200",
    badgeRing: "ring-sky-400/30",
  },
  {
    maxExclusive: 85,
    title: "Model-Tier Chad (PSL 7)",
    pslLabel: "PSL 7",
    Icon: Gem,
    color: "#a78bfa",
    badgeBg: "bg-violet-400/15",
    badgeText: "text-violet-200",
    badgeRing: "ring-violet-400/30",
  },
  {
    maxExclusive: 95,
    title: "Genetic Freak Gigachad PSL God (PSL 8)",
    pslLabel: "PSL 8",
    Icon: Sparkles,
    color: "#e9f1f4",
    badgeBg: "bg-zinc-200/15",
    badgeText: "text-zinc-100",
    badgeRing: "ring-zinc-200/30",
  },
  {
    maxExclusive: Infinity,
    title: "Alien Tier Ascended (PSL 9+)",
    pslLabel: "PSL 9+",
    Icon: Crown,
    color: "#fbbf24",
    badgeBg: "bg-amber-300/15",
    badgeText: "text-amber-100",
    badgeRing: "ring-amber-300/40",
  },
];

function getScoreRank(score: number): ScoreRank {
  for (let i = 0; i < SCORE_TIERS.length; i++) {
    if (score < SCORE_TIERS[i].maxExclusive) {
      return {
        index: i,
        title: SCORE_TIERS[i].title,
        pslLabel: SCORE_TIERS[i].pslLabel,
        Icon: SCORE_TIERS[i].Icon,
        color: SCORE_TIERS[i].color,
        badgeBg: SCORE_TIERS[i].badgeBg,
        badgeText: SCORE_TIERS[i].badgeText,
        badgeRing: SCORE_TIERS[i].badgeRing,
      };
    }
  }
  const last = SCORE_TIERS[SCORE_TIERS.length - 1];
  return {
    index: SCORE_TIERS.length - 1,
    title: last.title,
    pslLabel: last.pslLabel,
    Icon: last.Icon,
    color: last.color,
    badgeBg: last.badgeBg,
    badgeText: last.badgeText,
    badgeRing: last.badgeRing,
  };
}

function TierLadder({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label="Tier ladder"
    >
      {SCORE_TIERS.map((tier, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <div
            key={i}
            className="flex flex-1 items-center gap-1"
          >
            <div
              className={`h-1.5 flex-1 rounded-full transition ${
                isActive
                  ? ""
                  : isPast
                    ? "bg-white/40"
                    : "bg-white/10"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: tier.color,
                      boxShadow: `0 0 14px ${tier.color}80`,
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function GlobalScoreCard({
  score,
  language,
}: {
  score: GlobalFaceScore;
  language: AppLanguage;
}) {
  const rank = getScoreRank(score.score);
  const Icon = rank.Icon;

  return (
    <Card className="relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: `${rank.color}25` }}
      />
      <CardContent className="relative space-y-5 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-end gap-2">
            <h2 className="font-display text-7xl font-bold leading-none tracking-[-0.08em] text-white sm:text-8xl">
              {score.score}
            </h2>
            <span className="pb-2 text-base font-semibold text-zinc-400">
              / 100
            </span>
          </div>

          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${rank.badgeBg} ${rank.badgeRing}`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${rank.color}1f`,
                color: rank.color,
              }}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.16em] ${rank.badgeText}`}
              >
                {rank.pslLabel}
              </p>
              <p className="font-display text-sm font-bold leading-tight text-white sm:text-base">
                {rank.title}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <TierLadder activeIndex={rank.index} />
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            <span>
              {i18n(language, { en: "Sub-human", fr: "Sub-human" })}
            </span>
            <span>
              {i18n(language, { en: "Baseline", fr: "Baseline" })}
            </span>
            <span>
              {i18n(language, { en: "Alien tier", fr: "Tier alien" })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkerResultCard({
  result,
  href,
  language,
}: {
  result: NormalizedWorkerResult;
  href: string;
  language: ReturnType<typeof useAppLanguage>;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="relative h-full overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35">
        <CardContent className="relative space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {getWorkerDisplayLabel(result.worker)}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 transition group-hover:bg-white/15">
              <ArrowUpRight className="h-4 w-4" />
            </span>
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

  return (
    <section className="space-y-5">
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto rounded-2xl border border-white/15 bg-white/10 p-1.5 backdrop-blur-xl">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-5 py-2.5 text-sm text-black data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="recommendations"
            className="rounded-xl px-5 py-2.5 text-sm text-black data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Recommandations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="flex flex-col gap-4">
            {globalScore ? (
              <GlobalScoreCard score={globalScore} language={language} />
            ) : null}
            {results.map((result) =>
              isAgeWorker(result.worker) ? (
                <AgeResultCard
                  key={`${result.worker}-${result.promptVersion}`}
                  result={result}
                  href={buildWorkerHref(result.worker)}
                  language={language}
                />
              ) : (
                <WorkerResultCard
                  key={`${result.worker}-${result.promptVersion}`}
                  result={result}
                  href={buildWorkerHref(result.worker)}
                  language={language}
                />
              ),
            )}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0">
          <Card className="relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]">
            <CardContent className="relative p-6 text-sm text-zinc-300">
              Les recommandations personnalisées arriveront ici avec les prochaines interprétations ScoreMax.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
