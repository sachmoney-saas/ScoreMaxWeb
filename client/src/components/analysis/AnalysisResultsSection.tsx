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
import { useAppLanguage } from "@/lib/i18n";
import { ArrowUpRight } from "lucide-react";

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

function AgeResultCard({
  result,
  href,
}: {
  result: NormalizedWorkerResult;
  href: string;
}) {
  const estimatedAge = extractEstimatedAge(result.outputAggregates);
  const displayedAge = estimatedAge === null ? "—" : Math.round(estimatedAge);

  const card = (
    <Card className="relative h-full overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute right-8 top-8 h-20 w-20 rounded-full border border-white/10" />
      <CardContent className="relative flex min-h-48 flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Âge estimé
            </p>
            <h2 className="mt-2 font-display text-6xl font-bold tracking-[-0.08em] text-white sm:text-7xl">
              {displayedAge}
              <span className="ml-2 text-xl tracking-normal text-zinc-300">ans</span>
            </h2>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 transition group-hover:bg-white/15">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="space-y-4">
          <div className="h-px bg-gradient-to-r from-white/5 via-white/30 to-white/5" />
          <div className="flex items-end justify-between gap-4">
            <p className="max-w-52 text-sm leading-relaxed text-zinc-300">
              Une lecture de ton âge apparent basée sur les marqueurs visuels détectés.
            </p>
            <p className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Voir tous<br />les détails
            </p>
          </div>
        </div>
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
  icon: string;
  title: string;
};

function getScoreRank(score: number): ScoreRank {
  if (score < 25) {
    return { icon: "🟠", title: "Sub-human Bottom Percentile (PSL 1-2)" };
  }
  if (score < 35) {
    return { icon: "🟠", title: "Sub-5 / Low-Tier Sub-Normie (PSL 3)" };
  }
  if (score < 45) {
    return { icon: "🟡", title: "LTN (Low-Tier Normie) / Invisible" };
  }
  if (score < 55) {
    return { icon: "🟡", title: "MTN (Mid-Tier Normie) / Ultimate NPC (PSL 4.5)" };
  }
  if (score < 60) {
    return { icon: "🟢", title: "True Normie / Baseline (PSL 5)" };
  }
  if (score < 70) {
    return { icon: "🔵", title: "HTN (High-Tier Normie) / Local Chad (PSL 5.5)" };
  }
  if (score < 80) {
    return { icon: "🔵", title: "Chadlite / Stacylite / Mogger (PSL 6)" };
  }
  if (score < 85) {
    return { icon: "🟣", title: "Model-Tier Chad (PSL 7)" };
  }
  if (score < 95) {
    return { icon: "⚫", title: "Genetic Freak Gigachad PSL God (PSL 8)" };
  }
  return { icon: "👑", title: "Alien Tier Ascended (PSL 9+)" };
}

function GlobalScoreCard({ score }: { score: GlobalFaceScore }) {
  const rank = getScoreRank(score.score);

  return (
    <Card className="relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]">
      <CardContent className="relative flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex items-end justify-center gap-3">
          <h2 className="font-display text-6xl font-bold tracking-[-0.08em] text-white sm:text-7xl">
            {score.score}
          </h2>
          <span className="pb-2 text-xl font-semibold text-zinc-300">/100</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-zinc-50">
          <span className="text-3xl" aria-hidden="true">{rank.icon}</span>
          <p className="text-lg font-semibold leading-tight md:text-2xl">
            {rank.title}
          </p>
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
            {globalScore ? <GlobalScoreCard score={globalScore} /> : null}
            {results.map((result) =>
              isAgeWorker(result.worker) ? (
                <AgeResultCard
                  key={`${result.worker}-${result.promptVersion}`}
                  result={result}
                  href={buildWorkerHref(result.worker)}
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
