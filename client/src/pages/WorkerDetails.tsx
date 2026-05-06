import * as React from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysisDetail } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  buildAggregateDisplayEntries,
  getWorkerDisplayLabel,
} from "@/lib/face-analysis-display";
import { useAppLanguage } from "@/lib/i18n";
import { ColoringWorkerView } from "@/components/analysis/workers/ColoringWorkerView";
import { SkinWorkerView } from "@/components/analysis/workers/SkinWorkerView";
import { BodyfatWorkerView } from "@/components/analysis/workers/BodyfatWorkerView";
import { SymmetryShapeWorkerView } from "@/components/analysis/workers/SymmetryShapeWorkerView";
import { AgeWorkerView } from "@/components/analysis/workers/AgeWorkerView";
import { JawWorkerView } from "@/components/analysis/workers/JawWorkerView";
import { EyeBrowsWorkerView } from "@/components/analysis/workers/EyeBrowsWorkerView";
import { EyesWorkerView } from "@/components/analysis/workers/EyesWorkerView";
import { LipsWorkerView } from "@/components/analysis/workers/LipsWorkerView";
import { NoseWorkerView } from "@/components/analysis/workers/NoseWorkerView";
import { ChinWorkerView } from "@/components/analysis/workers/ChinWorkerView";
import { CheeksWorkerView } from "@/components/analysis/workers/CheeksWorkerView";
import { SmileWorkerView } from "@/components/analysis/workers/SmileWorkerView";
import { HairWorkerView } from "@/components/analysis/workers/HairWorkerView";
import { SkinTintWorkerView } from "@/components/analysis/workers/SkinTintWorkerView";
import { NeckWorkerView } from "@/components/analysis/workers/NeckWorkerView";
import { RecommendationsSection } from "@/components/analysis/RecommendationsSection";
import {
  analysisBackNavButtonClassName,
  analysisSurfaceCardClassName,
} from "@/components/analysis/workers/_shared";
import { AnalysisTopNavTabs } from "@/components/analysis/AnalysisTopNavTabs";
import { ArrowLeft, Braces, Copy } from "lucide-react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [adminPayloadOpen, setAdminPayloadOpen] = React.useState(false);
  const { data: analysis, isLoading, isError } = useAnalysisDetail(params.jobId);

  const row = React.useMemo(() => {
    if (!analysis) return undefined;
    return analysis.results.find((result) => result.worker === worker);
  }, [analysis, worker]);

  const resultPayload = row && isRecord(row.result) ? row.result : null;
  const outputAggregates = resultPayload && isRecord(resultPayload.outputAggregates)
    ? resultPayload.outputAggregates
    : {};
  const entries = buildAggregateDisplayEntries(worker, outputAggregates);

  const workerAdminPayload = React.useMemo(() => {
    if (!row) return null;
    return {
      worker: row.worker,
      prompt_version: row.prompt_version,
      created_at: row.created_at,
      result: row.result,
    };
  }, [row]);

  const workerAdminPayloadJson = React.useMemo(() => {
    if (!workerAdminPayload) return "";
    try {
      return JSON.stringify(workerAdminPayload, null, 2);
    } catch {
      return String(workerAdminPayload);
    }
  }, [workerAdminPayload]);

  const copyAdminPayload = (): void => {
    if (!workerAdminPayloadJson) return;
    void navigator.clipboard.writeText(workerAdminPayloadJson).then(() => {
      toast({
        title: "JSON copié",
        description: "Le payload du worker a été copié dans le presse-papiers.",
      });
    });
  };

  if (isLoading) {
    return <WorkerDetailsSkeleton />;
  }

  if (isError || !analysis || !row) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" className={analysisBackNavButtonClassName}>
          <Link href={params.jobId ? `/app/analyses/${params.jobId}` : "/app"}>
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Retour à l'analyse
          </Link>
        </Button>
        <Card className={analysisSurfaceCardClassName}>
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
      <AnalysisTopNavTabs jobId={analysis.job.id} active="worker" />

      <Button asChild variant="ghost" className={analysisBackNavButtonClassName}>
        <Link href={`/app/analyses/${analysis.job.id}`}>
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Retour à l'analyse
        </Link>
      </Button>

      <Card className={analysisSurfaceCardClassName}>
        <CardContent className="relative p-6 pr-24 sm:pr-44">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white">
            {getWorkerDisplayLabel(worker)}
          </h1>
          {isAdmin && workerAdminPayload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-4 top-4 max-w-[calc(100%-2rem)] gap-2 border-amber-500/40 text-xs text-amber-100 hover:bg-amber-500/10 hover:text-amber-50 sm:right-6 sm:top-6 sm:max-w-none sm:text-sm"
              onClick={() => setAdminPayloadOpen(true)}
            >
              <Braces className="h-4 w-4 shrink-0" />
              Données brutes (admin)
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={adminPayloadOpen} onOpenChange={setAdminPayloadOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[min(56rem,calc(100vw-2rem))] flex-col gap-0 border-zinc-700 bg-zinc-950 p-0 text-zinc-100">
          <DialogHeader className="space-y-1 border-b border-zinc-800 px-6 py-4 text-left">
            <DialogTitle className="text-white">Payload worker (admin)</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Valeurs persistées pour ce worker (même structure que l’API / la BDD) — pour comparaison
              avec le rendu front.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-100/95">
              {workerAdminPayloadJson}
            </pre>
          </div>
          <DialogFooter className="border-t border-zinc-800 px-6 py-4 sm:justify-between">
            <p className="mr-auto hidden text-left text-[11px] text-zinc-500 sm:block">
              Analyse&nbsp;: {analysis.job.id}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={copyAdminPayload}
              disabled={!workerAdminPayloadJson}
            >
              <Copy className="h-4 w-4" />
              Copier le JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderWorkerBody({
        worker,
        outputAggregates,
        entries,
        language,
        cardClassName: analysisSurfaceCardClassName,
      })}

      {entries.length > 0 ? (
        <RecommendationsSection
          worker={worker}
          aggregates={outputAggregates}
          language={language}
        />
      ) : null}
    </div>
  );
}

const DEDICATED_WORKER_VIEWS = new Set([
  "age",
  "coloring",
  "skin",
  "bodyfat",
  "symmetry_shape",
  "jaw",
  "eye_brows",
  "eyes",
  "lips",
  "nose",
  "chin",
  "cheeks",
  "smile",
  "hair",
  "skin_tint",
  "neck",
]);

function renderWorkerBody({
  worker,
  outputAggregates,
  entries,
  language,
  cardClassName,
}: {
  worker: string;
  outputAggregates: Record<string, unknown>;
  entries: ReturnType<typeof buildAggregateDisplayEntries>;
  language: ReturnType<typeof useAppLanguage>;
  cardClassName: string;
}): React.ReactNode {
  switch (worker) {
    case "age":           return <AgeWorkerView aggregates={outputAggregates} language={language} />;
    case "coloring":      return <ColoringWorkerView aggregates={outputAggregates} language={language} />;
    case "skin":          return <SkinWorkerView aggregates={outputAggregates} language={language} />;
    case "bodyfat":       return <BodyfatWorkerView aggregates={outputAggregates} language={language} />;
    case "symmetry_shape": return <SymmetryShapeWorkerView aggregates={outputAggregates} language={language} />;
    case "jaw":           return <JawWorkerView aggregates={outputAggregates} language={language} />;
    case "eye_brows":     return <EyeBrowsWorkerView aggregates={outputAggregates} language={language} />;
    case "eyes":          return <EyesWorkerView aggregates={outputAggregates} language={language} />;
    case "lips":          return <LipsWorkerView aggregates={outputAggregates} language={language} />;
    case "nose":          return <NoseWorkerView aggregates={outputAggregates} language={language} />;
    case "chin":          return <ChinWorkerView aggregates={outputAggregates} language={language} />;
    case "cheeks":        return <CheeksWorkerView aggregates={outputAggregates} language={language} />;
    case "smile":         return <SmileWorkerView aggregates={outputAggregates} language={language} />;
    case "hair":          return <HairWorkerView aggregates={outputAggregates} language={language} />;
    case "skin_tint":     return <SkinTintWorkerView aggregates={outputAggregates} language={language} />;
    case "neck":          return <NeckWorkerView aggregates={outputAggregates} language={language} />;
  }

  if (DEDICATED_WORKER_VIEWS.has(worker)) {
    return null;
  }

  if (entries.length === 0) {
    return (
      <Card className={cardClassName}>
        <CardContent className="p-6 text-sm text-zinc-300">
          Aucun détail structuré disponible pour ce worker.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map((entry) => {
        const argumentOnlyValue = isArgumentOnlyValue(entry);
        const compactValue = isCompactValue(entry.value);
        const detailText = argumentOnlyValue ? entry.value : entry.description;

        return (
          <Card key={entry.key} className={cardClassName}>
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
  );
}
