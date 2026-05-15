import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Loader2,
  LogOut,
  ScanFace,
  Trash2,
  MoreVertical,
} from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FaceCaptureView } from "@/components/FaceCaptureView";
import { WaveBackground } from "@/components/background/WaveBackground";
import { PotentialPreviewCard } from "@/components/onboarding/PotentialPreviewCard";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import { useOnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import {
  getScanAssetLabels,
  resetScanSessionAssets,
  uploadScanAsset,
} from "@/lib/face-analysis";
import { guideTraceBlobUploadsFromCapturedPose } from "@/lib/guide-trace-scan-uploads";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { PoseId } from "@/lib/face-capture/types";
import { deleteMyAccount } from "@/lib/account-api";
import { supabase } from "@/lib/supabase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AUTH_CONFIG } from "@/config/auth";
import {
  authPageOverlayClassName,
  saasGlassDropdownMenuContentClassName,
  saasGlassInsetClassName,
  saasGlassPanelClassName,
} from "@/lib/auth-page-shell-styles";
import { onboardingPrimaryCtaClassName } from "@/lib/cta-button-styles";
import { i18n, useAppLanguage } from "@/lib/i18n";
import {
  clearOnboardingFlowState,
  readOnboardingFlowState,
  writeOnboardingFlowState,
} from "@/lib/onboarding-flow-storage";

const ONBOARDING_POSE_TO_ASSET: Record<PoseId, OnboardingScanAssetCode> = {
  frontal: "FACE_FRONT",
  "profile-right": "PROFILE_RIGHT",
  "profile-left": "PROFILE_LEFT",
  "jaw-up": "LOOK_UP",
  "crown-down": "LOOK_DOWN",
  "closeup-eye": "EYE_CLOSEUP",
  "closeup-smile": "SMILE",
  "closeup-hairline": "HAIR_BACK",
};

const ONBOARDING_TOTAL_STEPS = 2;

const ONBOARDING_SCAN_UPLOAD_STEPS = [
  {
    en: "Uploading your photos…",
    fr: "Envoi de tes photos…",
  },
  {
    en: "Securing your data…",
    fr: "Sécurisation de tes données…",
  },
  {
    en: "Building your face map…",
    fr: "Cartographie de ton visage…",
  },
] as const;

const ONBOARDING_SCAN_SESSION_STEPS = [
  {
    en: "Loading your session…",
    fr: "Chargement de ta session…",
  },
  {
    en: "Syncing your progress…",
    fr: "Synchronisation de ta progression…",
  },
  {
    en: "Almost ready…",
    fr: "Presque prêt…",
  },
] as const;

type OnboardingProps = {
  initialStep?: number;
};

export default function Onboarding({ initialStep }: OnboardingProps = {}) {
  const language = useAppLanguage();
  const scanAssetLabels = getScanAssetLabels(language);
  const [, setLocation] = useLocation();
  const { user, hasPremiumAccess, isAdmin } = useAuth();
  const { status: gateStatus } = useOnboardingGate();
  const [stepIndex, setStepIndex] = React.useState(() => {
    if (initialStep !== undefined) {
      return Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS - 1, initialStep));
    }
    const persisted = readOnboardingFlowState();
    return persisted?.step && persisted.step >= 1 ? 1 : 0;
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [showCameraCapture, setShowCameraCapture] = React.useState(false);
  const [capturedPoses, setCapturedPoses] = React.useState<CapturedPose[]>([]);
  const [showCapturedPreview, setShowCapturedPreview] = React.useState(false);
  const [isUploadingCaptures, setIsUploadingCaptures] = React.useState(false);
  const [isRetakingCaptures, setIsRetakingCaptures] = React.useState(false);
  const [capturePreviewError, setCapturePreviewError] = React.useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  /**
   * Vrai dès qu'on a démarré l'upload + déclenché l'étape teaser ; bloque
   * la redirection automatique du gate (le serveur a déjà flippé
   * `has_completed_onboarding=true`).
   */
  const [hasStartedRun, setHasStartedRun] = React.useState(
    () => stepIndex >= 1,
  );

  const isPotentialStep = stepIndex === 1;

  React.useEffect(() => {
    /** Préchargement léger : favicon utilisé sur l'écran d'analyse. */
    const img = new Image();
    img.decoding = "async";
    img.src = "/model1.png";
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }

    if (gateStatus === "ok" && (hasPremiumAccess || isAdmin)) {
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
      return;
    }

    if (hasStartedRun) {
      return;
    }

    if (gateStatus === "ok" && !hasPremiumAccess && !isAdmin) {
      setLocation("/billing");
    }
  }, [
    gateStatus,
    hasPremiumAccess,
    hasStartedRun,
    isAdmin,
    setLocation,
    user,
  ]);

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({ enabled: !isPotentialStep && !!user?.id });

  const isOnboardingStep0Blocking =
    !isPotentialStep && (isScanStatusLoading || isUploadingCaptures);

  const onboardingSessionId = scanStatus?.session_id;

  const {
    data: potentialImage,
    isLoading: isPotentialImageLoading,
  } = useOnboardingPotentialImage({
    enabled: isPotentialStep && !!user?.id,
  });

  const handleCapturedComplete = React.useCallback((poses: CapturedPose[]) => {
    setCapturePreviewError(null);
    setCapturedPoses(poses);
    setShowCameraCapture(false);
    setShowCapturedPreview(true);
  }, []);

  const handleRetakeCapturesFromPreview = React.useCallback(async () => {
    setCapturePreviewError(null);
    if (!user?.id || !onboardingSessionId) {
      setCapturedPoses([]);
      setShowCapturedPreview(false);
      setShowCameraCapture(true);
      return;
    }

    setIsRetakingCaptures(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(
          i18n(language, {
            en: "Supabase session not found",
            fr: "Session Supabase introuvable",
          }),
        );
      }

      await resetScanSessionAssets({
        accessToken,
        sessionId: onboardingSessionId,
      });

      await queryClient.invalidateQueries({
        queryKey: ["onboarding-scan-status", user.id],
      });

      setCapturedPoses([]);
      setShowCapturedPreview(false);
      setShowCameraCapture(true);
    } catch (error) {
      console.error("Unable to reset scan session assets:", error);
      setCapturePreviewError(
        error instanceof Error
          ? error.message
          : i18n(language, {
              en: "Unable to discard previous uploads. Try again.",
              fr: "Impossible d'effacer les envois précédents. Réessaye.",
            }),
      );
    } finally {
      setIsRetakingCaptures(false);
    }
  }, [language, onboardingSessionId, user?.id]);

  const uploadAndCompleteOnboarding = React.useCallback(async () => {
    if (!user?.id || !onboardingSessionId || capturedPoses.length === 0) {
      return;
    }

    setIsUploadingCaptures(true);
    setUploadError(null);
    setShowCapturedPreview(false);

    try {
      for (const pose of capturedPoses) {
        const code = ONBOARDING_POSE_TO_ASSET[pose.poseId];
        if (!code) continue;
        await uploadScanAsset({
          userId: user.id,
          sessionId: onboardingSessionId,
          assetTypeCode: code,
          file: new File([pose.blob], `${pose.poseId}.jpg`, {
            type: "image/jpeg",
          }),
          lang: language,
        });

        for (const trace of guideTraceBlobUploadsFromCapturedPose(pose)) {
          await uploadScanAsset({
            userId: user.id,
            sessionId: onboardingSessionId,
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
        queryKey: ["onboarding-scan-status", user.id],
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error(
          i18n(language, {
            en: "Supabase session not found",
            fr: "Session Supabase introuvable",
          }),
        );
      }

      const headers = { Authorization: `Bearer ${accessToken}` };
      const completeResponse = await apiRequest(
        "POST",
        "/v1/onboarding/complete",
        { lang: language },
        headers,
      );
      const completePayload = (await completeResponse.json()) as {
        data?: { generation?: { id?: string } };
      };

      if (!completePayload.data?.generation?.id) {
        throw new Error(
          i18n(language, {
            en: "Unable to start preview generation",
            fr: "Impossible de lancer la génération",
          }),
        );
      }

      writeOnboardingFlowState({ step: 1 });
      setHasStartedRun(true);
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-potential-image", user.id],
      });
      setStepIndex(1);
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      setUploadError(
        error instanceof Error
          ? error.message
          : i18n(language, {
              en: "Unable to start the preview. Try again.",
              fr: "Impossible de lancer l'aperçu. Réessaye.",
            }),
      );
    } finally {
      setIsUploadingCaptures(false);
    }
  }, [capturedPoses, language, onboardingSessionId, user?.id]);

  const openOnboardingCapture = React.useCallback(() => {
    if (!onboardingSessionId || isScanStatusLoading) return;
    setShowCameraCapture(true);
  }, [isScanStatusLoading, onboardingSessionId]);

  const handleUnlock = React.useCallback(() => {
    if (!user?.id) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }
    setIsUnlocking(true);
    try {
      /**
       * Paywall : pas d’accès à l’app sans abonnement. `has_completed_onboarding`
       * est déjà true côté serveur depuis POST /onboarding/complete — pas de
       * contournement via le cache client.
       */
      clearOnboardingFlowState();
      setLocation("/billing");
    } finally {
      setIsUnlocking(false);
    }
  }, [setLocation, user?.id]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleDeleteAccount = React.useCallback(async () => {
    if (!user?.id) return;

    setIsDeletingAccount(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("No session");
      }

      await deleteMyAccount(accessToken);

      await supabase.auth.signOut();
      queryClient.clear();
      setLocation(AUTH_CONFIG.LOGIN_PATH);
    } catch (error) {
      console.error("Error while deleting account:", error);
      const serverMessage = error instanceof Error ? error.message : "";
      const isSubscriptionBlock =
        serverMessage.includes("subscription") ||
        serverMessage.includes("abonnement");
      alert(
        isSubscriptionBlock
          ? i18n(language, {
              en: "Cancel your active subscription before deleting your account.",
              fr: "Résilie ton abonnement actif avant de supprimer ton compte.",
            })
          : serverMessage && !serverMessage.includes("No session")
            ? serverMessage
            : i18n(language, {
                en: "Unable to delete account right now. Try again later.",
                fr: "Impossible de supprimer le compte pour le moment. Réessaye plus tard.",
              }),
      );
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteDialogOpen(false);
    }
  }, [language, setLocation, user?.id]);

  return (
    <div className="relative isolate flex h-dvh max-h-[100dvh] flex-col overflow-x-hidden overflow-hidden bg-[#9aaeb5]">
      <WaveBackground
        useContainerSize
        className="pointer-events-none z-0 bg-[#9aaeb5]"
        canvasClassName="bg-transparent"
      />
      <div className={authPageOverlayClassName} aria-hidden />

      {/* Account Menu */}
      <div className="absolute right-[max(1rem,env(safe-area-inset-right,0px))] top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.5rem))] z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/20 hover:bg-white/30"
            >
              <MoreVertical className="h-5 w-5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn("w-48", saasGlassDropdownMenuContentClassName)}
          >
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer rounded-lg text-zinc-100 focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
            >
              <LogOut className="mr-2 h-4 w-4 text-zinc-400" />
              <span>{i18n(language, { en: "Log out", fr: "Se déconnecter" })}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="cursor-pointer rounded-lg text-red-400 focus:bg-red-500/15 focus:text-red-300 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{i18n(language, { en: "Delete account", fr: "Supprimer le compte" })}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n(language, { en: "Delete account", fr: "Supprimer le compte" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n(language, {
                en: "This action is permanent. Your account and all your data will be deleted immediately. This cannot be undone.",
                fr: "Cette action est définitive. Ton compte et toutes tes données seront supprimés immédiatement. Tu ne pourras pas revenir en arrière.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>{i18n(language, { en: "Cancel", fr: "Annuler" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount
                ? i18n(language, { en: "Deleting...", fr: "Suppression..." })
                : i18n(language, { en: "Delete", fr: "Supprimer" })}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.35rem))] sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-3">
          <div className="w-full shrink-0 space-y-2 sm:space-y-2.5">
            <div className="flex justify-center">
              <img
                src="/favicon.png"
                alt="Logo ScoreMax"
                className="h-9 w-9 rounded-xl border border-white/25 bg-white/10 p-1.5 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)] sm:h-10 sm:w-10"
              />
            </div>

            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${ONBOARDING_TOTAL_STEPS}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: ONBOARDING_TOTAL_STEPS }).map((_, index) => (
                <div
                  key={`step-segment-${index}`}
                  className={cn(
                    "h-2 rounded-full transition-colors duration-200",
                    index <= stepIndex ? "bg-white" : "bg-white/25",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              <motion.article
                key={`onboarding-step-${stepIndex}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn(
                  saasGlassPanelClassName,
                  "text-white shadow-[0_24px_70px_-35px_rgba(0,0,0,0.65)]",
                  "flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6",
                  "mx-auto w-full max-w-[460px]",
                )}
              >
                {isPotentialStep ? (
                  <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-1 py-2 pb-[max(6.75rem,calc(env(safe-area-inset-bottom,0px)+5.75rem))] sm:px-2 sm:py-4 sm:pb-28">
                    <PotentialPreviewCard
                      language={language}
                      potentialImage={potentialImage ?? null}
                      isLoading={isPotentialImageLoading}
                    />
                  </div>
                ) : isOnboardingStep0Blocking ? (
                  <div className="flex min-h-0 flex-1 flex-col justify-center px-1 py-4 sm:px-2 sm:py-6">
                    <div className="mx-auto w-full max-w-sm">
                      <OnboardingMultistepGlassLoader
                        language={language}
                        steps={
                          isUploadingCaptures
                            ? ONBOARDING_SCAN_UPLOAD_STEPS
                            : ONBOARDING_SCAN_SESSION_STEPS
                        }
                        cycleResetKey={
                          isUploadingCaptures ? "upload" : "session"
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col justify-center px-1 py-4 sm:px-2 sm:py-6">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center sm:gap-6">
                      {uploadError ? (
                        <div
                          className={cn(
                            saasGlassInsetClassName,
                            "w-full p-3 text-left sm:p-4",
                          )}
                        >
                          <p className="text-sm text-red-200">{uploadError}</p>
                        </div>
                      ) : null}
                      <p className="font-hero text-[1.35rem] font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-[1.75rem]">
                        {i18n(language, {
                          en: "Start your first analysis",
                          fr: "Lance ta première analyse",
                        })}
                      </p>
                      <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                        {i18n(language, {
                          en: "Capture 8 quick poses so our AI can map your face. It takes less than a minute.",
                          fr: "Capture 8 poses rapides pour qu'on cartographie ton visage. Moins d'une minute.",
                        })}
                      </p>
                      {isScanStatusError ? (
                        <p className="text-sm text-red-300">
                          {i18n(language, {
                            en: "Unable to load your scan session. Refresh the page and try again.",
                            fr: "Impossible de charger ta session. Actualise la page et réessaye.",
                          })}
                        </p>
                      ) : null}
                      <div className="w-full max-w-[360px]">
                        <button
                          type="button"
                          onClick={() => void openOnboardingCapture()}
                          disabled={
                            !onboardingSessionId || isScanStatusError
                          }
                          className={cn(
                            "flex w-full items-center justify-center gap-3 px-4 py-3 text-base transition disabled:pointer-events-none disabled:opacity-55 sm:py-3.5",
                            onboardingPrimaryCtaClassName,
                          )}
                        >
                          <img
                            src="/favicon.png"
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg bg-black object-contain sm:h-10 sm:w-10"
                          />
                          <span className="text-sm font-semibold tracking-tight sm:text-base">
                            {i18n(language, {
                              en: "Launch analysis",
                              fr: "Lancer l'analyse",
                            })}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showCameraCapture ? (
        <FaceCaptureView
          language={language}
          onComplete={handleCapturedComplete}
          onCancel={() => setShowCameraCapture(false)}
        />
      ) : null}

      <Dialog open={showCapturedPreview} onOpenChange={setShowCapturedPreview}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/15 bg-[linear-gradient(135deg,rgba(10,16,22,0.98)_0%,rgba(18,27,35,0.96)_55%,rgba(255,255,255,0.06)_100%)] text-zinc-50 shadow-[0_35px_110px_-70px_rgba(0,0,0,0.95)] sm:rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-hero text-2xl font-semibold leading-[1.06] tracking-[-0.015em] text-zinc-50 sm:text-3xl">
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
                  en: `${capturedPoses.length}/8 poses.`,
                  fr: `${capturedPoses.length}/8 poses.`,
                })}
              </span>
            </DialogDescription>
          </DialogHeader>

          {capturePreviewError ? (
            <p className="text-sm font-medium text-red-300">{capturePreviewError}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {capturedPoses.map((pose) => {
              const code = ONBOARDING_POSE_TO_ASSET[pose.poseId];
              const label = code ? scanAssetLabels[code] ?? pose.poseId : pose.poseId;
              return (
                <div key={pose.poseId} className="space-y-1">
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

          <div className="flex gap-3 border-t border-white/10 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-sm border-white/25 bg-black/20 text-sm font-semibold text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/10 hover:text-zinc-50"
              disabled={isRetakingCaptures || isUploadingCaptures}
              onClick={() => void handleRetakeCapturesFromPreview()}
            >
              {isRetakingCaptures ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {i18n(language, { en: "Retake", fr: "Refaire" })}
            </Button>
            <Button
              className={`flex-1 rounded-sm border border-white/20 bg-white text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_32px_-12px_rgba(0,0,0,0.55)] hover:bg-zinc-200`}
              disabled={isUploadingCaptures || capturedPoses.length === 0}
              onClick={() => void uploadAndCompleteOnboarding()}
            >
              {isUploadingCaptures ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="mr-2 h-4 w-4 shrink-0" />
              )}
              {i18n(language, {
                en: "Launch analysis",
                fr: "Lancer l'analyse",
              })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isPotentialStep ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[rgba(14,20,26,0.55)] backdrop-blur-md pointer-events-none"
          role="region"
          aria-label={i18n(language, {
            en: "Unlock full analysis",
            fr: "Débloquer l'analyse complète",
          })}
        >
          <div className="mx-auto flex w-full max-w-[min(100%,28rem)] justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 sm:max-w-3xl sm:px-6 sm:pb-5">
            <div className="w-full max-w-[460px]">
              <button
                type="button"
                onClick={() => void handleUnlock()}
                disabled={isUnlocking}
                className={cn(
                  "pointer-events-auto flex w-full items-center justify-center px-4 py-3 text-base transition disabled:pointer-events-none disabled:opacity-60 sm:py-3.5",
                  onboardingPrimaryCtaClassName,
                )}
              >
                {isUnlocking ? (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : null}
                <span className="text-sm font-semibold tracking-tight sm:text-base">
                  {i18n(language, {
                    en: "Unlock my full analysis",
                    fr: "Débloquer mon analyse complète",
                  })}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
