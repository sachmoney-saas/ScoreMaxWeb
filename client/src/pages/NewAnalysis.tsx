import * as React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Smartphone } from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnalysisJobStatus,
  useCreateManualAnalysisSession,
  useLaunchManualAnalysis,
  useManualAnalysisSessionStatus,
} from "@/hooks/use-supabase";
import {
  requiredScanAssetCodes,
  scanAssetLabels,
  uploadScanAsset,
} from "@/lib/face-analysis";
import { queryClient } from "@/lib/queryClient";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export default function NewAnalysis() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadingAssetCode, setUploadingAssetCode] = useState<OnboardingScanAssetCode | null>(null);
  const [uploadedAssetCodes, setUploadedAssetCodes] = useState<Set<OnboardingScanAssetCode>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createSessionMutation = useCreateManualAnalysisSession();
  const launchMutation = useLaunchManualAnalysis();
  const sessionStatus = useManualAnalysisSessionStatus(sessionId);
  const jobStatus = useAnalysisJobStatus(jobId);
  const isAnalyzing = jobStatus.data?.job.status === "queued" || jobStatus.data?.job.status === "running";
  const analysisMessage = jobStatus.data?.job.status === "running"
    ? "Analyse ScoreMax en cours..."
    : jobStatus.data?.job.status === "queued"
      ? "Analyse en file d'attente..."
      : launchMutation.isPending
        ? "Préparation du lancement..."
        : message;
  const completedAssetCount = sessionStatus.data?.completed_asset_count ?? 0;
  const requiredAssetCount = sessionStatus.data?.required_asset_count ?? requiredScanAssetCodes.length;
  const progressValue = requiredAssetCount > 0
    ? Math.round((completedAssetCount / requiredAssetCount) * 100)
    : 0;

  useEffect(() => {
    if (!user?.id || sessionId || createSessionMutation.isPending) {
      return;
    }

    createSessionMutation.mutate(undefined, {
      onSuccess: (data) => setSessionId(data.session.id),
      onError: (error) => setErrorMessage(getErrorMessage(error)),
    });
  }, [createSessionMutation, sessionId, user?.id]);

  useEffect(() => {
    if (jobStatus.data?.job.status !== "completed" || !user?.id) {
      return;
    }

    setMessage("Analyse terminée, redirection...");
    queryClient.invalidateQueries({ queryKey: ["analysis-history", user.id] });
    queryClient.invalidateQueries({ queryKey: ["latest-face-analysis", user.id] });
    const timeout = window.setTimeout(() => navigate("/app"), 800);

    return () => window.clearTimeout(timeout);
  }, [jobStatus.data?.job.status, navigate, user?.id]);

  useEffect(() => {
    if (jobStatus.data?.job.status === "failed") {
      setErrorMessage(jobStatus.data.job.error_message ?? "L'analyse a échoué.");
    }
  }, [jobStatus.data]);

  async function handleUpload(assetTypeCode: OnboardingScanAssetCode, file: File | null) {
    if (!file || !user?.id || !sessionId || isAnalyzing) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);
    setUploadingAssetCode(assetTypeCode);

    try {
      await uploadScanAsset({
        userId: user.id,
        sessionId,
        assetTypeCode,
        file,
      });
      setUploadedAssetCodes((current) => new Set(current).add(assetTypeCode));
      await queryClient.invalidateQueries({
        queryKey: ["manual-analysis-session-status", user.id, sessionId],
      });
      setMessage(`${scanAssetLabels[assetTypeCode]} ajoutée.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUploadingAssetCode(null);
    }
  }

  function handleLaunch() {
    if (!sessionId || !sessionStatus.data?.is_ready || isAnalyzing) {
      return;
    }

    setErrorMessage(null);
    setIsUploadDialogOpen(false);
    setMessage("Analyse en file d'attente...");
    launchMutation.mutate(sessionId, {
      onSuccess: (data) => {
        setJobId(data.job.id);
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ["analysis-history", user.id] });
          queryClient.invalidateQueries({ queryKey: ["latest-face-analysis", user.id] });
        }
      },
      onError: (error) => setErrorMessage(getErrorMessage(error)),
    });
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/15">
        <Link href="/app">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux analyses
        </Link>
      </Button>

      <section className="overflow-hidden rounded-[2.5rem] border border-white/20 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.26),transparent_30%),linear-gradient(145deg,rgba(9,15,22,0.94)_0%,rgba(24,34,43,0.9)_48%,rgba(155,181,190,0.24)_100%)] p-6 text-white shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] md:p-10">
        {isAnalyzing || launchMutation.isPending ? (
          <AnalysisProcessingState message={analysisMessage} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Mes analyses
              </p>
              <h1 className="font-display text-5xl font-bold tracking-[-0.07em] md:text-7xl">
                Nouvelle analyse
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-300 md:text-lg">
                Pour le moment, ajoute manuellement les captures nécessaires à ton analyse ScoreMax. Bientôt, tu pourras ouvrir l'application ScoreMax sur l'App Store pour prendre ces captures directement depuis ton téléphone.
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button
                  className="rounded-full bg-white text-slate-950 hover:bg-zinc-200"
                  disabled={!sessionId || createSessionMutation.isPending}
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Ajouter les captures
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  disabled={!sessionStatus.data?.is_ready || launchMutation.isPending || isAnalyzing}
                  onClick={handleLaunch}
                >
                  Lancer l'analyse
                </Button>
              </div>
              {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
              {errorMessage ? <p className="text-sm font-medium text-red-300">{errorMessage}</p> : null}
            </div>

            <div className="space-y-4 rounded-[2rem] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Capture mobile à venir</p>
                  <p className="text-sm text-zinc-300">
                    Le bouton ouvrira l'app mobile quand elle sera disponible.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Captures complétées</span>
                  <span>{completedAssetCount}/{requiredAssetCount}</span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
            </div>
          </div>
        )}
      </section>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto border-white/15 bg-[linear-gradient(135deg,rgba(10,16,22,0.98)_0%,rgba(18,27,35,0.96)_55%,rgba(255,255,255,0.06)_100%)] text-zinc-50 shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] sm:rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-tight text-zinc-50">
              Ajouter les captures
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Ajoute les 8 captures requises en JPG ou PNG. L'analyse pourra être lancée une fois le scan complet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {requiredScanAssetCodes.map((assetTypeCode) => {
                const isUploaded = uploadedAssetCodes.has(assetTypeCode) || !(sessionStatus.data?.missing_asset_types ?? []).includes(assetTypeCode);
                const isUploading = uploadingAssetCode === assetTypeCode;

                return (
                  <label
                    key={assetTypeCode}
                    className="flex min-h-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/10 bg-black/25 p-4 text-zinc-50 transition hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{scanAssetLabels[assetTypeCode]}</span>
                      {isUploaded ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-zinc-400" />
                      )}
                    </span>
                    <span className="text-sm text-zinc-400">
                      JPG ou PNG, capture nette et non filtrée.
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      disabled={!sessionId || isAnalyzing || isUploading}
                      onChange={(event) => {
                        void handleUpload(assetTypeCode, event.currentTarget.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                );
              })}
            </div>

            {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
            {errorMessage ? <p className="text-sm font-medium text-red-300">{errorMessage}</p> : null}

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2 sm:min-w-80">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Captures complétées</span>
                  <span>{completedAssetCount}/{requiredAssetCount}</span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
              <Button
                className="rounded-full bg-white text-slate-950 hover:bg-zinc-200"
                disabled={!sessionStatus.data?.is_ready || launchMutation.isPending || isAnalyzing}
                onClick={handleLaunch}
              >
                {launchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Lancer l'analyse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
