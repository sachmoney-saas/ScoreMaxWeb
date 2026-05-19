import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarClock,
  Loader2,
  Lock,
  ScanFace,
} from "lucide-react";
import { FaceCaptureView } from "@/components/FaceCaptureView";
import { AnalysisProcessingState, analysisElapsedAnchorEpochMs } from "@/components/analysis/AnalysisProcessingState";
import { HeroSkyProgressRing } from "@/components/ui/brand-loader";
import { Button } from "@/components/ui/button";
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
  recordManualAnalysisClientFailure,
  type ScanAssetUploadProgress,
} from "@/lib/face-analysis";
import { reportClientError } from "@/lib/report-client-error";
import { buildAnalysisSupportMessage } from "@/lib/analysis-error-message";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import { CAPTURE_ORDER, type PoseId } from "@/lib/face-capture/types";
import { uploadCapturedOnboardingPose } from "@/lib/onboarding-complete-flow";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  analysisHeroGlassClassName,
} from "@/components/analysis/workers/_shared";
import { queryClient } from "@/lib/queryClient";
import { formatSubscriberStandardQuotaSidebarLine } from "@/lib/subscriber-standard-analysis-copy";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

type ManualAnalysisClientFailurePhase =
  | "create_session"
  | "upload_pose"
  | "upload_all"
  | "launch"
  | "unknown";

type PoseUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

const CAPTURE_UPLOAD_LABELS: Record<PoseId, { en: string; fr: string }> = {
  frontal: { en: "Face", fr: "Face" },
  "profile-right": { en: "Right side", fr: "Côté droit" },
  "profile-left": { en: "Left side", fr: "Côté gauche" },
  "jaw-up": { en: "Look up", fr: "Regard haut" },
  "crown-down": { en: "Look down", fr: "Regard bas" },
  "closeup-smile": { en: "Smile", fr: "Sourire" },
  "closeup-eye": { en: "Eyes", fr: "Yeux" },
};

function createInitialPoseUploadStatuses(): Record<PoseId, PoseUploadStatus> {
  return CAPTURE_ORDER.reduce(
    (acc, poseId) => {
      acc[poseId] = "pending";
      return acc;
    },
    {} as Record<PoseId, PoseUploadStatus>,
  );
}

function createInitialPoseUploadProgressPercents(): Record<PoseId, number> {
  return CAPTURE_ORDER.reduce(
    (acc, poseId) => {
      acc[poseId] = 0;
      return acc;
    },
    {} as Record<PoseId, number>,
  );
}

function clampUploadPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scanAssetUploadProgressPercent(progress: ScanAssetUploadProgress): number {
  if (progress.totalBytes <= 0) return 0;
  return clampUploadPercent((progress.loadedBytes / progress.totalBytes) * 100);
}

function ManualAnalysisUploadProgress({
  language,
  statuses,
  progressByPose,
}: {
  language: AppLanguage;
  statuses: Record<PoseId, PoseUploadStatus>;
  progressByPose: Record<PoseId, number>;
}) {
  const progressPercent = clampUploadPercent(
    CAPTURE_ORDER.reduce((total, poseId) => {
      const status = statuses[poseId];
      const progress = status === "uploaded" ? 100 : progressByPose[poseId] ?? 0;
      return total + progress;
    }, 0) / CAPTURE_ORDER.length,
  );

  return (
    <div
      className="mx-auto flex w-full flex-col items-center px-4 py-6 text-zinc-50 sm:px-6 sm:py-8"
      role="status"
      aria-live="polite"
      aria-label={i18n(language, {
        en: `${progressPercent}% uploaded`,
        fr: `${progressPercent} % envoyés`,
      })}
    >
      <HeroSkyProgressRing className="size-20 drop-shadow-[0_8px_28px_rgba(0,0,0,0.38)]">
        {progressPercent}%
      </HeroSkyProgressRing>

      <ol className="mt-7 w-full max-w-sm space-y-3.5" aria-label={i18n(language, {
        en: "Photo uploads",
        fr: "Envoi des photos",
      })}>
        {CAPTURE_ORDER.map((poseId, index) => {
          const status = statuses[poseId];
          const progress =
            status === "uploaded" ? 100 : progressByPose[poseId] ?? 0;
          const isActive = status === "uploading";
          const isUploaded = status === "uploaded";
          const isFailed = status === "failed";

          return (
            <li
              key={poseId}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={cn(
                      "shrink-0 text-[0.65rem] font-extrabold tabular-nums tracking-[0.14em]",
                      isUploaded && "text-[#d6e4ff]",
                      isActive && "text-[#d6e4ff]",
                      isFailed && "text-red-100",
                      !isUploaded && !isActive && !isFailed && "text-zinc-500",
                    )}
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "truncate text-left text-xs font-semibold tracking-tight sm:text-sm",
                      isUploaded && "text-zinc-200",
                      isActive && "text-[#d6e4ff]",
                      isFailed && "text-red-100",
                      !isUploaded && !isActive && !isFailed && "text-zinc-500",
                    )}
                  >
                    {i18n(language, CAPTURE_UPLOAD_LABELS[poseId])}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[0.65rem] font-bold tabular-nums",
                    isUploaded && "text-[#d6e4ff]",
                    isActive && "text-[#d6e4ff]",
                    isFailed && "text-red-100",
                    !isUploaded && !isActive && !isFailed && "text-zinc-500",
                  )}
                  aria-hidden
                >
                  {progress}%
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.35)]"
                role="progressbar"
                aria-label={i18n(language, CAPTURE_UPLOAD_LABELS[poseId])}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
                    isUploaded && "bg-[#d6e4ff]",
                    isActive && "bg-[#d6e4ff]",
                    isFailed && "bg-red-300",
                    !isUploaded && !isActive && !isFailed && "bg-white/15",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

function getRawErrorDetail(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack ?? error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return undefined;
  }
}

function getRawErrorCode(error: unknown): string | undefined {
  if (error instanceof DOMException) return error.name;
  if (error instanceof Error && error.name && error.name !== "Error") {
    return error.name;
  }
  return undefined;
}

function getErrorMessage(error: unknown, language: AppLanguage): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("manual analysis session is incomplete") ||
    lower.includes("missing required scan assets")
  ) {
    return i18n(language, {
      en: "Some photos did not finish uploading. Start a new scan and keep this page open until the analysis starts.",
      fr: "Certaines photos n’ont pas fini d’être envoyées. Relance un scan et garde la page ouverte jusqu’au démarrage de l’analyse.",
    });
  }
  if (
    lower.includes("load failed") ||
    lower.includes("video load error") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("fetch failed")
  ) {
    return i18n(language, {
      en: "The photo upload or analysis launch failed. Check your network and try again.",
      fr: "L’envoi des photos ou le lancement de l’analyse a échoué. Vérifie ton réseau et réessaie.",
    });
  }
  if (lower.includes("abort") || lower.includes("timeout")) {
    return i18n(language, {
      en: "The request took too long. Check your connection and try again.",
      fr: "La requête a pris trop de temps. Vérifie ta connexion et réessaie.",
    });
  }
  if (error instanceof Error) return error.message;
  return i18n(language, {
    en: "An error occurred.",
    fr: "Une erreur est survenue.",
  });
}

const CAPTURE_POSE_UPLOAD_MAX_ATTEMPTS = 2;
const CAPTURE_POSE_UPLOAD_RETRY_DELAY_MS = 1_200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableCaptureUploadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("délai") ||
    lower.includes("upload") ||
    lower.includes("storage") ||
    lower.includes("stockage")
  );
}

async function uploadCapturedPoseWithRetry(params: {
  userId: string;
  sessionId: string;
  pose: CapturedPose;
  language: AppLanguage;
  onUploadProgress?: (progress: ScanAssetUploadProgress) => void;
}): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CAPTURE_POSE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      await uploadCapturedOnboardingPose(params);
      return;
    } catch (error) {
      lastError = error;
      if (
        attempt >= CAPTURE_POSE_UPLOAD_MAX_ATTEMPTS ||
        !isRetryableCaptureUploadError(error)
      ) {
        throw error;
      }
      await sleep(CAPTURE_POSE_UPLOAD_RETRY_DELAY_MS);
    }
  }

  throw lastError;
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
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [isLaunchingAfterUploads, setIsLaunchingAfterUploads] = useState(false);
  const [uploadedPoseCount, setUploadedPoseCount] = useState(0);
  const [poseUploadStatuses, setPoseUploadStatuses] = useState<
    Record<PoseId, PoseUploadStatus>
  >(() => createInitialPoseUploadStatuses());
  const [poseUploadProgressPercents, setPoseUploadProgressPercents] = useState<
    Record<PoseId, number>
  >(() => createInitialPoseUploadProgressPercents());
  const uploadPromisesRef = React.useRef<Map<PoseId, Promise<void>>>(new Map());
  const completedUploadPoseIdsRef = React.useRef<Set<PoseId>>(new Set());
  const autoLaunchStartedRef = React.useRef(false);
  const captureRunIdRef = React.useRef(0);

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
  const shouldShowUploadProgress =
    isUploadingAll &&
    !launchMutation.isPending &&
    !isLaunchingAfterUploads &&
    !jobId &&
    !isAnalyzing &&
    jobStatusValue !== "completed";

  const shouldShowProcessing =
    !hasJobStatusError &&
    jobStatusValue !== "failed" &&
    (isAnalyzing ||
      isLaunchingAfterUploads ||
      launchMutation.isPending ||
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
              ? uploadedPoseCount > 0 && capturedPoses.length > 0
                ? i18n(language, {
                    en: `Initializing analysis... ${uploadedPoseCount}/${capturedPoses.length} photos uploaded`,
                    fr: `Initialisation de l’analyse... ${uploadedPoseCount}/${capturedPoses.length} photos envoyées`,
                  })
                : i18n(language, {
                    en: "Initializing analysis...",
                    fr: "Initialisation de l’analyse...",
                  })
              : message;

  /**
   * Creates a fresh manual scan session for every browser capture attempt.
   * This keeps cancelled / partial uploads isolated from the next scan.
   */
  const createManualSession = React.useCallback(async () => {
    const data = await createSessionMutation.mutateAsync();
    setSessionId(data.session.id);
    return data.session.id;
  }, [createSessionMutation]);

  const resetLocalCapturePipeline = React.useCallback(() => {
    captureRunIdRef.current += 1;
    uploadPromisesRef.current.clear();
    completedUploadPoseIdsRef.current.clear();
    autoLaunchStartedRef.current = false;
    setSessionId(null);
    setUploadedPoseCount(0);
    setPoseUploadStatuses(createInitialPoseUploadStatuses());
    setPoseUploadProgressPercents(createInitialPoseUploadProgressPercents());
    setCapturedPoses([]);
    setJobId(null);
    setIsUploadingAll(false);
    setIsLaunchingAfterUploads(false);
    setMessage(null);
    setErrorMessage(null);
  }, []);

  const recordCaptureFailureForAdmin = useCallback(
    async (params: {
      phase: ManualAnalysisClientFailurePhase;
      error: unknown;
      currentSessionId?: string | null;
      capturedPoseCount?: number;
      uploadedPoseCount?: number;
    }) => {
      const rawMessage = getRawErrorMessage(params.error);
      const rawDetail = getRawErrorDetail(params.error);
      const rawCode = getRawErrorCode(params.error);
      const currentSessionId = params.currentSessionId ?? sessionId;

      reportClientError({
        source: `manual_analysis.${params.phase}.failed`,
        message: rawMessage,
        errorCode: rawCode,
        errorDetail: rawDetail,
        payload: {
          sessionId: currentSessionId,
          capturedPoseCount: params.capturedPoseCount,
          uploadedPoseCount: params.uploadedPoseCount,
        },
      });

      if (!currentSessionId) return;

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;

        await recordManualAnalysisClientFailure({
          accessToken,
          sessionId: currentSessionId,
          phase: params.phase,
          message: rawMessage,
          ...(rawCode ? { errorCode: rawCode } : {}),
          ...(rawDetail ? { errorDetail: rawDetail } : {}),
          capturedPoseCount: params.capturedPoseCount,
          uploadedPoseCount: params.uploadedPoseCount,
        });
      } catch (loggingError) {
        reportClientError({
          source: "manual_analysis.client_failure_log.failed",
          message: getRawErrorMessage(loggingError),
          errorCode: getRawErrorCode(loggingError),
          errorDetail: getRawErrorDetail(loggingError),
          payload: {
            sessionId: currentSessionId,
            originalPhase: params.phase,
            originalMessage: rawMessage,
          },
        });
      }
    },
    [sessionId],
  );

  const startPoseUpload = useCallback(
    (pose: CapturedPose): Promise<void> => {
      const existingUpload = uploadPromisesRef.current.get(pose.poseId);
      if (existingUpload) return existingUpload;

      const currentUserId = user?.id;
      const currentSessionId = sessionId;
      if (!currentUserId || !currentSessionId || !hasPremiumAccess) {
        return Promise.reject(
          new Error(
            i18n(language, {
              en: "Unable to upload this photo. Start a new scan and try again.",
              fr: "Impossible d’envoyer cette photo. Relance un scan et réessaie.",
            }),
          ),
        );
      }

      const uploadRunId = captureRunIdRef.current;
      setPoseUploadStatuses((previous) => ({
        ...previous,
        [pose.poseId]: "uploading",
      }));
      setPoseUploadProgressPercents((previous) => ({
        ...previous,
        [pose.poseId]: 0,
      }));
      const uploadPromise = uploadCapturedPoseWithRetry({
        userId: currentUserId,
        sessionId: currentSessionId,
        pose,
        language,
        onUploadProgress: (progress) => {
          if (captureRunIdRef.current !== uploadRunId) return;
          setPoseUploadProgressPercents((previous) => ({
            ...previous,
            [pose.poseId]: scanAssetUploadProgressPercent(progress),
          }));
        },
      })
        .then(() => {
          if (captureRunIdRef.current !== uploadRunId) return;
          completedUploadPoseIdsRef.current.add(pose.poseId);
          setUploadedPoseCount(completedUploadPoseIdsRef.current.size);
          setPoseUploadProgressPercents((previous) => ({
            ...previous,
            [pose.poseId]: 100,
          }));
          setPoseUploadStatuses((previous) => ({
            ...previous,
            [pose.poseId]: "uploaded",
          }));
        })
        .catch((error) => {
          if (captureRunIdRef.current !== uploadRunId) {
            throw error;
          }
          uploadPromisesRef.current.delete(pose.poseId);
          completedUploadPoseIdsRef.current.delete(pose.poseId);
          setUploadedPoseCount(completedUploadPoseIdsRef.current.size);
          setPoseUploadStatuses((previous) => ({
            ...previous,
            [pose.poseId]: "failed",
          }));
          throw error;
        });

      uploadPromisesRef.current.set(pose.poseId, uploadPromise);
      return uploadPromise;
    },
    [hasPremiumAccess, language, sessionId, user?.id],
  );

  const handlePoseCaptured = useCallback(
    (pose: CapturedPose) => {
      const poseRunId = captureRunIdRef.current;
      setCapturedPoses((previousPoses) => {
        const posesWithoutCurrent = previousPoses.filter(
          (previousPose) => previousPose.poseId !== pose.poseId,
        );
        return [...posesWithoutCurrent, pose];
      });

      void startPoseUpload(pose).catch((error) => {
        if (captureRunIdRef.current !== poseRunId) return;
        setErrorMessage(getErrorMessage(error, language));
      });
    },
    [language, startPoseUpload],
  );

  const handleCapturedComplete = useCallback(
    async (poses: CapturedPose[]) => {
      if (autoLaunchStartedRef.current) return;
      autoLaunchStartedRef.current = true;
      const completionRunId = captureRunIdRef.current;

      setCapturedPoses(poses);
      setShowCameraCapture(false);
      setErrorMessage(null);

      if (
        !user?.id ||
        !sessionId ||
        !hasPremiumAccess ||
        isWeeklyAnalysisLocked ||
        subscriberQuotaBlockingUi
      ) {
        autoLaunchStartedRef.current = false;
        return;
      }

      setIsUploadingAll(true);
      setMessage(
        i18n(language, {
          en: "Initializing analysis...",
          fr: "Initialisation de l’analyse...",
        }),
      );

      let failurePhase: ManualAnalysisClientFailurePhase = "upload_all";
      try {
        await Promise.all(poses.map((pose) => startPoseUpload(pose)));
        if (captureRunIdRef.current !== completionRunId) return;

        await queryClient.invalidateQueries({
          queryKey: ["manual-analysis-session-status", user.id, sessionId],
        });
        if (captureRunIdRef.current !== completionRunId) return;

        setIsLaunchingAfterUploads(true);
        setIsUploadingAll(false);
        failurePhase = "launch";
        const data = await launchMutation.mutateAsync(sessionId);
        if (captureRunIdRef.current !== completionRunId) return;
        setJobId(data.job.id);
        setIsLaunchingAfterUploads(false);
        setMessage(
          i18n(language, {
            en: "Analysis queued...",
            fr: "Analyse en file d'attente...",
          }),
        );
      } catch (error) {
        if (captureRunIdRef.current !== completionRunId) return;
        autoLaunchStartedRef.current = false;
        setJobId(null);
        setMessage(null);
        setIsLaunchingAfterUploads(false);
        setErrorMessage(getErrorMessage(error, language));
        void recordCaptureFailureForAdmin({
          phase: failurePhase,
          error,
          currentSessionId: sessionId,
          capturedPoseCount: poses.length,
          uploadedPoseCount: completedUploadPoseIdsRef.current.size,
        });
      } finally {
        if (captureRunIdRef.current === completionRunId) {
          setIsUploadingAll(false);
        }
      }
    },
    [
      hasPremiumAccess,
      isWeeklyAnalysisLocked,
      language,
      launchMutation,
      recordCaptureFailureForAdmin,
      sessionId,
      startPoseUpload,
      subscriberQuotaBlockingUi,
      user?.id,
    ],
  );

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
    } catch (error) {
      setErrorMessage(getErrorMessage(error, language));
      void recordCaptureFailureForAdmin({
        phase: "launch",
        error,
        currentSessionId: appSessionId,
        uploadedPoseCount: recentScan.received_count,
      });
    }
  }

  /** Opens the live camera capture flow. */
  function openCameraCapture() {
    setErrorMessage(null);
    if (authLoading || !hasPremiumAccess) return;
    if (subscriberQuotaBlockingUi || isWeeklyAnalysisLocked) return;
    resetLocalCapturePipeline();
    setIsUploadingAll(false);
    void createManualSession()
      .then(() => setShowCameraCapture(true))
      .catch((error) => {
        setErrorMessage(getErrorMessage(error, language));
        void recordCaptureFailureForAdmin({
          phase: "create_session",
          error,
          currentSessionId: null,
        });
      });
  }

  useEffect(() => {
    if (!heroContentLocked) return;
    setShowCameraCapture(false);
    setIsUploadingAll(false);
    setIsLaunchingAfterUploads(false);
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
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2">
        <section
          className={cn(
            analysisHeroGlassClassName,
            "relative w-full max-w-lg overflow-hidden rounded-[2.5rem] p-6 text-white md:max-w-xl md:p-10",
          )}
        >
        {shouldShowUploadProgress ? (
          <ManualAnalysisUploadProgress
            language={language}
            statuses={poseUploadStatuses}
            progressByPose={poseUploadProgressPercents}
          />
        ) : shouldShowProcessing ? (
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
          onPoseCaptured={handlePoseCaptured}
          onCancel={() => {
            resetLocalCapturePipeline();
            setShowCameraCapture(false);
          }}
        />
      ) : null}
    </div>
  );
}
