import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Upload,
} from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { FaceCaptureView } from "@/components/FaceCaptureView";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
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
} from "@/hooks/use-supabase";
import {
  getScanAssetLabels,
  uploadScanAsset,
} from "@/lib/face-analysis";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { PoseId } from "@/lib/face-capture/types";
import { analysisBackNavButtonClassName } from "@/components/analysis/workers/_shared";
import { queryClient } from "@/lib/queryClient";
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
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [capturedPoses, setCapturedPoses] = useState<CapturedPose[]>([]);
  const [showCapturedPreview, setShowCapturedPreview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadingAll, setIsUploadingAll] = useState(false);

  const createSessionMutation = useCreateManualAnalysisSession();
  const launchMutation = useLaunchManualAnalysis();
  const jobStatus = useAnalysisJobStatus(jobId);
  const jobStatusValue = jobStatus.data?.job.status;
  const isAnalyzing =
    jobStatusValue === "queued" || jobStatusValue === "running";

  /**
   * Single source of truth for "show the processing card vs the launch CTA".
   * Includes `Boolean(jobId)` so the UI stays on the processing card across the
   * brief gaps between (a) launch mutation resolving and (b) the first
   * `jobStatus` fetch reporting "queued" — otherwise the launch CTA flashes
   * back for one render. Failed jobs are excluded so the inline error surfaces.
   */
  const shouldShowProcessing =
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
                  en: "Uploading captures...",
                  fr: "Envoi des captures...",
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
    "closeup-hairline": "HAIR_BACK",
  };

  const handleCapturedComplete = useCallback(
    async (poses: CapturedPose[]) => {
      setCapturedPoses(poses);
      setShowCameraCapture(false);
      setShowCapturedPreview(true);
    },
    [],
  );

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
    if (!user?.id || !sessionId) return;
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
      }

      await queryClient.invalidateQueries({
        queryKey: ["manual-analysis-session-status", user.id, sessionId],
      });

      setMessage(
        i18n(language, {
          en: `${codes.length} captures uploaded.`,
          fr: `${codes.length} captures uploadées.`,
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

  /** Opens the live camera capture flow. */
  function openCameraCapture() {
    setErrorMessage(null);
    void ensureManualSession().then(() => setShowCameraCapture(true));
  }

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
        jobStatus.data.job.error_message ??
          i18n(language, {
            en: "The analysis failed.",
            fr: "L'analyse a échoué.",
          }),
      );
    }
  }, [jobStatus.data, language]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
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

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10 pt-4 min-h-0">
        <section className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-white/20 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.26),transparent_30%),linear-gradient(145deg,rgba(9,15,22,0.94)_0%,rgba(24,34,43,0.9)_48%,rgba(155,181,190,0.24)_100%)] p-6 text-white shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] backdrop-blur-sm md:max-w-xl md:p-10">
        {shouldShowProcessing ? (
          <AnalysisProcessingState
            message={analysisMessage}
            minimalChrome
            awaitingRedirect={jobStatusValue === "completed"}
          />
        ) : (
          <div className="mx-auto w-full max-w-lg px-1">
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

            <div className="mt-8">
              <button
                type="button"
                onClick={() => void openCameraCapture()}
                disabled={createSessionMutation.isPending}
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
                      {i18n(language, {
                        en: "Launch analysis",
                        fr: "Lancer l'analyse",
                      })}
                    </span>
                  </>
                )}
              </button>
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
        )}
        </section>
      </div>

      {/* ── Camera capture flow ── */}
      {showCameraCapture && (
        <FaceCaptureView
          language={language}
          onComplete={handleCapturedComplete}
          onCancel={() => setShowCameraCapture(false)}
        />
      )}

      {/* ── Captured preview: show 8 images + upload button ── */}
      <Dialog open={showCapturedPreview} onOpenChange={setShowCapturedPreview}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/15 bg-[linear-gradient(135deg,rgba(10,16,22,0.98)_0%,rgba(18,27,35,0.96)_55%,rgba(255,255,255,0.06)_100%)] text-zinc-50 shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] sm:rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-tight text-zinc-50">
              {i18n(language, {
                en: "Captures review",
                fr: "Aperçu des captures",
              })}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {i18n(language, {
                en: `${capturedPoses.length}/8 captures — check the quality before uploading.`,
                fr: `${capturedPoses.length}/8 captures — vérifie la qualité avant d'uploader.`,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* 8 image grid */}
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
              onClick={() => {
                setShowCapturedPreview(false);
                setShowCameraCapture(true);
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
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
                <Upload className="mr-2 h-4 w-4" />
              )}
              {i18n(language, {
                en: "Upload captures",
                fr: "Uploader les captures",
              })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
