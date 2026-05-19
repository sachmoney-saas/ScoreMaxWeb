import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Loader2,
  LogOut,
  ScanFace,
  Trash2,
  MoreVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PictureAvif } from "@/components/ui/picture-avif";
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
import { BillingPaywall } from "@/components/billing/BillingPaywall";
import { PotentialPreviewCard } from "@/components/onboarding/PotentialPreviewCard";
import { OnboardingScanCompleteScreen } from "@/components/onboarding/OnboardingScanCompleteScreen";
import {
  OnboardingFacialGeometryLoader,
  OnboardingScanCompleteSplash,
} from "@/components/onboarding/OnboardingPostCapturePrelude";
import { OnboardingMultistepGlassLoader } from "@/components/onboarding/OnboardingMultistepGlassLoader";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/hooks/use-user-access";
import { useOnboardingResume } from "@/hooks/use-onboarding-resume";
import { useOnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
import { getScanAssetLabels, resetScanSessionAssets } from "@/lib/face-analysis";
import {
  completeOnboardingApi,
  ONBOARDING_POSE_TO_ASSET,
  startOnboardingPotentialGenerationApi,
  uploadCapturedOnboardingPoses,
} from "@/lib/onboarding-complete-flow";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import { ONBOARDING_HERO_MIN_LANDMARKS } from "@/lib/face-capture/build-face-mesh-3d";
import { CAPTURE_POSES } from "@/lib/face-capture/types";
import {
  ONBOARDING_POST_CAPTURE_GEOMETRY_MIN_MS,
  ONBOARDING_POST_CAPTURE_POTENTIAL_MAX_WAIT_MS,
  shouldSkipOnboardingGeometryPrelude,
} from "@/lib/onboarding-post-capture";
import { deleteMyAccount } from "@/lib/account-api";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
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
import { isOnboardingScanSessionComplete } from "@/lib/onboarding-resume";
import {
  clearOnboardingMeshReplay,
  fetchOnboardingMeshReplayFromServer,
  readOnboardingMeshReplay,
  saveOnboardingMeshReplayToServer,
  type OnboardingMeshReplaySnapshot,
  writeOnboardingMeshReplay,
} from "@/lib/onboarding-mesh-replay-storage";

const ONBOARDING_TOTAL_STEPS = 4;

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

const ONBOARDING_RESUME_STEPS = [
  {
    en: "Resuming your session…",
    fr: "Reprise de ta session…",
  },
  {
    en: "Finalizing your scan…",
    fr: "Finalisation de ton scan…",
  },
  {
    en: "Almost ready…",
    fr: "Presque prêt…",
  },
] as const;

type OnboardingProps = {
  initialStep?: number;
};

type ScanHeroPreludePhase = "splash" | "geometry" | "mesh";

function buildMeshReplaySnapshotFromPoses(
  userId: string,
  poses: CapturedPose[],
): Omit<OnboardingMeshReplaySnapshot, "v"> | null {
  const frontalPose = poses.find((p) => p.poseId === "frontal");
  const eyePose = poses.find((p) => p.poseId === "closeup-eye");
  if (
    !frontalPose?.landmarks ||
    frontalPose.landmarks.length < ONBOARDING_HERO_MIN_LANDMARKS ||
    !frontalPose.landmarkFrameWidth ||
    !frontalPose.landmarkFrameHeight
  ) {
    return null;
  }

  return {
    userId,
    frontal: {
      landmarks: frontalPose.landmarks,
      landmarkFrameWidth: frontalPose.landmarkFrameWidth,
      landmarkFrameHeight: frontalPose.landmarkFrameHeight,
    },
    eye:
      eyePose?.landmarks &&
      eyePose.landmarks.length > 0 &&
      eyePose.landmarkFrameWidth &&
      eyePose.landmarkFrameHeight
        ? {
            landmarks: eyePose.landmarks,
            landmarkFrameWidth: eyePose.landmarkFrameWidth,
            landmarkFrameHeight: eyePose.landmarkFrameHeight,
          }
        : null,
  };
}

export default function Onboarding({ initialStep }: OnboardingProps = {}) {
  const language = useAppLanguage();
  const scanAssetLabels = getScanAssetLabels(language);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const access = useUserAccess();
  const [stepIndex, setStepIndex] = React.useState(() => {
    if (initialStep !== undefined) {
      const s = Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS - 1, initialStep));
      return s >= 3 ? 2 : s;
    }
    return 0;
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [showCameraCapture, setShowCameraCapture] = React.useState(false);
  const [capturedPoses, setCapturedPoses] = React.useState<CapturedPose[]>([]);
  const [showScanCompleteHero, setShowScanCompleteHero] = React.useState(false);
  const [isReviewingMeshFromPotential, setIsReviewingMeshFromPotential] =
    React.useState(false);
  const [scanHeroPreludePhase, setScanHeroPreludePhase] =
    React.useState<ScanHeroPreludePhase>("splash");
  /** Image potentiel prête / échec / timeout + délai mini atteint — accélère le loader géométrie puis passage mesh. */
  const [geometryImageWorkDone, setGeometryImageWorkDone] = React.useState(false);
  const [hasPotentialPreviewTimedOut, setHasPotentialPreviewTimedOut] =
    React.useState(false);
  /** Reprise du hero 3D depuis l’aperçu potentiel : saute splash + géométrie. */
  const reopenScanHeroAtMeshRef = React.useRef(false);
  const [showCapturedPreview, setShowCapturedPreview] = React.useState(false);
  const [isUploadingCaptures, setIsUploadingCaptures] = React.useState(false);
  const [isHeroUploading, setIsHeroUploading] = React.useState(false);
  const [heroUploadDone, setHeroUploadDone] = React.useState(false);
  const heroUploadDoneRef = React.useRef(false);
  const [isRetakingCaptures, setIsRetakingCaptures] = React.useState(false);
  const [capturePreviewError, setCapturePreviewError] = React.useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  /** Paywall Premium : modale sur l’étape aperçu avant/après (plus d’étape plein écran). */
  const [billingPaywallOpen, setBillingPaywallOpen] = React.useState(
    () => initialStep !== undefined && initialStep >= 3,
  );
  /**
   * Vrai dès qu'on a démarré l'upload + déclenché l'étape teaser ; bloque
   * la redirection automatique du gate (le serveur a déjà flippé
   * `has_completed_onboarding=true`).
   */
  const [hasStartedRun, setHasStartedRun] = React.useState(
    () => initialStep !== undefined && initialStep >= 2,
  );

  const [meshReplaySnapshot, setMeshReplaySnapshot] = React.useState<
    OnboardingMeshReplaySnapshot | null
  >(null);

  React.useEffect(() => {
    if (!user?.id) {
      setMeshReplaySnapshot(null);
      return;
    }
    const local = readOnboardingMeshReplay(user.id);
    setMeshReplaySnapshot(local);
    if (local) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;
        const remote = await fetchOnboardingMeshReplayFromServer(
          accessToken,
          user.id,
        );
        if (!remote || cancelled) return;
        writeOnboardingMeshReplay(remote);
        setMeshReplaySnapshot(remote);
      } catch (error) {
        console.warn("Unable to restore onboarding mesh replay:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  React.useLayoutEffect(() => {
    if (initialStep !== undefined) return;
    if (!user?.id) return;
    const persisted = readOnboardingFlowState(user.id);
    const rawNext =
      persisted?.step != null
        ? Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS - 1, persisted.step))
        : 0;
    let next = rawNext;
    if (next === 3) {
      setBillingPaywallOpen(true);
      next = 2;
    }
    setStepIndex(next);
    if (next >= 2) setHasStartedRun(true);
  }, [user?.id, initialStep]);

  const isPotentialStep = stepIndex === 2;
  const isPreCaptureIntroA = stepIndex === 0;
  const isPreCaptureIntroB = stepIndex === 1;

  React.useEffect(() => {
    if (user?.id) {
      writeOnboardingFlowState({ userId: user.id, step: stepIndex, v: 2 });
    }
  }, [stepIndex, user?.id]);

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

    if (access.canAccessApp) {
      clearOnboardingFlowState();
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }
  }, [access.canAccessApp, setLocation, user]);

  const {
    phase: capturePhase,
    scanStatus,
    isScanStatusLoading,
    isScanStatusError,
    isFinalizing,
    hasPartialUpload,
    finalizeFromServer,
    hasCompletedOnboarding,
  } = useOnboardingResume({
    language,
  });

  /** Reprise avec photos déjà enregistrées : sauter l’intro « Continuer ». */
  React.useEffect(() => {
    if (!hasPartialUpload || stepIndex !== 0) return;
    setStepIndex(1);
  }, [hasPartialUpload, stepIndex]);

  const didAutoFinalizeRef = React.useRef(false);

  const isOnboardingStep0Blocking =
    !isPotentialStep &&
    (isScanStatusLoading ||
      isUploadingCaptures ||
      isFinalizing ||
      (capturePhase === "ready_to_finalize" && !uploadError));

  const onboardingSessionId = scanStatus?.session_id;
  const didBackfillMeshReplayRef = React.useRef(false);

  const {
    data: potentialImage,
    isLoading: isPotentialImageLoading,
  } = useOnboardingPotentialImage({
    enabled:
      Boolean(user?.id) && (isPotentialStep || showScanCompleteHero),
  });

  const potentialImageForPreludeRef = React.useRef(potentialImage);
  potentialImageForPreludeRef.current = potentialImage;

  React.useEffect(() => {
    if (!isPotentialStep) {
      setHasPotentialPreviewTimedOut(false);
      return;
    }

    const isReady =
      potentialImage?.display_state === "ready" ||
      (potentialImage?.status === "completed" &&
        Boolean(potentialImage.generated_media_url ?? potentialImage.signed_url));
    if (isReady) {
      setHasPotentialPreviewTimedOut(false);
      return;
    }

    if (
      potentialImage?.status === "failed" ||
      potentialImage?.display_state === "unavailable"
    ) {
      setHasPotentialPreviewTimedOut(true);
      return;
    }

    setHasPotentialPreviewTimedOut(false);
    const timeoutId = window.setTimeout(() => {
      setHasPotentialPreviewTimedOut(true);
    }, ONBOARDING_POST_CAPTURE_POTENTIAL_MAX_WAIT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    isPotentialStep,
    potentialImage?.display_state,
    potentialImage?.id,
    potentialImage?.generated_media_url,
    potentialImage?.signed_url,
    potentialImage?.status,
  ]);

  React.useEffect(() => {
    if (
      isPotentialStep ||
      capturePhase !== "ready_to_finalize" ||
      didAutoFinalizeRef.current ||
      showCameraCapture ||
      showScanCompleteHero
    ) {
      return;
    }

    didAutoFinalizeRef.current = true;
    setHasStartedRun(true);
    setUploadError(null);

    void (async () => {
      try {
        const ok = await finalizeFromServer();
        if (ok) {
          setStepIndex(2);
          setHasStartedRun(true);
        } else {
          didAutoFinalizeRef.current = false;
        }
      } catch (error) {
        didAutoFinalizeRef.current = false;
        setUploadError(
          error instanceof Error
            ? error.message
            : i18n(language, {
                en: "Unable to resume your session. Try again.",
                fr: "Impossible de reprendre ta session. Réessaye.",
              }),
        );
      }
    })();
  }, [
    capturePhase,
    finalizeFromServer,
    isPotentialStep,
    language,
    showCameraCapture,
    showScanCompleteHero,
  ]);

  /** Si le replay existe déjà dans cet onglet, le pousser vers la source serveur durable. */
  React.useEffect(() => {
    if (!meshReplaySnapshot || !onboardingSessionId) return;
    if (didBackfillMeshReplayRef.current) return;
    didBackfillMeshReplayRef.current = true;

    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;
        await saveOnboardingMeshReplayToServer({
          accessToken,
          sessionId: onboardingSessionId,
          snapshot: meshReplaySnapshot,
        });
      } catch (error) {
        didBackfillMeshReplayRef.current = false;
        console.warn("Unable to backfill onboarding mesh replay:", error);
      }
    })();
  }, [meshReplaySnapshot, onboardingSessionId]);

  /** Arrivée directe à l’étape teaser (ex. autre appareil) : finaliser le profil si le scan est complet. */
  const didWarmFinalizeRef = React.useRef(false);
  React.useEffect(() => {
    if (!isPotentialStep) return;
    if (hasCompletedOnboarding) return;
    if (didWarmFinalizeRef.current) return;
    didWarmFinalizeRef.current = true;
    void (async () => {
      try {
        const ok = await finalizeFromServer();
        if (!ok) didWarmFinalizeRef.current = false;
      } catch (error) {
        didWarmFinalizeRef.current = false;
        console.error("Warm finalize from teaser step failed:", error);
      }
    })();
  }, [finalizeFromServer, hasCompletedOnboarding, isPotentialStep]);

  React.useEffect(() => {
    if (scanHeroPreludePhase !== "geometry") {
      setGeometryImageWorkDone(false);
    }
  }, [scanHeroPreludePhase]);

  /** Après capture : écran « scan terminé » (~3s) → loader géométrie seulement si l’aperçu potentiel n’est pas déjà résolu (reconnexion, etc.). */
  React.useEffect(() => {
    if (!showScanCompleteHero) {
      setScanHeroPreludePhase("splash");
      return;
    }
    if (reopenScanHeroAtMeshRef.current) {
      reopenScanHeroAtMeshRef.current = false;
      setScanHeroPreludePhase("mesh");
      return;
    }
    setScanHeroPreludePhase("splash");
    const id = window.setTimeout(() => {
      setScanHeroPreludePhase((prev) => {
        if (prev !== "splash") return prev;
        return shouldSkipOnboardingGeometryPrelude(
          potentialImageForPreludeRef.current,
        )
          ? "mesh"
          : "geometry";
      });
    }, 3000);
    return () => window.clearTimeout(id);
  }, [showScanCompleteHero]);

  const handleGeometryLoaderExit = React.useCallback(() => {
    setScanHeroPreludePhase("mesh");
  }, []);

  /**
   * Loader géométrie : attendre au minimum GEOMETRY_MIN_MS, puis jusqu’à ce que
   * l’image OneShot (Nano Banana) soit prête — ou échec / timeout.
   * Le chargeur avance les étapes (~60 s) puis absorbe le reste sur la dernière jusqu’à ce signal.
   */
  React.useEffect(() => {
    if (!showScanCompleteHero || scanHeroPreludePhase !== "geometry") return;

    const t0 = Date.now();

    const tick = () => {
      const elapsed = Date.now() - t0;
      const minGeometryDone = elapsed >= ONBOARDING_POST_CAPTURE_GEOMETRY_MIN_MS;
      const status = potentialImage?.status;
      const imageReady =
        potentialImage?.display_state === "ready" ||
        (status === "completed" &&
          Boolean(potentialImage?.generated_media_url ?? potentialImage?.signed_url));
      const imageTerminal =
        status === "failed" || potentialImage?.display_state === "unavailable";
      const timedOut = elapsed >= ONBOARDING_POST_CAPTURE_POTENTIAL_MAX_WAIT_MS;

      if (minGeometryDone && (imageReady || imageTerminal || timedOut)) {
        setGeometryImageWorkDone(true);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 400);
    return () => window.clearInterval(intervalId);
  }, [
    showScanCompleteHero,
    scanHeroPreludePhase,
    potentialImage?.display_state,
    potentialImage?.generated_media_url,
    potentialImage?.status,
    potentialImage?.signed_url,
  ]);

  const isPotentialImageReady =
    potentialImage?.display_state === "ready" ||
    (potentialImage?.status === "completed" &&
      Boolean(potentialImage.generated_media_url ?? potentialImage.signed_url));
  const shouldSuppressPotentialPreview =
    hasPotentialPreviewTimedOut ||
    potentialImage?.status === "failed" ||
    potentialImage?.display_state === "unavailable";

  const isPotentialBlockingLoad =
    isPotentialStep &&
    !shouldSuppressPotentialPreview &&
    (isPotentialImageLoading ||
      !potentialImage ||
      (!isPotentialImageReady && potentialImage.status !== "failed"));

  const uploadPosesToScanSession = React.useCallback(
    async (poses: CapturedPose[], sessionId: string) => {
      if (!user?.id) return;
      await uploadCapturedOnboardingPoses({
        userId: user.id,
        sessionId,
        poses,
        language,
      });
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-scan-status", user.id],
      });
      heroUploadDoneRef.current = true;
      setHeroUploadDone(true);
    },
    [language, user?.id],
  );

  const persistMeshReplaySnapshot = React.useCallback(
    async (poses: CapturedPose[], accessToken?: string | null) => {
      if (!user?.id) return;
      const snapshot = buildMeshReplaySnapshotFromPoses(user.id, poses);
      if (!snapshot) return;

      writeOnboardingMeshReplay(snapshot);
      setMeshReplaySnapshot(readOnboardingMeshReplay(user.id));

      if (!accessToken || !onboardingSessionId) return;
      try {
        const saved = await saveOnboardingMeshReplayToServer({
          accessToken,
          sessionId: onboardingSessionId,
          snapshot,
        });
        writeOnboardingMeshReplay(saved);
        setMeshReplaySnapshot(saved);
      } catch (error) {
        console.warn("Unable to persist onboarding mesh replay:", error);
      }
    },
    [onboardingSessionId, user?.id],
  );

  React.useEffect(() => {
    if (isOnboardingScanSessionComplete(scanStatus)) {
      heroUploadDoneRef.current = true;
      setHeroUploadDone(true);
    }
  }, [scanStatus]);

  const restartOnboardingCapture = React.useCallback(
    async (errorMessage?: string) => {
      if (errorMessage) {
        setCapturePreviewError(errorMessage);
      }
      setShowScanCompleteHero(false);
      setShowCapturedPreview(false);
      heroUploadDoneRef.current = false;
      setHeroUploadDone(false);

      if (!user?.id || !onboardingSessionId) {
        clearOnboardingMeshReplay();
        setMeshReplaySnapshot(null);
        setCapturedPoses([]);
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

        clearOnboardingMeshReplay();
        setMeshReplaySnapshot(null);
        setCapturedPoses([]);
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
    },
    [language, onboardingSessionId, user?.id],
  );

  const handleCapturedComplete = React.useCallback(
    async (poses: CapturedPose[]) => {
      setCapturePreviewError(null);
      const frontal = poses.find((p) => p.poseId === "frontal");
      const landmarksOk =
        (frontal?.landmarks?.length ?? 0) >= ONBOARDING_HERO_MIN_LANDMARKS;

      if (!landmarksOk) {
        console.error(
          "[onboarding] frontal landmarks missing after capture — forcing retake",
        );
        setShowCameraCapture(false);
        await restartOnboardingCapture(
          i18n(language, {
            en: "Face mapping data was incomplete. Please run the capture again.",
            fr: "Les données de cartographie du visage sont incomplètes. Relance la capture.",
          }),
        );
        return;
      }

      setCapturedPoses(poses);
      setShowCameraCapture(false);
      setShowScanCompleteHero(true);
      heroUploadDoneRef.current = false;
      setHeroUploadDone(false);

      const sessionId = scanStatus?.session_id;
      if (!user?.id || !sessionId) {
        setUploadError(
          i18n(language, {
            en: "Unable to save your photos. Refresh and try again.",
            fr: "Impossible d'enregistrer tes photos. Actualise et réessaye.",
          }),
        );
        return;
      }

      setIsHeroUploading(true);
      setUploadError(null);
      try {
        await uploadPosesToScanSession(poses, sessionId);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        await persistMeshReplaySnapshot(poses, accessToken);
        if (accessToken) {
          await startOnboardingPotentialGenerationApi({
            accessToken,
            language,
          });
          await queryClient.invalidateQueries({
            queryKey: ["onboarding-potential-image", user.id],
          });
        }
      } catch (error) {
        console.error("Unable to upload captures after scan:", error);
        setUploadError(
          error instanceof Error
            ? error.message
            : i18n(language, {
                en: "Unable to save your photos. Try again when you continue.",
                fr: "Impossible d'enregistrer tes photos. Réessaye en continuant.",
              }),
        );
      } finally {
        setIsHeroUploading(false);
      }
    },
    [
      language,
      queryClient,
      persistMeshReplaySnapshot,
      restartOnboardingCapture,
      scanStatus?.session_id,
      uploadPosesToScanSession,
      user?.id,
    ],
  );

  const handleRetakeCapturesFromPreview = React.useCallback(async () => {
    setCapturePreviewError(null);
    await restartOnboardingCapture();
  }, [restartOnboardingCapture]);

  const uploadAndCompleteOnboarding = React.useCallback(async () => {
    if (!user?.id || !onboardingSessionId) {
      return;
    }

    setIsUploadingCaptures(true);
    setUploadError(null);
    setShowCapturedPreview(false);

    try {
      if (
        !heroUploadDoneRef.current &&
        !isOnboardingScanSessionComplete(scanStatus) &&
        capturedPoses.length > 0
      ) {
        await uploadPosesToScanSession(capturedPoses, onboardingSessionId);
      }

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

      await completeOnboardingApi({ accessToken, language });
      await persistMeshReplaySnapshot(capturedPoses, accessToken);

      writeOnboardingFlowState({ userId: user.id, step: 2, v: 2 });
      setHasStartedRun(true);
      await queryClient.invalidateQueries({
        queryKey: ["onboarding-potential-image", user.id],
      });
      setStepIndex(2);
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
  }, [
    capturedPoses,
    language,
    onboardingSessionId,
    persistMeshReplaySnapshot,
    scanStatus,
    uploadPosesToScanSession,
    user?.id,
  ]);

  const frontalCapturePose = React.useMemo(
    () => capturedPoses.find((p) => p.poseId === "frontal"),
    [capturedPoses],
  );

  const onboardingArticleKey =
    stepIndex === 2
      ? "onboarding-step-2"
      : stepIndex === 1
          ? "onboarding-step-1-precap"
          : showScanCompleteHero
            ? `onboarding-step-0-hero-${scanHeroPreludePhase}`
            : "onboarding-step-0";

  const heroFrontalLandmarks =
    frontalCapturePose?.landmarks ?? meshReplaySnapshot?.frontal?.landmarks;
  const heroFrontalFrame =
    frontalCapturePose?.landmarkFrameWidth &&
    frontalCapturePose?.landmarkFrameHeight
      ? {
          width: frontalCapturePose.landmarkFrameWidth,
          height: frontalCapturePose.landmarkFrameHeight,
        }
      : meshReplaySnapshot
        ? {
            width: meshReplaySnapshot.frontal.landmarkFrameWidth,
            height: meshReplaySnapshot.frontal.landmarkFrameHeight,
          }
        : undefined;

  const heroHasMeshData =
    (heroFrontalLandmarks?.length ?? 0) >= ONBOARDING_HERO_MIN_LANDMARKS;

  const canReopenMeshHero =
    (frontalCapturePose?.landmarks?.length ?? 0) >=
      ONBOARDING_HERO_MIN_LANDMARKS ||
    (meshReplaySnapshot?.frontal?.landmarks?.length ?? 0) >=
      ONBOARDING_HERO_MIN_LANDMARKS;

  const handleScanCompleteContinue = React.useCallback(() => {
    if (isReviewingMeshFromPotential) {
      setIsReviewingMeshFromPotential(false);
      setShowScanCompleteHero(false);
      setStepIndex(2);
      return;
    }
    // Go straight to the transformation preview shell: its own skeleton handles
    // the wait while captured poses are uploaded/finalized in the background.
    setShowScanCompleteHero(false);
    setStepIndex(2);
    setHasStartedRun(true);
    void uploadAndCompleteOnboarding();
  }, [isReviewingMeshFromPotential, uploadAndCompleteOnboarding]);

  const handleScanCompleteReviewPoses = React.useCallback(() => {
    setShowScanCompleteHero(false);
    setShowCapturedPreview(true);
  }, []);

  const handleBackFromPotentialStep = React.useCallback(() => {
    if (!canReopenMeshHero) return;
    setIsReviewingMeshFromPotential(true);
    reopenScanHeroAtMeshRef.current = true;
    setStepIndex(2);
    setShowCameraCapture(false);
    setShowCapturedPreview(false);
    setShowScanCompleteHero(true);
  }, [canReopenMeshHero]);

  const openOnboardingCapture = React.useCallback(() => {
    if (
      !onboardingSessionId ||
      isScanStatusLoading ||
      capturePhase === "ready_to_finalize" ||
      capturePhase === "post_onboarding"
    ) {
      return;
    }
    setShowCameraCapture(true);
  }, [capturePhase, isScanStatusLoading, onboardingSessionId]);

  const handleRestartPartialCapture = React.useCallback(() => {
    void restartOnboardingCapture();
  }, [restartOnboardingCapture]);

  const handleRetryResumeFinalize = React.useCallback(() => {
    didAutoFinalizeRef.current = false;
    setUploadError(null);
    setHasStartedRun(true);
    void (async () => {
      try {
        const ok = await finalizeFromServer();
        if (ok) {
          didAutoFinalizeRef.current = true;
          setStepIndex(2);
        }
      } catch (error) {
        didAutoFinalizeRef.current = false;
        setUploadError(
          error instanceof Error
            ? error.message
            : i18n(language, {
                en: "Unable to resume your session. Try again.",
                fr: "Impossible de reprendre ta session. Réessaye.",
              }),
        );
      }
    })();
  }, [finalizeFromServer, language]);

  const handleUnlock = React.useCallback(() => {
    if (!user?.id) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }
    setIsUnlocking(true);
    try {
      writeOnboardingFlowState({ userId: user.id, step: 2, v: 2 });
      setBillingPaywallOpen(true);
      setHasStartedRun(true);
    } finally {
      setIsUnlocking(false);
    }
  }, [setLocation, user?.id]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
    clearOnboardingFlowState();
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

      clearOnboardingFlowState();
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

      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.35rem))] sm:max-w-3xl sm:px-6 sm:pb-5 sm:pt-5 md:max-w-4xl",
        )}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-3">
          <div className="w-full shrink-0 space-y-2 sm:space-y-2.5">
            <div className="flex justify-center">
              <img
                src="/favicon.png"
                alt="Logo ScoreMax"
                className="h-9 w-9 rounded-xl border border-white/25 bg-white/10 p-1.5 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)] sm:h-10 sm:w-10"
              />
            </div>

            {(isPreCaptureIntroB &&
              !showCameraCapture &&
              !showScanCompleteHero) ||
            (isPotentialStep && canReopenMeshHero && !showScanCompleteHero) ? (
              <div className="mx-auto flex w-full max-w-full items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isPotentialStep
                      ? handleBackFromPotentialStep()
                      : setStepIndex(0)
                  }
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 sm:size-10",
                    "transition hover:bg-white/15 hover:text-white",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                  )}
                  aria-label={
                    isPotentialStep
                      ? i18n(language, {
                          en: "Back to 3D face preview",
                          fr: "Retour à l’aperçu 3D du visage",
                        })
                      : i18n(language, {
                          en: "Previous step",
                          fr: "Étape précédente",
                        })
                  }
                >
                  <ChevronLeft className="size-7" strokeWidth={2.35} aria-hidden />
                </button>
                <div
                  className="grid min-h-2 min-w-[11rem] w-[17.5rem] max-w-full shrink-0 gap-1.5 sm:w-[19rem] md:w-[20.5rem]"
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
                <div
                  className="size-9 shrink-0 pointer-events-none opacity-0 sm:size-10"
                  aria-hidden
                />
              </div>
            ) : (
            <div className="mx-auto w-full max-w-[min(100%,17.5rem)] sm:max-w-[19rem] md:max-w-[20.5rem]">
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
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              <motion.article
                key={onboardingArticleKey}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn(
                  saasGlassPanelClassName,
                  "text-white shadow-[0_24px_70px_-35px_rgba(0,0,0,0.65)]",
                  isPotentialBlockingLoad
                    ? "flex w-full flex-col overflow-hidden p-4 sm:p-6"
                    : cn(
                        "flex min-h-0 flex-1 flex-col overflow-hidden",
                        "px-4 pt-7 pb-8 sm:px-6 sm:pt-8 sm:pb-9 md:px-8 md:pt-9 md:pb-10 lg:px-10 lg:pt-10 lg:pb-11",
                      ),
                  "mx-auto w-full",
                  isPotentialStep
                    ? "max-w-[min(100%,28rem)] sm:max-w-[min(100%,32rem)] md:max-w-[min(100%,38rem)] lg:max-w-[min(100%,42rem)] xl:max-w-[min(100%,44rem)]"
                    : "max-w-[min(100%,24rem)] sm:max-w-[min(100%,25rem)] md:max-w-[min(100%,26rem)] lg:max-w-[min(100%,28rem)]",
                )}
              >
                {showScanCompleteHero && heroHasMeshData ? (
                  scanHeroPreludePhase === "mesh" ? (
                  <OnboardingScanCompleteScreen
                    language={language}
                    frontalLandmarks={heroFrontalLandmarks!}
                    landmarkFrame={
                      heroFrontalFrame
                        ? {
                            width: heroFrontalFrame.width,
                            height: heroFrontalFrame.height,
                          }
                        : undefined
                    }
                    onContinue={handleScanCompleteContinue}
                    onReviewPoses={
                      isReviewingMeshFromPotential
                        ? undefined
                        : handleScanCompleteReviewPoses
                    }
                    isContinuing={
                      isReviewingMeshFromPotential ? false : isUploadingCaptures
                    }
                    isSavingCaptures={
                      isReviewingMeshFromPotential ? false : isHeroUploading
                    }
                    continueDisabled={
                      isReviewingMeshFromPotential
                        ? false
                        : !heroUploadDone &&
                          !isOnboardingScanSessionComplete(scanStatus)
                    }
                  />
                  ) : scanHeroPreludePhase === "geometry" ? (
                    <OnboardingFacialGeometryLoader
                      language={language}
                      workCompleteSignal={geometryImageWorkDone}
                      onExitComplete={handleGeometryLoaderExit}
                    />
                  ) : (
                    <OnboardingScanCompleteSplash language={language} />
                  )
                ) : isPotentialStep ? (
                  // `overflow-hidden` + paddings fluides : tout le contenu
                  // (titre → CTA Continuer) reste dans la vue, peu importe la
                  // hauteur. L'ancien combo `justify-center + overflow-y-auto`
                  // rendait le haut inaccessible quand ça débordait.
                  <div
                    className={cn(
                      "flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-[clamp(0.35rem,1.2vh,1rem)] sm:px-2",
                      isPotentialBlockingLoad ? "justify-start" : "justify-center",
                    )}
                  >
                    <PotentialPreviewCard
                      language={language}
                      potentialImage={potentialImage ?? null}
                      isLoading={isPotentialImageLoading}
                      suppressPreview={shouldSuppressPotentialPreview}
                      onUnlock={handleUnlock}
                      isUnlocking={isUnlocking}
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
                            : isFinalizing ||
                                capturePhase === "ready_to_finalize"
                              ? ONBOARDING_RESUME_STEPS
                              : ONBOARDING_SCAN_SESSION_STEPS
                        }
                        cycleResetKey={
                          isUploadingCaptures
                            ? "upload"
                            : isFinalizing ||
                                capturePhase === "ready_to_finalize"
                              ? "resume"
                              : "session"
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden",
                      "py-0.5 sm:py-1",
                    )}
                  >
                    <div
                      className={cn(
                        "mx-auto flex w-full max-w-full flex-col items-center text-center",
                        "gap-3 [@media(max-height:700px)]:gap-2",
                        "sm:gap-4 md:gap-5 lg:gap-6",
                      )}
                    >
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
                      {capturePreviewError ? (
                        <div
                          className={cn(
                            saasGlassInsetClassName,
                            "w-full p-3 text-left sm:p-4",
                          )}
                        >
                          <p className="text-sm text-red-200">{capturePreviewError}</p>
                        </div>
                      ) : null}
                      {isPreCaptureIntroA ? (
                        <>
                      <h2
                        className={cn(
                          "font-hero max-w-[min(100%,22ch)] font-semibold tracking-[-0.02em] text-balance text-white",
                          "text-[clamp(1.45rem,0.42rem+3.8vw,2.35rem)] leading-[1.1]",
                          "sm:max-w-[min(100%,26ch)] sm:leading-[1.08]",
                          "md:max-w-[min(100%,30ch)] md:text-[clamp(1.65rem,0.65rem+2.4vw,2.4rem)]",
                          "[@media(max-height:700px)]:text-[clamp(1.2rem,0.25rem+3vw,1.9rem)]",
                          "lg:leading-[1.06]",
                        )}
                      >
                        {i18n(language, {
                          en: "You've never really assessed your looks",
                          fr: "Tu n'as encore jamais évalué ton physique",
                        })}
                      </h2>
                      <p
                        className={cn(
                          "w-full max-w-[min(100%,38ch)] text-pretty text-[0.875rem] font-normal leading-[1.55] text-zinc-300/95",
                          "sm:max-w-[min(100%,44ch)] sm:text-[0.96875rem] sm:leading-[1.58]",
                          "md:max-w-[min(100%,50ch)] md:text-[1.035rem] md:leading-[1.55]",
                          "lg:max-w-[min(100%,54ch)] lg:text-[1.085rem]",
                          "[@media(max-height:700px)]:text-[0.84375rem] [@media(max-height:700px)]:leading-[1.48]",
                        )}
                      >
                        {i18n(language, {
                          en: "When you're looksmaxxing, you need real facial depth, not a photo that flattens everything. It's the only serious framework. Flat shots leave too much hidden.",
                          fr: "Pour décider quoi améliorer en looksmaxxing, il te faut le relief réel de ton visage, pas une image qui l'écrase. C'est le cadre le plus sérieux. Les photos seules ne suffisent pas.",
                        })}
                      </p>
                      <div className="w-full max-w-full shrink-0">
                        <PictureAvif
                          avifSrc="/3dscan1.avif"
                          fallbackSrc="/3dscan1.png"
                          alt={i18n(language, {
                            en: "3D facial scan visualization",
                            fr: "Visualisation d'un scan facial en 3D",
                          })}
                          className="block w-full"
                          imgClassName={cn(
                            "mx-auto block h-auto w-full max-w-full object-contain",
                            "max-h-[min(50vh,30rem)] sm:max-h-[min(54vh,34rem)] sm:rounded-2xl",
                            "md:max-h-[min(56vh,36rem)] lg:max-h-[min(58vh,38rem)]",
                            "rounded-[1.25rem]",
                            "[filter:drop-shadow(0_20px_40px_rgba(0,0,0,0.45))]",
                            "[@media(max-height:700px)]:max-h-[min(38vh,16.5rem)]",
                          )}
                          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 26rem, 28rem"
                        />
                      </div>
                        </>
                      ) : (
                        <>
                      <h2
                        className={cn(
                          "font-hero max-w-[min(100%,22ch)] font-semibold tracking-[-0.02em] text-balance text-white",
                          "text-[clamp(1.45rem,0.42rem+3.8vw,2.35rem)] leading-[1.1]",
                          "sm:max-w-[min(100%,28ch)] sm:leading-[1.08]",
                          "md:max-w-[min(100%,32ch)] md:text-[clamp(1.65rem,0.65rem+2.4vw,2.4rem)]",
                          "[@media(max-height:700px)]:text-[clamp(1.2rem,0.25rem+3vw,1.9rem)]",
                          "lg:leading-[1.06]",
                        )}
                      >
                        {i18n(language, {
                          en: "Let's analyze your face with a 3D scan",
                          fr: "Analysons maintenant ton visage en scan 3D",
                        })}
                      </h2>
                      <p
                        className={cn(
                          "w-full max-w-[min(100%,38ch)] text-pretty text-[0.875rem] font-normal leading-[1.55] text-zinc-300/95",
                          "sm:max-w-[min(100%,44ch)] sm:text-[0.96875rem] sm:leading-[1.58]",
                          "md:max-w-[min(100%,50ch)] md:text-[1.035rem] md:leading-[1.55]",
                          "[@media(max-height:700px)]:text-[0.84375rem] [@media(max-height:700px)]:leading-[1.48]",
                        )}
                      >
                        {i18n(language, {
                          en: "It only takes about ten seconds. Your data stays private, and you can delete it anytime.",
                          fr: "Ça prend à peine dix secondes. Tes données restent privées, et tu peux les supprimer quand tu veux.",
                        })}
                      </p>
                      <div
                        className="grid w-full max-w-[min(100%,24rem)] grid-cols-2 gap-2.5 sm:max-w-lg sm:gap-3 md:max-w-xl"
                      >
                        <div
                          className={cn(
                            "relative flex min-h-0 aspect-[4/5] w-full max-h-[9.5rem] flex-col rounded-2xl sm:max-h-[11rem]",
                            "border border-red-950/55 bg-[linear-gradient(160deg,rgba(42,8,12,0.92)_0%,rgba(22,4,7,0.97)_100%)]",
                            "shadow-[0_14px_36px_-16px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)]",
                          )}
                        >
                          <X
                            className="absolute right-2 top-2 z-10 size-12 text-red-800 sm:right-2.5 sm:top-2.5 sm:size-14"
                            strokeWidth={2.15}
                          />
                          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2 py-3 sm:gap-2.5 sm:px-3 sm:py-4">
                            <ImageIcon
                              className="size-9 shrink-0 text-red-800/95 sm:size-11"
                              strokeWidth={1.85}
                            />
                            <span className="text-center text-[0.8125rem] font-semibold leading-tight text-red-700/95 sm:text-sm">
                              {i18n(language, {
                                en: "2D Photos",
                                fr: "Photos 2D",
                              })}
                            </span>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "relative flex min-h-0 aspect-[4/5] w-full max-h-[9.5rem] flex-col rounded-2xl sm:max-h-[11rem]",
                            "border border-sky-400/40 bg-[linear-gradient(160deg,hsl(199_58%_11%/0.92)_0%,hsl(200_45%_7%/0.97)_100%)]",
                            "shadow-[0_14px_36px_-16px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(56,189,248,0.14)]",
                          )}
                        >
                          <Check
                            className="absolute right-2 top-2 z-10 size-12 text-sky-400 sm:right-2.5 sm:top-2.5 sm:size-14"
                            strokeWidth={2.15}
                          />
                          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2 py-3 sm:gap-2.5 sm:px-3 sm:py-4">
                            <Box
                              className="size-9 shrink-0 text-sky-400 sm:size-11"
                              strokeWidth={2.15}
                            />
                            <span className="text-center text-[0.8125rem] font-semibold leading-tight text-sky-400 sm:text-sm">
                              {i18n(language, {
                                en: "3D Scan",
                                fr: "Scan 3D",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ol
                        className={cn(
                          "m-0 mx-auto flex w-full max-w-[min(100%,24rem)] list-none flex-col gap-3 p-0",
                          "sm:max-w-lg",
                        )}
                      >
                        <li className="flex w-full min-w-0 items-center justify-center gap-3">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full",
                              "border border-zinc-600/80 bg-zinc-900/90 text-[0.8125rem] font-semibold tabular-nums text-white",
                              "ring-1 ring-white/5 sm:size-9 sm:text-sm",
                            )}
                            aria-hidden
                          >
                            1
                          </span>
                          <span className="min-w-0 text-[0.8125rem] font-medium leading-snug text-zinc-200 sm:text-sm">
                            {i18n(language, {
                              en: "Enable Camera Permission",
                              fr: "Autorise l'accès à la caméra",
                            })}
                          </span>
                        </li>
                        <li className="flex w-full min-w-0 items-center justify-center gap-3">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full",
                              "border border-zinc-600/80 bg-zinc-900/90 text-[0.8125rem] font-semibold tabular-nums text-white",
                              "ring-1 ring-white/5 sm:size-9 sm:text-sm",
                            )}
                            aria-hidden
                          >
                            2
                          </span>
                          <span className="min-w-0 text-[0.8125rem] font-medium leading-snug text-zinc-200 sm:text-sm">
                            {i18n(language, {
                              en: "Follow the on-screen instructions",
                              fr: "Suis les instructions à l'écran",
                            })}
                          </span>
                        </li>
                      </ol>
                        </>
                      )}
                      {hasPartialUpload && scanStatus ? (
                        <p
                          className={cn(
                            "w-full max-w-[min(100%,42ch)] text-sm leading-relaxed text-zinc-300 sm:text-base",
                            "md:max-w-[min(100%,48ch)]",
                          )}
                        >
                          {i18n(language, {
                            en: `You already have ${scanStatus.completed_asset_count}/${scanStatus.required_asset_count} photos saved. Finish the remaining poses to continue.`,
                            fr: `Tu as déjà ${scanStatus.completed_asset_count}/${scanStatus.required_asset_count} photos enregistrées. Termine les poses restantes pour continuer.`,
                          })}
                        </p>
                      ) : null}
                      {hasPartialUpload &&
                      scanStatus &&
                      scanStatus.missing_asset_types.length > 0 ? (
                        <div
                          className={cn(
                            saasGlassInsetClassName,
                            "w-full p-3 text-left sm:p-4",
                          )}
                        >
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                            {i18n(language, {
                              en: "Still missing",
                              fr: "Encore à capturer",
                            })}
                          </p>
                          <ul className="space-y-1 text-sm text-zinc-200">
                            {scanStatus.missing_asset_types.map((label) => (
                              <li key={label}>{label}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {isScanStatusError ? (
                        <p className="text-sm text-red-300">
                          {i18n(language, {
                            en: "Unable to load your scan session. Refresh the page and try again.",
                            fr: "Impossible de charger ta session. Actualise la page et réessaye.",
                          })}
                        </p>
                      ) : null}
                      {uploadError && capturePhase === "ready_to_finalize" ? (
                        <button
                          type="button"
                          onClick={() => void handleRetryResumeFinalize()}
                          disabled={isFinalizing}
                          className="text-sm font-medium text-white underline underline-offset-2 disabled:opacity-50"
                        >
                          {i18n(language, {
                            en: "Retry",
                            fr: "Réessayer",
                          })}
                        </button>
                      ) : null}
                      <div
                        className={cn(
                          "w-full max-w-full",
                          "shrink-0 pt-1 sm:pt-1.5",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            isPreCaptureIntroA
                              ? setStepIndex(1)
                              : void openOnboardingCapture()
                          }
                          disabled={
                            isPreCaptureIntroA
                              ? isScanStatusError
                              : !onboardingSessionId || isScanStatusError
                          }
                          className={cn(
                            "flex min-h-[2.75rem] w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-base transition",
                            "disabled:pointer-events-none disabled:opacity-55 sm:min-h-[3rem] sm:gap-3 sm:px-5 sm:py-3.5",
                            "[@media(max-height:700px)]:min-h-[2.5rem] [@media(max-height:700px)]:py-2.5 [@media(max-height:700px)]:text-[0.8125rem]",
                            onboardingPrimaryCtaClassName,
                          )}
                        >
                          <span className="text-sm font-semibold tracking-tight sm:text-base">
                            {isPreCaptureIntroA
                              ? i18n(language, {
                                  en: "Continue",
                                  fr: "Continuer",
                                })
                              : hasPartialUpload
                                ? i18n(language, {
                                    en: "Continue capture",
                                    fr: "Continuer la capture",
                                  })
                                : i18n(language, {
                                    en: "Launch scan",
                                    fr: "Lancer le scan",
                                  })}
                          </span>
                        </button>
                        {isPreCaptureIntroB && hasPartialUpload ? (
                          <button
                            type="button"
                            onClick={() => void handleRestartPartialCapture()}
                            disabled={isRetakingCaptures || isScanStatusError}
                            className="mt-3 text-sm font-medium text-zinc-300 underline underline-offset-2 transition hover:text-white disabled:pointer-events-none disabled:opacity-50"
                          >
                            {isRetakingCaptures
                              ? i18n(language, {
                                  en: "Resetting…",
                                  fr: "Réinitialisation…",
                                })
                              : i18n(language, {
                                  en: "Start over",
                                  fr: "Tout recommencer",
                                })}
                          </button>
                        ) : null}
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
                  en: `${capturedPoses.length}/${CAPTURE_POSES.length} poses.`,
                  fr: `${capturedPoses.length}/${CAPTURE_POSES.length} poses.`,
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
                en: "Launch scan",
                fr: "Lancer le scan",
              })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={billingPaywallOpen} onOpenChange={setBillingPaywallOpen}>
        <DialogContent
          aria-describedby={undefined}
          className={cn(
            "max-h-[min(92dvh,900px)] max-w-[min(100vw-1.25rem,56rem)] overflow-y-auto border-white/15 bg-zinc-950/96 p-3 text-zinc-50 shadow-[0_40px_120px_-80px_rgba(0,0,0,0.92)] backdrop-blur-xl sm:rounded-2xl sm:p-5",
            "[&>button]:text-zinc-400 [&>button]:hover:bg-white/10 [&>button]:hover:text-white",
          )}
        >
          <BillingPaywall variant="dialog" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
