import * as React from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysisDetail } from "@/hooks/use-supabase";
import {
  buildAggregateDisplayEntries,
  getWorkerDisplayLabel,
} from "@/lib/face-analysis-display";
import { useAppLanguage } from "@/lib/i18n";
import { ColoringWorkerView } from "@/components/analysis/workers/ColoringWorkerView";
import { SkinWorkerView } from "@/components/analysis/workers/SkinWorkerView";
import { BodyfatWorkerView } from "@/components/analysis/workers/BodyfatWorkerView";
import { SymmetryShapeWorkerView } from "@/components/analysis/workers/SymmetryShapeWorkerView";
import { ArrowLeft } from "lucide-react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const workerDetailCardClassName = "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

function isNumericDisplayValue(value: string): boolean {
  return !Number.isNaN(Number(value.replace(",", ".")));
}

function isCompactValue(value: string): boolean {
  return value.length > 3 || !isNumericDisplayValue(value);
}

function isArgumentOnlyValue(entry: { value: string; description: string | null }): boolean {
  return !entry.description && !isNumericDisplayValue(entry.value) && entry.value.length > 40;
}

function WorkerDetailsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-44 rounded-full" />
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function WorkerDetails() {
  const params = useParams<{ jobId: string; worker: string }>();
  const worker = params.worker ? decodeURIComponent(params.worker) : "";
  const language = useAppLanguage();
  const { data: analysis, isLoading, isError } = useAnalysisDetail(params.jobId);

  if (isLoading) {
    return <WorkerDetailsSkeleton />;
  }

  const row = analysis?.results.find((result) => result.worker === worker);
  const resultPayload = row && isRecord(row.result) ? row.result : null;
  const outputAggregates = resultPayload && isRecord(resultPayload.outputAggregates)
    ? resultPayload.outputAggregates
    : {};
  const entries = buildAggregateDisplayEntries(worker, outputAggregates);

  if (isError || !analysis || !row) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" className="rounded-full border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-white shadow-[0_18px_45px_-35px_rgba(0,0,0,0.95)] hover:bg-white/15">
          <Link href={params.jobId ? `/app/analyses/${params.jobId}` : "/app"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l'analyse
          </Link>
        </Button>
        <Card className={workerDetailCardClassName}>
          <CardContent className="p-6">
            <h1 className="font-display text-2xl font-bold">Worker introuvable</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Ce détail n'existe pas pour cette analyse ou n'est pas accessible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="rounded-full border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-white shadow-[0_18px_45px_-35px_rgba(0,0,0,0.95)] hover:bg-white/15">
        <Link href={`/app/analyses/${analysis.job.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'analyse
        </Link>
      </Button>

      <Card className={workerDetailCardClassName}>
        <CardContent className="relative p-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white">
            {getWorkerDisplayLabel(worker)}
          </h1>
        </CardContent>
      </Card>

      {worker === "coloring" ? (
        <ColoringWorkerView aggregates={outputAggregates} language={language} />
      ) : worker === "skin" ? (
        <SkinWorkerView aggregates={outputAggregates} language={language} />
      ) : worker === "bodyfat" ? (
        <BodyfatWorkerView aggregates={outputAggregates} language={language} />
      ) : worker === "symmetry_shape" ? (
        <SymmetryShapeWorkerView
          aggregates={outputAggregates}
          language={language}
        />
      ) : entries.length === 0 ? (
        <Card className={workerDetailCardClassName}>
          <CardContent className="p-6 text-sm text-zinc-300">
            Aucun détail structuré disponible pour ce worker.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => {
            const argumentOnlyValue = isArgumentOnlyValue(entry);
            const compactValue = isCompactValue(entry.value);
            const detailText = argumentOnlyValue ? entry.value : entry.description;

            return (
              <Card
                key={entry.key}
                className={workerDetailCardClassName}
              >
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    {entry.label}
                  </p>
                  {argumentOnlyValue ? (
                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                      {detailText}
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-4 sm:grid-cols-[9rem_1fr] sm:items-start">
                      <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center">
                        <p
                          className={
                            compactValue
                              ? "truncate text-xl font-bold leading-tight tracking-tight text-white"
                              : "font-display text-4xl font-bold leading-none tracking-tight text-white"
                          }
                          title={entry.value}
                        >
                          {entry.value}
                        </p>
                      </div>
                      {detailText ? (
                        <p className="text-sm leading-relaxed text-zinc-300">
                          {detailText}
                        </p>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
