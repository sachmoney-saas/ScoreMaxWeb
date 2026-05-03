import * as React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
} from "lucide-react";
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
  useRecentScanStatus,
} from "@/hooks/use-supabase";
import {
  getScanAssetLabels,
  requiredScanAssetCodes,
  uploadScanAsset,
} from "@/lib/face-analysis";
import { queryClient } from "@/lib/queryClient";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

/** Window (in minutes) used to consider iPhone-app uploads as fresh enough. */
const RECENT_SCAN_WINDOW_MINUTES = 60;

function getErrorMessage(error: unknown, language: AppLanguage): string {
  if (error instanceof Error) return error.message;
  return i18n(language, {
    en: "An error occurred.",
    fr: "Une erreur est survenue.",
  });
}

export default function NewAnalysis() {
  const language = useAppLanguage();
  const scanAssetLabels = getScanAssetLabels(language);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadingAssetCode, setUploadingAssetCode] =
    useState<OnboardingScanAssetCode | null>(null);
  const [uploadedAssetCodes, setUploadedAssetCodes] = useState<
    Set<OnboardingScanAssetCode>
  >(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const createSessionMutation = useCreateManualAnalysisSession();
  const launchMutation = useLaunchManualAnalysis();
  const sessionStatus = useManualAnalysisSessionStatus(sessionId, {
    enabled: !!sessionId,
  });
  /**
   * Polls assets uploaded by the iPhone app within the last hour.
   * Stops polling once is_ready, or once we've launched a job.
   */
  const recentScan = useRecentScanStatus({
    windowMinutes: RECENT_SCAN_WINDOW_MINUTES,
    enabled: !jobId,
  });
  const jobStatus = useAnalysisJobStatus(jobId);
  const jobStatusValue = jobStatus.data?.job.status;
  const isAnalyzing =
    jobStatusValue === "queued" || jobStatusValue === "running";

  const recentScanReady = Boolean(recentScan.data?.is_ready);
  const recentSessionId = recentScan.data?.latest_session_id ?? null;
  const manualSessionReady = Boolean(sessionStatus.data?.is_ready);
  const canLaunch = recentScanReady || manualSessionReady;
  const completedAssetCount = sessionStatus.data?.completed_asset_count ?? 0;
  const requiredAssetCount =
    sessionStatus.data?.required_asset_count ?? requiredScanAssetCodes.length;
  const progressValue =
    requiredAssetCount > 0
      ? Math.round((completedAssetCount / requiredAssetCount) * 100)
      : 0;

  const shouldShowProcessing =
    isAnalyzing ||
    launchMutation.isPending ||
    isFinalizing ||
    jobStatusValue === "completed";

  const analysisMessage =
    jobStatusValue === "completed" || isFinalizing
      ? i18n(language, {
          en: "Analysis completed, redirecting...",
          fr: "Analyse terminée, redirection...",
        })
      : jobStatusValue === "running"
        ? i18n(language, {
            en: "Running ScoreMax analysis...",
            fr: "Analyse ScoreMax en cours...",
          })
        : jobStatusValue === "queued"
          ? i18n(language, {
              en: "Analysis queued...",
              fr: "Analyse en file d'attente...",
            })
          : launchMutation.isPending
            ? i18n(language, {
                en: "Preparing launch...",
                fr: "Préparation du lancement...",
              })
            : message;

  /**
   * Lazy-creates a manual fallback session only when the user opens the
   * dialog. Avoids creating an empty session on every page mount.
   */
  const ensureManualSession = React.useCallback(() => {
    if (sessionId) return Promise.resolve(sessionId);
    return new Promise<string>((resolve, reject) => {
      createSessionMutation.mutate(undefined, {
        onSuccess: (data) => {
          setSessionId(data.session.id);
          resolve(data.session.id);
        },
        onError: (error) => reject(error),
      });
    });
  }, [createSessionMutation, sessionId]);

  async function openManualUpload() {
    setErrorMessage(null);
    try {
      await ensureManualSession();
      setIsUploadDialogOpen(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
    }
  }

  useEffect(() => {
    if (jobStatusValue !== "completed" || !user?.id || isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    setMessage(
      i18n(language, {
        en: "Analysis completed, redirecting...",
        fr: "Analyse terminée, redirection...",
      }),
    );

    let cancelled = false;
    void Promise.allSettled([
      queryClient.refetchQueries({
        queryKey: ["latest-face-analysis", user.id],
      }),
      queryClient.refetchQueries({
        queryKey: ["analysis-history", user.id],
      }),
    ]).then(() => {
      if (cancelled) return;
      navigate("/app");
    });

    return () => {
      cancelled = true;
    };
  }, [jobStatusValue, navigate, user?.id, isFinalizing, language]);

  useEffect(() => {
    if (jobStatus.data?.job.status === "failed") {
      setErrorMessage(
        jobStatus.data.job.error_message ??
          i18n(language, {
            en: "The analysis failed.",
            fr: "L'analyse a échoué.",
          }),
      );
    }
  }, [jobStatus.data, language]);

  async function handleUpload(
    assetTypeCode: OnboardingScanAssetCode,
    file: File | null,
  ) {
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
        lang: language,
      });
      setUploadedAssetCodes((current) => new Set(current).add(assetTypeCode));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["manual-analysis-session-status", user.id, sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["recent-scan-status", user.id],
        }),
      ]);
      setMessage(
        `${scanAssetLabels[assetTypeCode]} ${i18n(language, {
          en: "added.",
          fr: "ajoutée.",
        })}`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
    } finally {
      setUploadingAssetCode(null);
    }
  }

  function handleLaunch() {
    if (!canLaunch || launchMutation.isPending || isAnalyzing) {
      return;
    }

    /**
     * Prefer the session that holds the freshly uploaded assets. Fall back
     * to the lazily-created manual session if the user used the dialog.
     */
    const targetSessionId = recentSessionId ?? sessionId;
    if (!targetSessionId) {
      setErrorMessage(
        i18n(language, {
          en: "No scan session available yet.",
          fr: "Aucune session de scan disponible.",
        }),
      );
      return;
    }

    setErrorMessage(null);
    setIsUploadDialogOpen(false);
    setMessage(
      i18n(language, {
        en: "Analysis queued...",
        fr: "Analyse en file d'attente...",
      }),
    );
    launchMutation.mutate(targetSessionId, {
      onSuccess: (data) => setJobId(data.job.id),
      onError: (error) => setErrorMessage(getErrorMessage(error, language)),
    });
  }

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        className="rounded-full bg-white/10 text-white hover:bg-white/15"
      >
        <Link href="/app">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {i18n(language, {
            en: "Back to analyses",
            fr: "Retour aux analyses",
          })}
        </Link>
      </Button>

      <section className="overflow-hidden rounded-[2.5rem] border border-white/20 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.26),transparent_30%),linear-gradient(145deg,rgba(9,15,22,0.94)_0%,rgba(24,34,43,0.9)_48%,rgba(155,181,190,0.24)_100%)] p-6 text-white shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] md:p-10">
        {shouldShowProcessing ? (
          <AnalysisProcessingState message={analysisMessage} />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] sm:p-8">
              <div className="text-center">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {i18n(language, {
                    en: "New analysis",
                    fr: "Nouvelle analyse",
                  })}
                </p>
                <h1 className="mt-2 text-[1.65rem] font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-[2rem]">
                  {i18n(language, {
                    en: "Start your new analysis",
                    fr: "Lance ta nouvelle analyse",
                  })}
                </h1>
              </div>

              <ul className="mt-5 space-y-2.5">
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                    <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                      {i18n(language, {
                        en: "Uses infrared sensors for the most precise facial analysis possible (",
                        fr: "Permet d'utiliser les capteurs infrarouge pour l'analyse faciale la plus précise possible (",
                      })}
                      <em>
                        {i18n(language, {
                          en: "iPhone X and newer",
                          fr: "iPhone X et +",
                        })}
                      </em>
                      ).
                    </p>
                  </div>
                </li>
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                    <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                      {i18n(language, {
                        en: "Most competitors rely on simple photos, which is far less precise.",
                        fr: "Nos concurrents utilisent de simples photos : ce n'est pas précis.",
                      })}
                    </p>
                  </div>
                </li>
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                    <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                      {i18n(language, {
                        en: "Anti-cheat live capture verifies it's really you, not a static photo upload.",
                        fr: "Nous empêchons la triche : la capture est faite en direct sur toi et empêche l'usage de simples photos.",
                      })}
                    </p>
                  </div>
                </li>
              </ul>

              <div className="mt-5">
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black p-3 text-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] transition hover:bg-[#050505]"
                >
                  <img
                    src="/favicon.png"
                    alt="ScoreMax"
                    className="h-10 w-10 rounded-lg bg-black object-contain"
                  />
                  <span className="text-sm font-semibold tracking-tight sm:text-base">
                    {i18n(language, {
                      en: "ScoreMax 3D Infrared Scan",
                      fr: "ScoreMax Scan 3D Infrarouge",
                    })}
                  </span>
                  <Download className="h-5 w-5 shrink-0" />
                </a>
              </div>

              {canLaunch ? (
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={launchMutation.isPending}
                  className="mx-auto mt-4 flex min-h-[68px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgba(5,150,105,0.85)] transition hover:bg-emerald-700 disabled:opacity-60 sm:min-h-[76px]"
                >
                  {launchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  <span>
                    {i18n(language, {
                      en: "Launch analysis",
                      fr: "Lancer l'analyse",
                    })}
                  </span>
                </button>
              ) : (
                <div className="mx-auto mt-4 flex min-h-[68px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 sm:min-h-[76px]">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  <span>
                    {i18n(language, {
                      en: "Waiting for the iPhone app capture...",
                      fr: "En attente de la capture iPhone...",
                    })}
                  </span>
                </div>
              )}

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => void openManualUpload()}
                  className="text-xs font-medium text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline"
                  disabled={createSessionMutation.isPending}
                >
                  {i18n(language, {
                    en: "Or add captures manually",
                    fr: "Ou ajouter les captures manuellement",
                  })}
                </button>
              </div>

              {message ? (
                <p className="mt-4 text-center text-sm text-slate-500">
                  {message}
                </p>
              ) : null}
              {errorMessage ? (
                <p className="mt-4 text-center text-sm font-medium text-red-600">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto border-white/15 bg-[linear-gradient(135deg,rgba(10,16,22,0.98)_0%,rgba(18,27,35,0.96)_55%,rgba(255,255,255,0.06)_100%)] text-zinc-50 shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] sm:rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-tight text-zinc-50">
              {i18n(language, {
                en: "Add captures",
                fr: "Ajouter les captures",
              })}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {i18n(language, {
                en: "Upload the 8 required captures in JPG or PNG. The analysis can launch once the scan is complete.",
                fr: "Ajoute les 8 captures requises en JPG ou PNG. L'analyse pourra être lancée une fois le scan complet.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {requiredScanAssetCodes.map((assetTypeCode) => {
                const isUploaded =
                  uploadedAssetCodes.has(assetTypeCode) ||
                  !(sessionStatus.data?.missing_asset_types ?? []).includes(
                    assetTypeCode,
                  );
                const isUploading = uploadingAssetCode === assetTypeCode;

                return (
                  <label
                    key={assetTypeCode}
                    className="flex min-h-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/10 bg-black/25 p-4 text-zinc-50 transition hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">
                        {scanAssetLabels[assetTypeCode]}
                      </span>
                      {isUploaded ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-zinc-400" />
                      )}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {i18n(language, {
                        en: "JPG or PNG, sharp and unfiltered.",
                        fr: "JPG ou PNG, capture nette et non filtrée.",
                      })}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      disabled={!sessionId || isAnalyzing || isUploading}
                      onChange={(event) => {
                        void handleUpload(
                          assetTypeCode,
                          event.currentTarget.files?.[0] ?? null,
                        );
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                );
              })}
            </div>

            {message ? (
              <p className="text-sm text-zinc-300">{message}</p>
            ) : null}
            {errorMessage ? (
              <p className="text-sm font-medium text-red-300">{errorMessage}</p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2 sm:min-w-80">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>
                    {i18n(language, {
                      en: "Captures completed",
                      fr: "Captures complétées",
                    })}
                  </span>
                  <span>
                    {completedAssetCount}/{requiredAssetCount}
                  </span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
              <Button
                className="rounded-full bg-white text-slate-950 hover:bg-zinc-200"
                disabled={
                  !manualSessionReady ||
                  launchMutation.isPending ||
                  isAnalyzing
                }
                onClick={handleLaunch}
              >
                {launchMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {i18n(language, {
                  en: "Launch analysis",
                  fr: "Lancer l'analyse",
                })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
