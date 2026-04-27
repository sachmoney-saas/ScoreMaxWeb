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
import { ArrowUpRight, ScanFace } from "lucide-react";

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

function formatWorkerLabel(worker: string): string {
  return worker
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAggregateLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function AggregateValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">Non renseigné</span>;
  }

  if (typeof value === "number") {
    return <span>{Number.isInteger(value) ? value : value.toFixed(2)}</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Oui" : "Non"}</span>;
  }

  if (typeof value === "string") {
    return <span>{value}</span>;
  }

  if (Array.isArray(value)) {
    return <span>{value.length} élément{value.length > 1 ? "s" : ""}</span>;
  }

  if (isRecord(value)) {
    return <span>{Object.keys(value).length} champ{Object.keys(value).length > 1 ? "s" : ""}</span>;
  }

  return <span>{String(value)}</span>;
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

function AggregateGrid({ aggregates }: { aggregates: Record<string, unknown> }) {
  const entries = Object.entries(aggregates);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
        Aucun agrégat structuré disponible pour ce worker.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {entries.slice(0, 6).map(([key, value]) => (
        <div
          key={key}
          className="rounded-xl border border-border/60 bg-background/70 p-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {formatAggregateLabel(key)}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground break-words">
            <AggregateValue value={value} />
          </p>
        </div>
      ))}
      {entries.length > 6 ? (
        <p className="text-xs text-muted-foreground">
          +{entries.length - 6} signal{entries.length - 6 > 1 ? "s" : ""} supplémentaire{entries.length - 6 > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}

function AgeResultCard({ result }: { result: NormalizedWorkerResult }) {
  const estimatedAge = extractEstimatedAge(result.outputAggregates);
  const displayedAge = estimatedAge === null ? "—" : Math.round(estimatedAge);

  return (
    <Link href="/app/age" className="group block h-full">
      <Card className="relative h-full overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/35">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute right-8 top-8 h-20 w-20 rounded-full border border-white/10" />
        <CardContent className="relative flex min-h-72 flex-col justify-between p-6">
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
                Comprendre<br />l'estimation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function WorkerResultCard({ result }: { result: NormalizedWorkerResult }) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {formatWorkerLabel(result.worker)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AggregateGrid aggregates={result.outputAggregates} />
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>Worker: {result.worker}</span>
          <span>{formatDate(result.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function AnalysisResultsSection({
  analysis,
  isLoading,
}: AnalysisResultsSectionProps) {
  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (!analysis) {
    return (
      <Card className="border-border/60 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5" />
            Résultats ScoreMax
          </CardTitle>
          <CardDescription>
            Termine ton onboarding pour générer ta première analyse complète.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const results = analysis.results.map(normalizeWorkerResult);

  return (
    <section className="space-y-5">
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto rounded-2xl border border-white/15 bg-white/10 p-1.5 backdrop-blur-xl">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-5 py-2.5 text-sm text-zinc-600 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="recommendations"
            className="rounded-xl px-5 py-2.5 text-sm text-zinc-600 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Recommandations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((result) =>
              isAgeWorker(result.worker) ? (
                <AgeResultCard
                  key={`${result.worker}-${result.promptVersion}`}
                  result={result}
                />
              ) : (
                <WorkerResultCard
                  key={`${result.worker}-${result.promptVersion}`}
                  result={result}
                />
              ),
            )}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0">
          <Card className="border-white/15 bg-white/10 shadow-sm backdrop-blur-xl">
            <CardContent className="p-6 text-sm text-slate-700">
              Les recommandations personnalisées arriveront ici avec les prochaines interprétations ScoreMax.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
