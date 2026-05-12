import * as React from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Braces, CheckCircle2, Copy, MinusCircle, UserRound, XCircle } from "lucide-react";
import { useAdminAnalysisJobDetail } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildAdminAnalysisJobAssetUrl, type AdminAnalysisJobDetail } from "@/lib/admin-analysis";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getWorkerDisplayLabel } from "@/lib/face-analysis-display";
import { SCOREMAX_WORKER_WEIGHTS } from "@/lib/face-analysis-score";

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-white/10 bg-black/25 text-zinc-50">
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function ImageDataThumb({
  image,
}: {
  image: { imageId: string; mimeType: string; base64: string };
}) {
  return (
    <div className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2">
      <p className="truncate text-[11px] font-mono uppercase tracking-wide text-zinc-500">
        {image.imageId} · {image.mimeType}
      </p>
      <img
        alt={image.imageId}
        className="aspect-square w-full rounded-xl object-cover"
        src={`data:${image.mimeType};base64,${image.base64}`}
      />
    </div>
  );
}

function JobAssetThumb({ jobId, assetTypeCode }: { jobId: string; assetTypeCode: string }) {
  return (
    <AuthenticatedThumbnail
      src={buildAdminAnalysisJobAssetUrl(jobId, assetTypeCode)}
      alt={assetTypeCode}
      className="aspect-square w-full rounded-xl object-cover"
      fallback={<div className="flex aspect-square items-center justify-center text-xs text-zinc-500">—</div>}
    />
  );
}

type WorkerResultRow = AdminAnalysisJobDetail["results"][number];

type WorkerStatus = "success" | "failure" | "missing";

type WorkerRunInfo = {
  worker: string;
  /** `null` quand le worker n'a pas tourné du tout (aucune ligne en base). */
  row: WorkerResultRow | null;
  status: WorkerStatus;
  promptVersion: string | null;
  createdAt: string | null;
  /** Métadonnées extraites de `result` quand disponibles (peut rester à 0). */
  completedRuns: number | null;
  requestedRuns: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

/**
 * Statut d'exécution d'un worker pour l'onglet admin :
 * - `missing` : pas de ligne `analysis_results` (le worker n'a même pas tourné).
 * - `success` : au moins un run complété ET `outputAggregates` non vide.
 * - `failure` : ligne présente mais sans run complété ou sans agrégats exploitables.
 */
function classifyWorkerStatus(row: WorkerResultRow | null): WorkerStatus {
  if (!row) return "missing";
  if (!isRecord(row.result)) return "failure";
  const completed = readPositiveInt(row.result.completedRuns) ?? 0;
  const aggregates = row.result.outputAggregates;
  const hasAggregates =
    isRecord(aggregates) && Object.keys(aggregates).length > 0;
  return completed > 0 && hasAggregates ? "success" : "failure";
}

/**
 * Liste fusionnée : workers présents en base + workers attendus (référentiel
 * `SCOREMAX_WORKER_WEIGHTS`) qui n'ont pas de ligne — ces derniers sont marqués
 * comme `missing` pour qu'on voie d'un coup d'œil ceux qui ont totalement
 * échoué côté orchestrateur. Tri : succès → échec → manquant, puis alpha sur
 * le label affiché pour rester stable.
 */
function buildWorkerRunInfos(rows: readonly WorkerResultRow[]): WorkerRunInfo[] {
  const byWorker = new Map<string, WorkerResultRow>();
  for (const row of rows) byWorker.set(row.worker, row);

  const expected = Object.keys(SCOREMAX_WORKER_WEIGHTS);
  const allWorkers = new Set<string>(expected);
  byWorker.forEach((_, worker) => allWorkers.add(worker));

  const infos: WorkerRunInfo[] = Array.from(allWorkers).map((worker) => {
    const row = byWorker.get(worker) ?? null;
    const result = row && isRecord(row.result) ? row.result : null;
    return {
      worker,
      row,
      status: classifyWorkerStatus(row),
      promptVersion: row?.prompt_version ?? null,
      createdAt: row?.created_at ?? null,
      completedRuns: result ? readPositiveInt(result.completedRuns) : null,
      requestedRuns: result ? readPositiveInt(result.requestedRuns) : null,
    };
  });

  const statusOrder: Record<WorkerStatus, number> = {
    success: 0,
    failure: 1,
    missing: 2,
  };
  return infos.sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status];
    if (byStatus !== 0) return byStatus;
    return getWorkerDisplayLabel(a.worker).localeCompare(
      getWorkerDisplayLabel(b.worker),
      "fr",
    );
  });
}

function formatJobTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

function stringifyWorkerRowForAdmin(row: WorkerResultRow): string {
  try {
    return JSON.stringify(row, null, 2);
  } catch {
    return String(row);
  }
}

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  if (status === "success") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Succès
      </Badge>
    );
  }
  if (status === "failure") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-rose-500/40 bg-rose-500/10 text-rose-200"
      >
        <XCircle className="h-3.5 w-3.5" /> Échec
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
    >
      <MinusCircle className="h-3.5 w-3.5" /> Non exécuté
    </Badge>
  );
}

function WorkerRawJsonRow({
  info,
  onOpen,
}: {
  info: WorkerRunInfo;
  onOpen: (info: WorkerRunInfo) => void;
}) {
  const disabled = info.row === null;
  const runsSummary =
    info.completedRuns !== null && info.requestedRuns !== null
      ? `${info.completedRuns}/${info.requestedRuns} runs`
      : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <WorkerStatusBadge status={info.status} />
          <p className="font-mono text-xs text-zinc-400">{info.worker}</p>
        </div>
        <p className="truncate text-sm font-semibold text-white">
          {getWorkerDisplayLabel(info.worker)}
        </p>
        <p className="text-[11px] text-zinc-500">
          {info.promptVersion ? `prompt ${info.promptVersion}` : "prompt —"}
          {" · "}
          {formatJobTimestamp(info.createdAt)}
          {runsSummary ? ` · ${runsSummary}` : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="gap-2 self-start border-amber-500/40 text-xs text-amber-100 hover:bg-amber-500/10 hover:text-amber-50 disabled:opacity-50 sm:self-auto"
        onClick={() => onOpen(info)}
      >
        <Braces className="h-4 w-4" />
        {disabled ? "JSON indisponible" : "Voir JSON brut"}
      </Button>
    </div>
  );
}

function WorkersRawJsonCard({
  jobId,
  results,
}: {
  jobId: string;
  results: readonly WorkerResultRow[];
}) {
  const { toast } = useToast();
  const [openInfo, setOpenInfo] = React.useState<WorkerRunInfo | null>(null);
  const infos = React.useMemo(() => buildWorkerRunInfos(results), [results]);

  const successCount = infos.filter((info) => info.status === "success").length;
  const failureCount = infos.filter((info) => info.status === "failure").length;
  const missingCount = infos.filter((info) => info.status === "missing").length;

  const openRow = openInfo?.row ?? null;
  const openJson = React.useMemo(
    () => (openRow ? stringifyWorkerRowForAdmin(openRow) : ""),
    [openRow],
  );

  const handleCopy = (): void => {
    if (!openJson) return;
    void navigator.clipboard.writeText(openJson).then(() => {
      toast({
        title: "JSON copié",
        description: "Le payload du worker a été copié dans le presse-papiers.",
      });
    });
  };

  return (
    <DataCard
      title={`Workers (${infos.length}) · ${successCount} succès · ${failureCount} échec(s) · ${missingCount} non exécuté(s)`}
    >
      <p className="text-[11px] text-zinc-500">
        Job&nbsp;: <span className="font-mono text-zinc-400">{jobId}</span>
      </p>
      <div className="grid gap-2">
        {infos.map((info) => (
          <WorkerRawJsonRow
            key={info.worker}
            info={info}
            onOpen={setOpenInfo}
          />
        ))}
      </div>

      <Dialog open={openInfo !== null} onOpenChange={(open) => !open && setOpenInfo(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-[min(56rem,calc(100vw-2rem))] flex-col gap-0 border-zinc-700 bg-zinc-950 p-0 text-zinc-100">
          <DialogHeader className="space-y-1 border-b border-zinc-800 px-6 py-4 text-left">
            <DialogTitle className="text-white">
              {openInfo
                ? `Worker · ${getWorkerDisplayLabel(openInfo.worker)} (${openInfo.worker})`
                : "Worker"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Ligne `analysis_results` brute (même shape que l'API). Sert à inspecter ce qui a
              été réellement persisté côté serveur pour ce worker.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
            {openJson ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-100/95">
                {openJson}
              </pre>
            ) : (
              <p className="text-sm text-zinc-500">
                Aucune ligne `analysis_results` n'a été persistée pour ce worker.
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-zinc-800 px-6 py-4 sm:justify-between">
            <p className="mr-auto hidden text-left text-[11px] text-zinc-500 sm:block">
              Job&nbsp;: {jobId}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handleCopy}
              disabled={!openJson}
            >
              <Copy className="h-4 w-4" />
              Copier le JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataCard>
  );
}

const DISPLAY_GUIDE_TRACE_CODES = new Set([
  "GUIDE_TRACE_FACE_FRONT_OVAL",
  "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
  "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS",
  "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
  "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR",
  "GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY",
  "GUIDE_TRACE_FACE_FRONT_LIPS",
  "GUIDE_TRACE_PROFILE_LEFT_JAW",
  "GUIDE_TRACE_PROFILE_RIGHT_JAW",
  "GUIDE_TRACE_PROFILE_LEFT_NOSE",
  "GUIDE_TRACE_PROFILE_RIGHT_NOSE",
  "GUIDE_TRACE_LOOK_UP_JAW_ARC",
  "GUIDE_TRACE_SMILE_LIPS",
  "GUIDE_TRACE_SMILE_TEETH",
  "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS",
]);

export default function AdminAnalysisJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { data, isLoading, isError } = useAdminAnalysisJobDetail(params.jobId, {
    enabled: isAdmin,
  });
  const [tab, setTab] = React.useState<"oneshot" | "display" | "workers">(
    "oneshot",
  );

  if (!isAdmin) {
    return <div className="p-6 text-zinc-200">Accès refusé.</div>;
  }

  if (isLoading) {
    return <Skeleton className="h-[70vh] w-full" />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 p-6 text-zinc-100">
        <Button variant="ghost" className="gap-2" onClick={() => setLocation("/admin/analysis")}>
          <ArrowLeft className="h-4 w-4" /> Retour logs
        </Button>
        <Card className="border-white/10 bg-black/25">
          <CardContent className="p-6">Détail indisponible.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-zinc-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" className="gap-2 px-0 text-zinc-300 hover:bg-transparent hover:text-white" onClick={() => setLocation("/admin/analysis")}>
            <ArrowLeft className="h-4 w-4" /> Retour logs
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white">Analyse {data.job.id.slice(0, 8)}…</h1>
            <p className="text-sm text-zinc-400">{data.user_email ?? data.job.user_id}</p>
          </div>
        </div>
        <Button variant="outline" className="border-white/15 bg-black/25" asChild>
          <Link href={`/app/analyses/${data.job.id}?asUser=${data.job.user_id}`}>
            <UserRound className="mr-2 h-4 w-4" /> Impersonifier
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={cn("border-white/20 text-zinc-200")}>{data.job.status}</Badge>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as "oneshot" | "display" | "workers")
        }
      >
        <TabsList className="bg-black/25">
          <TabsTrigger value="oneshot">Images analysis</TabsTrigger>
          <TabsTrigger value="display">Images dessinées</TabsTrigger>
          <TabsTrigger value="workers">Workers · JSON brut</TabsTrigger>
        </TabsList>

        <TabsContent value="oneshot" className="mt-4 space-y-4">
          <DataCard title="8 images envoyées à oneshotapi">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.oneshot_images.map((image) => (
                <ImageDataThumb key={image.imageId} image={image} />
              ))}
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="display" className="mt-4 space-y-4">
          <DataCard
            title={`Images dessinées / guide traces (${
              data.linked_assets.filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code)).length
            })`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.linked_assets
                .filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code))
                .map((asset) => (
                  <div key={asset.scan_asset_id} className="space-y-2">
                    <p className="truncate text-[11px] uppercase tracking-wide text-zinc-500">{asset.asset_type_code}</p>
                    <JobAssetThumb jobId={data.job.id} assetTypeCode={asset.asset_type_code} />
                  </div>
                ))}
            </div>
            {data.linked_assets.filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code)).length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun guide trace lié.</p>
            ) : null}
          </DataCard>
        </TabsContent>

        <TabsContent value="workers" className="mt-4 space-y-4">
          <WorkersRawJsonCard jobId={data.job.id} results={data.results} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
