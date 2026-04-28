import * as React from "react";
import { Link } from "wouter";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, SunMedium } from "lucide-react";

type AgeWorkerResult = {
  worker: string;
  outputAggregates: Record<string, unknown>;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeAgeResult(result: unknown, fallbackWorker: string, createdAt: string): AgeWorkerResult {
  const payload = isRecord(result) ? result : {};
  const aggregates = isRecord(payload.outputAggregates) ? payload.outputAggregates : {};

  return {
    worker: typeof payload.worker === "string" ? payload.worker : fallbackWorker,
    outputAggregates: aggregates,
    createdAt,
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AgeDetails() {
  const { data: latestAnalysis, isLoading } = useLatestFaceAnalysis();
  const ageRow = latestAnalysis?.results.find((result) => result.worker === "age");
  const ageResult = ageRow
    ? normalizeAgeResult(ageRow.result, ageRow.worker, ageRow.created_at)
    : null;
  const estimatedAge = ageResult
    ? extractEstimatedAge(ageResult.outputAggregates)
    : null;
  const displayedAge = estimatedAge === null ? "—" : Math.round(estimatedAge);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-80 rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/15">
        <Link href="/app">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux résultats
        </Link>
      </Button>

      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.28),transparent_32%),linear-gradient(145deg,rgba(7,12,18,0.94)_0%,rgba(23,35,43,0.9)_45%,rgba(172,194,200,0.28)_100%)] p-6 text-white shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-16 top-16 h-32 w-32 rounded-full border border-white/10" />
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Âge apparent ScoreMax
            </p>
            <div className="flex items-end gap-3">
              <h1 className="font-display text-8xl font-bold tracking-[-0.09em] md:text-[9rem]">
                {displayedAge}
              </h1>
              <span className="mb-5 text-2xl text-zinc-300">ans</span>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-zinc-300 md:text-lg">
              Cette estimation représente l'âge visuel perçu sur ta photo, pas ton âge biologique. Elle peut varier selon la lumière, l'angle et l'expression.
            </p>
          </div>

          <Card className="border-white/15 bg-white/10 text-white backdrop-blur-xl">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <SunMedium className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Lecture à interpréter avec nuance</p>
                  <p className="text-sm text-zinc-300">
                    Dernière analyse: {formatDate(latestAnalysis?.job.completed_at ?? latestAnalysis?.job.created_at)}
                  </p>
                </div>
              </div>
              <div className="h-px bg-white/15" />
              <p className="text-sm leading-relaxed text-zinc-300">
                Pour suivre ton évolution, compare toujours des photos prises dans des conditions proches: face caméra, lumière naturelle, distance stable et sans filtre.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-slate-200 bg-white/95 text-slate-950 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <CardContent className="p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Interprétations
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">
            En attente des interprétations ScoreMax
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Cette page affichera uniquement des explications issues des données retournées par l'API. Les textes génériques ont été retirés pour éviter d'afficher des interprétations non reliées à l'analyse réelle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
