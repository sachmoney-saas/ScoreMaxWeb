import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  Loader2,
  Lock,
  ScanFace,
} from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { FaceCaptureView } from "@/components/FaceCaptureView";
import { AnalysisProcessingState, analysisElapsedAnchorEpochMs } from "@/components/analysis/AnalysisProcessingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnalysisJobStatus,
  useCreateManualAnalysisSession,
  useLaunchManualAnalysis,
  useRecentScanStatus,
  useSubscriberStandardAnalysisQuota,
} from "@/hooks/use-supabase";
import {
  getScanAssetLabels,
  resetScanSessionAssets,
  uploadScanAsset,
} from "@/lib/face-analysis";
import { guideTraceBlobUploadsFromCapturedPose } from "@/lib/guide-trace-scan-uploads";
import { buildAnalysisSupportMessage } from "@/lib/analysis-error-message";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import { CAPTURE_POSES, type PoseId } from "@/lib/face-capture/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  analysisBackNavButtonClassName,
  analysisHeroGlassClassName,
} from "@/components/analysis/workers/_shared";
import { queryClient } from "@/lib/queryClient";
import { formatSubscriberStandardQuotaSidebarLine } from "@/lib/subscriber-standard-analysis-copy";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

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
  const { user, hasPremiumAccess, profile, isAdmin, isLoading: authLoading } = useAuth();
  const isManualAnalysisLocked = !authLoading && !hasPremiumAccess;

  const { data: subscriberQuota, isLoading: subscriberQuotaLoading } =
    useSubscriberStandardAnalysisQuota();

  const isWeeklyAnalysisLocked =
    !authLoading &&
    hasPremiumAccess &&
    Boolean(profile?.is_subscriber) &&
    !isAdmin &&
    subscriberQuota?.weekly_limit_applies === true &&
    subscriberQuota.can_launch_standard_now === false;

  const subscriberQuotaBlockingUi =
    Boolean(profile?.is_subscriber) &&
    !isAdmin &&
    hasPremiumAccess &&
    subscriberQuotaLoading;

  const weeklyQuotaOverlayLine =
    subscriberQuota && isWeeklyAnalysisLocked
      ? formatSubscriberStandardQuotaSidebarLine(language, subscriberQuota)
      : null;

  const heroContentLocked =
    isManualAnalysisLocked ||
    isWeeklyAnalysisLocked ||
    subscriberQuotaBlockingUi;

  const recentScanStatus = useRecentScanStatus({
    enabled: !authLoading && hasPremiumAccess && !heroContentLocked,
  });
  const recentScan = recentScanStatus.data;
  const hasRecentAppScan = Boolean(recentScan && recentScan.received_count > 0);
  const canLaunchRecentAppScan = Boolean(
    recentScan?.is_ready && recentScan.latest_session_id,
  );
  const recentMissingLabels = (recentScan?.missing_asset_types ?? []).map(
    (code) => scanAssetLabels[code] ?? code,
  );

  const [, navigate] = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [capturedPoses, setCapturedPoses] = useState<CapturedPose[]>([]);
  const [showCapturedPreview, setShowCapturedPreview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [isRetakingCaptures, setIsRetakingCaptures] = useState(false);

  const createSessionMutation = useCreateManualAnalysisSession();
  const launchMutation = useLaunchManualAnalysis();
  const jobStatus = useAnalysisJobStatus(jobId);
  const jobStatusValue = jobStatus.data?.job.status;
  const isAnalyzing =
    jobStatusValue === "queued" || jobStatusValue === "running";
  const hasJobStatusError = jobStatus.isError;

  /**
   * Single source of truth for "show the processing card vs the launch CTA".
   * Includes `Boolean(jobId)` so the UI stays on the processing card across the
   * brief gaps between (a) launch mutation resolving and (b) the first
   * `jobStatus` fetch reporting "queued" — otherwise the launch CTA flashes
   * back for one render. Failed jobs and polling errors are excluded so the
   * inline error surfaces instead of trapping the user in the loader.
   */
  const shouldShowProcessing =
    !hasJobStatusError &&
    jobStatusValue !== "failed" &&
    (isAnalyzing ||
      launchMutation.isPending ||
      isUploadingAll ||
      Boolean(jobId) ||
      jobStatusValue === "completed");

  const analysisMessage =
    jobStatusValue === "completed"
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
            : isUploadingAll
              ? i18n(language, {
                  en: "Preparing your analysis...",
                  fr: "Préparation de l'analyse...",
                })
              : message;

  /**
   * Lazy-creates a scan session when the user starts camera capture.
   * Avoids creating an empty session on every page mount.
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

  /**
   * Map our internal PoseId → the Supabase asset type code expected by the backend.
   */
  const poseIdToAssetCode: Record<PoseId, OnboardingScanAssetCode> = {
    frontal: "FACE_FRONT",
    "profile-right": "PROFILE_RIGHT",
    "profile-left": "PROFILE_LEFT",
    "jaw-up": "LOOK_UP",
    "crown-down": "LOOK_DOWN",
    "closeup-eye": "EYE_CLOSEUP",
    "closeup-smile": "SMILE",
  };

  const handleCapturedComplete = useCallback(
    async (poses: CapturedPose[]) => {
      setCapturedPoses(poses);
      setShowCameraCapture(false);
      setShowCapturedPreview(true);
      setErrorMessage(null);
    },
    [],
  );

  async function handleRetakeFromPreview() {
    setErrorMessage(null);
    /**
     * Le reset serveur doit rester disponible même si le lancement est bloqué
     * par le quota hebdo (sinon anciens blobs / lignes orphan restent après « Refaire »).
     */
    if (!user?.id || !sessionId || !hasPremiumAccess) {
      setCapturedPoses([]);
      setShowCapturedPreview(false);
      setShowCameraCapture(true);
      return;
    }

    setIsRetakingCaptures(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const accessToken = authSession?.access_token;
      if (!accessToken) {
        throw new Error(
          i18n(language, {
            en: "Supabase session not found",
            fr: "Session Supabase introuvable",
          }),
        );
      }

      await resetScanSessionAssets({ accessToken, sessionId });

      await queryClient.invalidateQueries({
        queryKey: ["manual-analysis-session-status", user.id, sessionId],
      });

      setCapturedPoses([]);
      setShowCapturedPreview(false);
      setShowCameraCapture(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
    } finally {
      setIsRetakingCaptures(false);
    }
  }

  /**
   * Upload all captured poses to R2, then launch the analysis.
   *
   * Captures are first PUT to Cloudflare R2 via signed URLs (`uploadScanAsset`),
   * then `launchManualAnalysis` queues the job server-side, which downloads the
   * R2 objects and forwards them as base64 to the upstream analysis API.
   *
   * The preview dialog is kept open until the launch is queued. Combined with
   * `Boolean(jobId)` in `shouldShowProcessing`, this removes the brief flash
   * back to the launch CTA between the dialog closing and the first
   * `jobStatus` fetch reporting "queued".
   */
  async function handleUploadAllCaptured() {
    if (
      !user?.id ||
      !sessionId ||
      !hasPremiumAccess ||
      isWeeklyAnalysisLocked ||
      subscriberQuotaBlockingUi
    ) {
      return;
    }
    setIsUploadingAll(true);
    setErrorMessage(null);

    const codes: OnboardingScanAssetCode[] = [];
    try {
      for (const pose of capturedPoses) {
        const code = poseIdToAssetCode[pose.poseId];
        if (!code) continue;

        await uploadScanAsset({
          userId: user.id,
          sessionId,
          assetTypeCode: code,
          file: new File([pose.blob], `${pose.poseId}.jpg`, {
            type: "image/jpeg",
          }),
          lang: language,
        });
        codes.push(code);

        for (const trace of guideTraceBlobUploadsFromCapturedPose(pose)) {
          await uploadScanAsset({
            userId: user.id,
            sessionId,
            assetTypeCode: trace.assetTypeCode,
            file: new File(
              [trace.blob],
              `${pose.poseId}-guide-${trace.fileLabel}.png`,
              { type: "image/png" },
            ),
            lang: language,
            captureMetadata: trace.captureMetadata,
          });
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ["manual-analysis-session-status", user.id, sessionId],
      });

      setMessage(
        i18n(language, {
          en: `${codes.length} poses ready.`,
          fr: `${codes.length} poses prêtes.`,
        }),
      );

      const data = await launchMutation.mutateAsync(sessionId);
      setJobId(data.job.id);
      setMessage(
        i18n(language, {
          en: "Analysis queued...",
          fr: "Analyse en file d'attente...",
        }),
      );
      setShowCapturedPreview(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
    } finally {
      setIsUploadingAll(false);
    }
  }

  async function handleLaunchRecentAppScan() {
    const appSessionId = recentScan?.latest_session_id;
    if (
      !user?.id ||
      !appSessionId ||
      !recentScan?.is_ready ||
      !hasPremiumAccess ||
      isWeeklyAnalysisLocked ||
      subscriberQuotaBlockingUi
    ) {
      return;
    }

    setErrorMessage(null);
    setMessage(
      i18n(language, {
        en: "Preparing launch...",
        fr: "Préparation du lancement...",
      }),
    );

    try {
      const data = await launchMutation.mutateAsync(appSessionId);
      setSessionId(appSessionId);
      setJobId(data.job.id);
      setMessage(
        i18n(language, {
          en: "Analysis queued...",
          fr: "Analyse en file d'attente...",
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: ["recent-scan-status", user.id],
      });
      setShowCameraCapture(false);
      setShowCapturedPreview(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
    }
  }

  /** Opens the live camera capture flow. */
  function openCameraCapture() {
    setErrorMessage(null);
    if (authLoading || !hasPremiumAccess) return;
    if (subscriberQuotaBlockingUi || isWeeklyAnalysisLocked) return;
    void ensureManualSession().then(() => setShowCameraCapture(true));
  }

  useEffect(() => {
    if (!heroContentLocked) return;
    setShowCameraCapture(false);
    setShowCapturedPreview(false);
  }, [heroContentLocked]);

  /**
   * When the job completes, refresh dashboard queries then navigate.
   *
   * Do **not** gate this on a local `isFinalizing` flag that is also listed in
   * the effect deps: `setIsFinalizing(true)` re-runs the effect, the previous
   * run's cleanup sets `cancelled = true`, and the new run bails out because
   * `isFinalizing` is already true — so `navigate` never fires (loader stuck).
   */
  useEffect(() => {
    if (jobStatusValue !== "completed" || !user?.id) {
      return;
    }

    setMessage(
      i18n(language, {
        en: "Analysis completed, redirecting...",
        fr: "Analyse terminée, redirection...",
      }),
    );

    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) navigate("/app");
    }, 12_000);

    void Promise.allSettled([
      queryClient.refetchQueries({
        queryKey: ["latest-face-analysis", user.id],
      }),
      queryClient.refetchQueries({
        queryKey: ["analysis-history", user.id],
      }),
    ]).finally(() => {
      if (cancelled) return;
      window.clearTimeout(fallbackTimer);
      navigate("/app");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [jobStatusValue, navigate, user?.id, language]);

  useEffect(() => {
    if (jobStatus.data?.job.status === "failed") {
      setErrorMessage(
        buildAnalysisSupportMessage({
          language,
          errorCode: jobStatus.data.job.error_code,
          errorMessage: jobStatus.data.job.error_message,
        }),
      );
    }
  }, [jobStatus.data, language]);

  useEffect(() => {
    if (jobStatus.isError) {
      setErrorMessage(getErrorMessage(jobStatus.error, language));
    }
  }, [jobStatus.error, jobStatus.isError, language]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!shouldShowProcessing ? (
        <div className="shrink-0 pt-2">
          <Button asChild variant="ghost" className={analysisBackNavButtonClassName}>
            <Link href="/app">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {i18n(language, {
                en: "Back to analyses",
                fr: "Retour aux analyses",
              })}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2">
        <section
          className={cn(
            analysisHeroGlassClassName,
            "relative w-full max-w-lg overflow-hidden rounded-[2.5rem] p-6 text-white md:max-w-xl md:p-10",
          )}
        >
        {shouldShowProcessing ? (
          <AnalysisProcessingState
            message={analysisMessage}
            minimalChrome
            theme="dark"
            elapsedAnchorEpochMs={analysisElapsedAnchorEpochMs(
              jobStatus.data?.job.created_at,
            )}
            analysisStepTicker={
              jobStatusValue === "queued" || jobStatusValue === "running"
            }
          />
        ) : (
          <>
            <div
              className={cn(
                "mx-auto w-full max-w-lg px-1 transition-[filter,opacity]",
                heroContentLocked &&
                  "pointer-events-none select-none blur-[7px] opacity-[0.55]",
              )}
            >
              <div className="text-center">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/55">
                  {i18n(language, {
                    en: "New analysis",
                    fr: "Nouvelle analyse",
                  })}
                </p>
                <h1 className="mt-2 text-[1.65rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2rem]">
                  {i18n(language, {
                    en: "Start your new analysis",
                    fr: "Lance ta nouvelle analyse",
                  })}
                </h1>
              </div>

              <div className="mt-8 space-y-3">
                {hasRecentAppScan && recentScan ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                          {i18n(language, { en: "App scan", fr: "Scan app" })}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-snug text-white">
                          {i18n(language, {
                            en: `${recentScan.received_count}/${recentScan.required_count} poses received`,
                            fr: `${recentScan.received_count}/${recentScan.required_count} poses reçues`,
                          })}
                        </p>
                      </div>
                      {recentScanStatus.isFetching && !canLaunchRecentAppScan ? (
                        <Loader2
                          className="mt-1 h-5 w-5 shrink-0 animate-spin text-white/70"
                          aria-hidden
                        />
                      ) : (
                        <ScanFace
                          className="mt-1 h-5 w-5 shrink-0 text-white/70"
                          aria-hidden
                        />
                      )}
                    </div>

                    {!canLaunchRecentAppScan && recentMissingLabels.length > 0 ? (
                      <p className="text-xs leading-relaxed text-white/55">
                        {i18n(language, {
                          en: `Missing: ${recentMissingLabels.join(", ")}`,
                          fr: `Manque : ${recentMissingLabels.join(", ")}`,
                        })}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleLaunchRecentAppScan()}
                      disabled={
                        !canLaunchRecentAppScan ||
                        launchMutation.isPending ||
                        authLoading ||
                        isManualAnalysisLocked ||
                        subscriberQuotaBlockingUi ||
                        isWeeklyAnalysisLocked
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] transition hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-55"
                    >
                      {launchMutation.isPending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <ScanFace className="h-4 w-4 shrink-0" />
                      )}
                      {canLaunchRecentAppScan
                        ? i18n(language, {
                            en: "Launch analysis",
                            fr: "Lancer l'analyse",
                          })
                        : i18n(language, {
                            en: "Waiting for photos",
                            fr: "En attente des photos",
                          })}
                    </button>
                  </div>
                ) : null}

                {!canLaunchRecentAppScan ? (
                  <button
                    type="button"
                    onClick={() => void openCameraCapture()}
                    disabled={
                      authLoading ||
                      createSessionMutation.isPending ||
                      isManualAnalysisLocked ||
                      subscriberQuotaBlockingUi ||
                      isWeeklyAnalysisLocked
                    }
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3.5 text-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] transition hover:bg-[#050505] disabled:pointer-events-none disabled:opacity-55"
                  >
                    {createSessionMutation.isPending ? (
                      <span className="flex w-full items-center justify-center py-1">
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                      </span>
                    ) : (
                      <>
                        <img
                          src="/favicon.png"
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg bg-black object-contain"
                        />
                        <span className="text-sm font-semibold tracking-tight sm:text-base">
                          {hasRecentAppScan
                            ? i18n(language, {
                                en: "Capture from this browser",
                                fr: "Capturer depuis ce navigateur",
                              })
                            : i18n(language, {
                                en: "Launch scan",
                                fr: "Lancer le scan",
                              })}
                        </span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {message ? (
                <p className="mt-6 text-center text-sm text-white/55">{message}</p>
              ) : null}
              {errorMessage ? (
                <p className="mt-6 text-center text-sm font-medium text-red-300">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            {isManualAnalysisLocked ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[2.5rem] bg-[#0b1220]/55 px-6 py-8 text-center backdrop-blur-md sm:px-10"
                role="region"
                aria-label={i18n(language, {
                  en: "Subscription required",
                  fr: "Abonnement requis",
                })}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65)]">
                  <Lock
                    className="h-7 w-7 text-white"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
                <p className="max-w-sm text-sm font-semibold leading-relaxed text-white">
                  {i18n(language, {
                    en: "Your free onboarding analysis is included. Subscribe to run full analyses anytime.",
                    fr: "Ton analyse d’accueil gratuite est incluse. Abonne-toi pour lancer des analyses complètes quand tu veux.",
                  })}
                </p>
                <Button
                  asChild
                  className="mt-1 rounded-full border border-white/30 bg-white/95 px-6 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_-14px_rgba(0,0,0,0.55)] hover:bg-white"
                >
                  <Link href="/billing">
                    {i18n(language, {
                      en: "View plans",
                      fr: "Voir les offres",
                    })}
                  </Link>
                </Button>
              </div>
            ) : null}

            {!isManualAnalysisLocked && isWeeklyAnalysisLocked ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[2.5rem] bg-[#0b1220]/55 px-6 py-8 text-center backdrop-blur-md sm:px-10"
                role="region"
                aria-label={i18n(language, {
                  en: "Weekly analysis limit",
                  fr: "Limite d’analyses hebdomadaire",
                })}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65)]">
                  <CalendarClock
                    className="h-7 w-7 text-white"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
                <p className="max-w-sm text-sm font-semibold leading-relaxed text-white">
                  {weeklyQuotaOverlayLine ??
                    i18n(language, {
                      en: "Subscribers can run one full analysis per week.",
                      fr: "Les abonnés peuvent lancer une analyse complète par semaine.",
                    })}
                </p>
              </div>
            ) : null}

            {!isManualAnalysisLocked &&
            !isWeeklyAnalysisLocked &&
            subscriberQuotaBlockingUi ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-[#0b1220]/45 px-6 py-8 text-center backdrop-blur-md"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2
                  className="h-8 w-8 shrink-0 animate-spin text-white"
                  aria-hidden
                />
                <p className="text-xs font-medium text-white/80">
                  {i18n(language, {
                    en: "Checking your weekly quota…",
                    fr: "Vérification du quota hebdomadaire…",
                  })}
                </p>
              </div>
            ) : null}
          </>
        )}
        </section>
      </div>

      {/* ── Camera capture flow ── */}
      {showCameraCapture &&
      hasPremiumAccess &&
      !subscriberQuotaBlockingUi &&
      !isWeeklyAnalysisLocked ? (
        <FaceCaptureView
          language={language}
          onComplete={handleCapturedComplete}
          onCancel={() => {
            setShowCameraCapture(false);
          }}
        />
      ) : null}

      {/* ── Captured preview: grilles des poses + Lancer le scan ── */}
      <Dialog
        open={
          showCapturedPreview &&
          hasPremiumAccess &&
          !subscriberQuotaBlockingUi &&
          !isWeeklyAnalysisLocked
        }
        onOpenChange={setShowCapturedPreview}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/15 bg-[linear-gradient(135deg,rgba(10,16,22,0.98)_0%,rgba(18,27,35,0.96)_55%,rgba(255,255,255,0.06)_100%)] text-zinc-50 shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] sm:rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-tight text-zinc-50">
              {i18n(language, {
                en: "Pose preview",
                fr: "Aperçu des poses",
              })}
            </DialogTitle>
            <DialogDescription className="space-y-1.5 text-zinc-400">
              <span className="block">
                {i18n(language, {
                  en: "Check quality before launching.",
                  fr: "Vérifie la qualité avant de lancer.",
                })}
              </span>
              <span className="block text-sm opacity-95">
                {i18n(language, {
                  en: `${capturedPoses.length}/${CAPTURE_POSES.length} poses.`,
                  fr: `${capturedPoses.length}/${CAPTURE_POSES.length} poses.`,
                })}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Pose image grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {capturedPoses.map((pose) => {
              const code = poseIdToAssetCode[pose.poseId];
              const label = scanAssetLabels[code] ?? pose.poseId;
              return (
                <div
                  key={pose.poseId}
                  className="space-y-1"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-white/20 bg-black/40">
                    <img
                      src={pose.thumbnailUrl}
                      alt={label}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-center text-xs text-zinc-300">{label}</p>
                </div>
              );
            })}
          </div>

          {errorMessage ? (
            <p className="text-sm font-medium text-red-300">{errorMessage}</p>
          ) : null}

          <div className="flex gap-3 border-t border-white/10 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-full border-white/20 text-zinc-300 hover:text-zinc-50"
              disabled={isRetakingCaptures || isUploadingAll}
              onClick={() => void handleRetakeFromPreview()}
            >
              {isRetakingCaptures ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {i18n(language, { en: "Retake", fr: "Refaire" })}
            </Button>
            <Button
              className="flex-1 rounded-full bg-white text-slate-950 hover:bg-zinc-200"
              disabled={isUploadingAll || capturedPoses.length === 0}
              onClick={() => void handleUploadAllCaptured()}
            >
              {isUploadingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="mr-2 h-4 w-4 shrink-0" />
              )}
              {i18n(language, {
                en: "Launch scan",
                fr: "Lancer le scan",
              })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
