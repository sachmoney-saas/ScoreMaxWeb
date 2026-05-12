import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Infinity as InfinityIcon,
  Loader2,
  LogOut,
  ScanFace,
  Trash2,
  Users,
  MoreVertical,
} from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
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
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import {
  useAnalysisJobStatus,
  useOnboardingScanStatus,
} from "@/hooks/use-supabase";
import {
  getScanAssetLabels,
  resetScanSessionAssets,
  uploadScanAsset,
} from "@/lib/face-analysis";
import { guideTraceBlobUploadsFromCapturedPose } from "@/lib/guide-trace-scan-uploads";
import { buildAnalysisSupportMessage } from "@/lib/analysis-error-message";
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
import {
  onboardingBackButtonClassName,
  onboardingPrimaryCtaClassName,
} from "@/lib/cta-button-styles";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

type OnboardingEvidenceBlock = {
  claim: string;
  source: string;
};

type OnboardingStep = {
  title: string;
  category: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Blocs citation + source ; vide = pas d’encadré gris (ex. introduction). */
  evidence: OnboardingEvidenceBlock[];
};

/** Comparatif Rencontres — chargées en cache dès l’entrée dans l’onboarding. */
const ONBOARDING_PRELOAD_IMAGE_URLS = ["/model1.png", "/model2.png"] as const;

function OnboardingBeforeAfterComparison({ language }: { language: AppLanguage }) {
  const [splitPercent, setSplitPercent] = React.useState(50);

  /** Largeur d’image en % du panneau pour retrouver le même cadrage qu’un plein cadre (pas deux couches pleine taille). */
  const leftPanelImgWidthPct = 100 / (splitPercent / 100);
  const rightShare = (100 - splitPercent) / 100;
  const rightPanelImgWidthPct =
    rightShare > 0 ? 100 / rightShare : 100;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Hauteur plafonnée par viewport pour garder l'étape lisible sans scroll excessif */}
      <div
        className="relative isolate aspect-[4/5] w-full max-h-[min(28svh,220px)] overflow-hidden rounded-2xl border border-white/15 bg-black/30 shadow-[0_28px_65px_-52px_rgba(0,0,0,0.45)] sm:aspect-[4/3] sm:max-h-[min(32svh,300px)] md:max-h-[min(38svh,360px)] lg:max-h-[min(44svh,480px)]"
      >
        {/* Panneau gauche : uniquement l’avant — aucune image droite en dessous */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] overflow-hidden"
          style={{ width: `${splitPercent}%` }}
        >
          <img
            src="/model2.png"
            alt="Avant optimisation"
            loading="lazy"
            className="absolute top-0 left-0 h-full max-w-none select-none object-cover object-center"
            style={{ width: `${leftPanelImgWidthPct}%` }}
          />
          <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1.5 sm:bottom-4 sm:left-4">
            <div className="flex items-baseline gap-1 rounded-2xl border border-white/25 bg-gradient-to-br from-black/70 to-black/50 px-3 py-2 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.55)] backdrop-blur-md">
              <span className="font-display text-xl font-bold tabular-nums leading-none text-white sm:text-2xl">
                2
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85 sm:text-xs">
                match
              </span>
            </div>
            <div className="flex h-9 min-h-9 w-max items-center justify-center rounded-lg border border-white/20 bg-black/45 px-3 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none text-white/95 shadow-sm backdrop-blur-sm sm:h-10 sm:min-h-10 sm:text-[11px]">
              0 Bodycount
            </div>
          </div>
        </div>

        {/* Panneau droit : uniquement l’après */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] overflow-hidden"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <img
            src="/model1.png"
            alt="Après optimisation"
            loading="lazy"
            className="absolute top-0 right-0 h-full max-w-none select-none object-cover object-center"
            style={{ width: `${rightPanelImgWidthPct}%` }}
          />
          <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1.5 sm:right-4 sm:bottom-4">
            <div className="flex items-baseline gap-1 rounded-2xl border border-white/25 bg-gradient-to-br from-[#fe3c72]/95 to-[#fd267d]/90 px-3 py-2 shadow-[0_8px_24px_-4px_rgba(253,38,125,0.45)] backdrop-blur-sm">
              <span className="font-display text-xl font-bold tabular-nums leading-none text-white sm:text-2xl">
                142
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/90 sm:text-xs">
                match
              </span>
            </div>
            <div className="flex h-9 min-h-9 w-max items-center gap-1.5 rounded-lg border border-white/25 bg-[#fd267d]/85 px-3 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none text-white shadow-sm backdrop-blur-sm sm:h-10 sm:min-h-10 sm:text-[11px]">
              <InfinityIcon
                className="h-[18px] w-[30px] shrink-0 stroke-[2.25] text-white"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>bodycount</span>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          style={{ left: `${splitPercent}%` }}
        />
      </div>

      <input
        type="range"
        min={20}
        max={80}
        value={splitPercent}
        onChange={(event) => setSplitPercent(Number(event.currentTarget.value))}
        aria-label={i18n(language, {
          en: "Compare before and after",
          fr: "Comparer avant et apres",
        })}
        className="h-1.5 w-full shrink-0 cursor-ew-resize appearance-none rounded-full bg-white/15 accent-white sm:h-2"
      />
    </div>
  );
}

function OnboardingSocialProofShowcase({ language }: { language: AppLanguage }) {
  const currentScore = 43.7;
  const potentialScore = 74.5;
  const chartWidth = 560;
  const chartHeight = 260;
  const plotLeft = 52;
  const plotRight = 18;
  const plotTop = 42;
  const plotBottom = 48;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const plotHeight = chartHeight - plotTop - plotBottom;
  const xMin = 0;
  const xMax = 100;

  const xToPixel = (x: number) =>
    plotLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const yToPixel = (y: number) => plotTop + (1 - y) * plotHeight;
  /** Forme de courbe définie sur [0, 10] ; on la réutilise avec x/10 pour une échelle 0–100. */
  const gaussianShape = (t: number) => {
    const peak = Math.exp(-Math.pow(t - 5.05, 2) / (2 * Math.pow(0.86, 2)));
    const leftTail = 0.085 / (1 + Math.exp((t - 2.35) * 2.1));
    const rightTail = 0.075 / (1 + Math.exp((7.25 - t) * 1.8));
    const shoulder =
      0.018 * Math.exp(-Math.pow(t - 8.9, 2) / (2 * Math.pow(1.05, 2)));
    return Math.min(1, peak + leftTail + rightTail + shoulder);
  };

  const curvePoints = Array.from({ length: 240 }, (_, index) => {
    const x = xMin + (index / 239) * (xMax - xMin);
    const density = gaussianShape((x / (xMax - xMin)) * 10);
    return `${xToPixel(x).toFixed(2)},${yToPixel(density).toFixed(2)}`;
  }).join(" ");

  const scoreLabel = currentScore.toFixed(1);

  const currentX = xToPixel(currentScore);
  const potentialX = xToPixel(potentialScore);

  return (
    <div className="min-w-0 space-y-2 sm:space-y-2.5">
      <div className="mx-auto max-w-xl text-center">
        <h3 className="font-hero text-lg font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-2xl md:text-3xl">
          {i18n(language, {
            en: "Your score isn't fixed",
            fr: "Ton score n'est pas figé",
          })}
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-zinc-300 sm:mt-1.5 sm:text-sm sm:leading-relaxed md:text-base">
          {i18n(language, {
            en: "Small, consistent changes compound over time. Track your progress and watch your score move.",
            fr: "De petits changements réguliers se cumulent avec le temps. Suis ta progression et regarde ton score évoluer.",
          })}
        </p>
      </div>

      <div className="flex items-end justify-center gap-3 pt-0.5 text-center sm:gap-7 md:gap-9">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            {i18n(language, { en: "Today", fr: "Aujourd'hui" })}
          </p>
          <p className="mt-0.5 font-display text-3xl tracking-tight text-zinc-100 sm:mt-1 sm:text-5xl md:text-6xl">
            {scoreLabel}
          </p>
        </div>
        <div
          className="pb-1.5 text-2xl font-light text-zinc-200 sm:pb-2 md:pb-3 md:text-5xl"
          aria-hidden
        >
          →
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            {i18n(language, { en: "Potential", fr: "Potentiel" })}
          </p>
          <p className="mt-0.5 font-display text-3xl tracking-tight text-white sm:mt-1 sm:text-5xl md:text-6xl">
            {potentialScore.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="flex w-full min-w-0 justify-center pt-0.5 sm:pt-1">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="mx-auto block h-auto w-full max-h-[clamp(104px,min(22dvw,28dvh),152px)] sm:max-h-[min(148px,30dvh)] md:max-h-[168px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Score distribution chart"
        >
              {[0.2, 0.4, 0.6, 0.8, 1].map((value) => (
                <line
                  key={`grid-${value}`}
                  x1={plotLeft}
                  y1={yToPixel(value)}
                  x2={plotLeft + plotWidth}
                  y2={yToPixel(value)}
                  stroke="rgb(148 163 184)"
                  strokeOpacity={0.38}
                  strokeWidth="1"
                />
              ))}
              <line
                x1={plotLeft}
                y1={plotTop + plotHeight}
                x2={plotLeft + plotWidth}
                y2={plotTop + plotHeight}
                stroke="rgb(203 213 225)"
                strokeOpacity={0.55}
                strokeWidth="1"
              />
              <polyline
                points={curvePoints}
                fill="none"
                stroke="rgb(226 232 240)"
                strokeOpacity={0.92}
                strokeWidth="2.5"
              />
              <line
                x1={currentX}
                y1={plotTop}
                x2={currentX}
                y2={plotTop + plotHeight}
                stroke="rgb(196 214 176)"
                strokeWidth="3"
              />
              <line
                x1={potentialX}
                y1={plotTop}
                x2={potentialX}
                y2={plotTop + plotHeight}
                stroke="rgb(180 220 200)"
                strokeWidth="2.25"
                strokeDasharray="7 5"
                strokeOpacity={0.95}
              />
              <rect
                x={currentX - 62}
                y={plotTop - 30}
                width="124"
                height="24"
                rx="12"
                fill="rgba(39, 39, 42, 0.92)"
                stroke="rgb(161 161 170)"
                strokeOpacity={0.85}
              />
              <text
                x={currentX + 2}
                y={plotTop - 14}
                textAnchor="middle"
                fontSize="11"
                fill="rgb(244 244 245)"
                fontWeight="600"
              >
                {`${scoreLabel} / 100`}
              </text>
              <text
                x={(currentX + potentialX) / 2 + 4}
                y={plotTop + plotHeight - 2}
                transform={`rotate(-90 ${(currentX + potentialX) / 2 + 4} ${plotTop + plotHeight - 2})`}
                fontSize="14"
                fill="rgb(196 214 176)"
                fontWeight="500"
                letterSpacing="0.06em"
              >
                {i18n(language, { en: "IMPROVEMENT", fr: "PROGRESSION" })}
              </text>
              {[0, 10, 20, 30, 40].map((tick, index) => (
                <text
                  key={`ytick-${tick}`}
                  x={plotLeft - 10}
                  y={yToPixel(index / 4) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgb(212 212 216)"
                >
                  {tick}
                </text>
              ))}
              <text
                x={22}
                y={plotTop + plotHeight / 2}
                transform={`rotate(-90 22 ${plotTop + plotHeight / 2})`}
                textAnchor="middle"
                fontSize="11"
                fill="rgb(212 212 216)"
                letterSpacing="0.08em"
                fontWeight="500"
              >
                {i18n(language, { en: "POPULATION DENSITY", fr: "DENSITE DE POPULATION" })}
              </text>
              {[0, 20, 40, 60, 80, 100].map((mark) => (
                <text
                  key={`xmark-${mark}`}
                  x={xToPixel(mark)}
                  y={plotTop + plotHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgb(212 212 216)"
                >
                  {mark}
                </text>
              ))}
              <text
                x={plotLeft + plotWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize="11"
                fill="rgb(212 212 216)"
                letterSpacing="0.15em"
                fontWeight="600"
              >
                {i18n(language, {
                  en: "OVERALL SCORE (0–100)",
                  fr: "SCORE GLOBAL (0–100)",
                })}
              </text>
            </svg>
      </div>
    </div>
  );
}

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

function getOnboardingSteps(language: AppLanguage): OnboardingStep[] {
  const tr = (en: string, fr: string) => i18n(language, { en, fr });
  return [
  {
    title: tr("In dating, visuals drive the first decision", "En rencontres, le visuel domine la première décision"),
    category: tr("Dating", "Rencontres"),
    description:
      tr(
        "Your image is the primary entry filter: improving presentation changes opportunity quality.",
        "Ton image est le filtre principal d'entrée: optimiser ta présentation change la qualité des opportunités.",
      ),
    evidence: [
      {
        claim:
          tr(
            "On dating apps, appearance matters about 9 times more than your bio.",
            "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
          ),
        source:
          "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
      },
    ],
  },
  {
    title: tr("The halo effect also transforms your social life", "L'effet halo transforme aussi ta vie sociale"),
    category: tr("Social life", "Vie sociale"),
    description:
      tr(
        "Trust, credibility, leadership: appearance influences these perceptions across many contexts.",
        "Confiance, crédibilité, leadership: l'apparence influence ces perceptions dans de nombreux contextes.",
      ),
    icon: Users,
    evidence: [
      {
        claim:
          tr(
            "Attractive people are perceived as more moral and more trustworthy.",
            "Les personnes attirantes sont perçues comme plus morales et plus dignes de confiance.",
          ),
        source:
          "Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior.",
      },
    ],
  },
  {
    title: "",
    category: tr("AI analysis", "Analyse IA"),
    description: "",
    icon: ScanFace,
    evidence: [],
  },
  ];
}


export default function Onboarding() {
  const language = useAppLanguage();
  const scanAssetLabels = getScanAssetLabels(language);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { status: gateStatus } = useOnboardingGate();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [analysisMessage, setAnalysisMessage] = React.useState<string | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [showCameraCapture, setShowCameraCapture] = React.useState(false);
  const [capturedPoses, setCapturedPoses] = React.useState<CapturedPose[]>([]);
  const [showCapturedPreview, setShowCapturedPreview] = React.useState(false);
  const [onboardingJobId, setOnboardingJobId] = React.useState<string | null>(null);
  const [isUploadingCaptures, setIsUploadingCaptures] = React.useState(false);
  const [isRetakingCaptures, setIsRetakingCaptures] = React.useState(false);
  const [capturePreviewError, setCapturePreviewError] = React.useState<string | null>(
    null,
  );
  /**
   * Une fois l'utilisateur a démarré un run depuis cette session de la page
   * (upload + POST /onboarding/complete), on le garde sur la page tant
   * qu'il n'a pas vu le résultat (succès → redirect via l'effect dédié,
   * échec → message + retry) plutôt que d'être bumpé vers `/app` parce
   * que le flag profil vient de flipper.
   */
  const [hasStartedRun, setHasStartedRun] = React.useState(false);

  /** Contenu principal de la carte d’étape (scroll interne ; le pied fixe garde les CTA dans le viewport). */
  const onboardingScrollRootRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const snapScrollToTop = () => {
      onboardingScrollRootRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    };

    snapScrollToTop();
    const raf = requestAnimationFrame(snapScrollToTop);
    return () => cancelAnimationFrame(raf);
  }, [stepIndex]);

  React.useEffect(() => {
    for (const src of ONBOARDING_PRELOAD_IMAGE_URLS) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }

    /**
     * Si l'utilisateur a démarré un run depuis CETTE page, on le laisse
     * voir l'état de progression / le message d'erreur plutôt que de le
     * bumper vers `/app` dès que le serveur a flippé
     * `has_completed_onboarding=true`. Le redirect « officiel » se fera
     * quand le job devient `completed` (effect plus bas) ou si
     * l'utilisateur recharge la page (le gate l'enverra directement sur
     * `/app`).
     */
    if (hasStartedRun) {
      return;
    }

    if (gateStatus === "ok") {
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }
  }, [gateStatus, hasStartedRun, setLocation, user]);

  const steps = React.useMemo(() => getOnboardingSteps(language), [language]);
  const currentStep = steps[stepIndex];
  const isDatingStep =
    currentStep.category === "Rencontres" || currentStep.category === "Dating";
  const isSocialStep =
    currentStep.category === "Vie sociale" || currentStep.category === "Social life";
  const isLastStep = stepIndex === steps.length - 1;
  const evidenceGridClassName = cn(
    "grid gap-3 sm:gap-4",
    currentStep.evidence.length <= 1 && "mx-auto max-w-xl grid-cols-1",
    currentStep.evidence.length === 2 && "grid-cols-1 md:grid-cols-2",
    currentStep.evidence.length === 3 && "grid-cols-1 md:grid-cols-3",
    currentStep.evidence.length >= 4 && "grid-cols-1 md:grid-cols-2",
  );

  const jobStatus = useAnalysisJobStatus(onboardingJobId, {
    enabled: Boolean(user?.id && onboardingJobId),
  });
  const jobStatusValue = jobStatus.data?.job.status;

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({ enabled: isLastStep && !!user?.id });

  const onboardingSessionId = scanStatus?.session_id;

  /**
   * Vrai dès que l'utilisateur a déclenché « Uploader les captures » : on
   * masque le CTA et on affiche l’état traitement (« Initialisation… », sans
   * chrono) pendant upload → file → jusqu’à la redirection /app où le temps
   * écoulé s’affiche (sidebar / page résultat).
   */
  const isAnalysisRunning =
    isLastStep &&
    (isUploadingCaptures ||
      isSubmitting ||
      Boolean(onboardingJobId && jobStatusValue !== "failed"));

  const showStepFooterNav = !isAnalysisRunning && !isLastStep;

  const processingMessage =
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
          : analysisMessage;

  React.useEffect(() => {
    if (jobStatusValue !== "completed" || !user?.id) {
      return;
    }

    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }, 12_000);

    void Promise.allSettled([
      queryClient.refetchQueries({ queryKey: ["profile", user.id] }),
      queryClient.refetchQueries({
        queryKey: ["latest-face-analysis", user.id],
      }),
    ]).finally(() => {
      if (cancelled) return;
      window.clearTimeout(fallbackTimer);
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [jobStatusValue, setLocation, user?.id, language]);

  React.useEffect(() => {
    if (jobStatusValue !== "failed" || !jobStatus.data?.job) {
      return;
    }
    setAnalysisMessage(
      buildAnalysisSupportMessage({
        language,
        errorCode: jobStatus.data.job.error_code,
        errorMessage: jobStatus.data.job.error_message,
      }),
    );
    setIsSubmitting(false);
    setOnboardingJobId(null);
  }, [jobStatus.data?.job, jobStatusValue, language]);

  const handleCapturedComplete = React.useCallback((poses: CapturedPose[]) => {
    setCapturePreviewError(null);
    setCapturedPoses(poses);
    setShowCameraCapture(false);
    setShowCapturedPreview(true);
  }, []);

  const handleRetakeCapturesFromPreview = React.useCallback(async () => {
    setAnalysisMessage(null);
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
  }, [language, onboardingSessionId, queryClient, user?.id]);

  const uploadAndCompleteOnboarding = React.useCallback(async () => {
    if (!user?.id || !onboardingSessionId || capturedPoses.length === 0) {
      return;
    }

    setIsUploadingCaptures(true);
    setAnalysisMessage(
      i18n(language, {
        en: "Preparing your analysis...",
        fr: "Préparation de l'analyse...",
      }),
    );
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

      setIsSubmitting(true);
      setAnalysisMessage(
        i18n(language, {
          en: "Launching analysis...",
          fr: "Lancement de l'analyse...",
        }),
      );

      const headers = { Authorization: `Bearer ${accessToken}` };
      const startResponse = await apiRequest(
        "POST",
        "/v1/onboarding/complete",
        { lang: language },
        headers,
      );
      const startPayload = (await startResponse.json()) as {
        data?: { job?: { id?: string } };
      };
      const jobId = startPayload.data?.job?.id;

      if (!jobId) {
        throw new Error(
          i18n(language, {
            en: "Analysis job not found",
            fr: "Job d'analyse introuvable",
          }),
        );
      }

      setOnboardingJobId(jobId);
      setHasStartedRun(true);

      /**
       * Le serveur a positionné `has_completed_onboarding=true` dès la
       * création/réutilisation du job. On rafraîchit en parallèle :
       * - `profile` : pour que le gate (`useOnboardingGate`) flippe en
       *   `ok` immédiatement et évite tout aller-retour vers l'écran 0
       *   au refresh ; même en cas d'échec ultérieur du worker, l'utilisateur
       *   reste considéré comme onboardé.
       * - `latest-face-analysis` : pour pré-remplir le cache de la page
       *   `/app` avec le job en cours afin que le chronomètre in-app soit
       *   cohérent dès la redirection.
       */
      await Promise.allSettled([
        queryClient.refetchQueries({ queryKey: ["profile", user.id] }),
        queryClient.refetchQueries({
          queryKey: ["latest-face-analysis", user.id],
        }),
      ]);

      /**
       * Redirection immédiate vers `/app`. La page d’arrivée affiche alors
       * la progression analyse avec chronomètre ancré sur `analysis_jobs.created_at`
       * (prefetch ci-dessus) — alors que l’onboarding montre seulement
       * « Initialisation… » sans compteur.
       */
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : i18n(language, {
              en: "Unable to start analysis right now.",
              fr: "Impossible de lancer l'analyse pour le moment.",
            }),
      );
      setIsSubmitting(false);
    } finally {
      setIsUploadingCaptures(false);
    }
  }, [capturedPoses, language, onboardingSessionId, setLocation, user?.id]);

  const openOnboardingCapture = React.useCallback(() => {
    if (!onboardingSessionId || isScanStatusLoading) return;
    setShowCameraCapture(true);
  }, [isScanStatusLoading, onboardingSessionId]);

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

  const scrollOnboardingToTop = React.useCallback(() => {
    onboardingScrollRootRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const handleNext = React.useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= steps.length - 1) return prev;
      return prev + 1;
    });
    scrollOnboardingToTop();
  }, [scrollOnboardingToTop, steps.length]);

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

      {/* Delete Account Confirmation Dialog */}
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
              gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
          >
            {steps.map((_, index) => (
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
                isLastStep && "mx-auto w-full max-w-[430px]",
              )}
            >
              {isAnalysisRunning ? (
                <div className="flex min-h-0 flex-1 flex-col justify-center py-4 sm:py-6">
                  <AnalysisProcessingState
                    message={processingMessage}
                    minimalChrome
                    theme="dark"
                    showElapsedTimer={false}
                    initializationStepTicker
                    title={i18n(language, {
                      en: "Initializing…",
                      fr: "Initialisation…",
                    })}
                  />
                </div>
              ) : isLastStep ? (
                <div className="flex min-h-0 flex-1 flex-col justify-center px-1 py-4 sm:px-2 sm:py-6">
                  <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center sm:gap-6">
                    {analysisMessage ? (
                      <div
                        className={cn(
                          saasGlassInsetClassName,
                          "w-full p-3 text-left sm:p-4",
                        )}
                      >
                        <div className="flex items-center justify-center gap-3 text-sm text-zinc-200">
                          {isSubmitting || isUploadingCaptures ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                          ) : null}
                          <span>{analysisMessage}</span>
                        </div>
                        {isSubmitting || isUploadingCaptures ? (
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-white/40" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="font-hero text-[1.35rem] font-semibold leading-[1.06] tracking-[-0.015em] text-white sm:text-[1.75rem]">
                      {i18n(language, {
                        en: "Start your first analysis",
                        fr: "Lance ta première analyse",
                      })}
                    </p>
                    {isScanStatusError ? (
                      <p className="text-sm text-red-600">
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
                          isScanStatusLoading ||
                          !onboardingSessionId ||
                          isScanStatusError
                        }
                        className={cn(
                          "flex w-full items-center justify-center gap-3 px-4 py-3 text-base transition disabled:pointer-events-none disabled:opacity-55 sm:py-3.5",
                          onboardingPrimaryCtaClassName,
                        )}
                      >
                        {isScanStatusLoading ? (
                          <span className="flex w-full items-center justify-center py-1">
                            <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    ref={onboardingScrollRootRef}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
                  >
                    <div className="min-w-0 space-y-4 sm:space-y-5">
                      {isSocialStep ? (
                        <OnboardingSocialProofShowcase language={language} />
                      ) : (
                        <div
                          className={
                            isDatingStep
                              ? "space-y-2 text-center sm:space-y-3"
                              : "space-y-3 text-center"
                          }
                        >
                          <motion.h1
                            className={
                              isDatingStep
                                ? "mx-auto max-w-[18ch] text-xl font-hero font-semibold leading-snug tracking-[-0.015em] text-white sm:text-2xl md:text-[2rem]"
                                : "mx-auto max-w-[min(100%,26ch)] text-2xl font-hero font-semibold leading-[1.08] tracking-[-0.015em] text-white sm:max-w-[28ch] sm:text-[2rem] md:text-[2.125rem]"
                            }
                          >
                            {currentStep.title}
                          </motion.h1>
                          {isDatingStep ? (
                            <OnboardingBeforeAfterComparison language={language} />
                          ) : (
                            <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-zinc-300 sm:text-base">
                              {currentStep.description}
                            </p>
                          )}
                        </div>
                      )}

                      {!isDatingStep &&
                      !isSocialStep &&
                      currentStep.evidence.length > 0 ? (
                        <div className={evidenceGridClassName}>
                          {currentStep.evidence.map((block, index) => (
                            <div
                              key={`onboarding-evidence-${index}`}
                              className={cn(
                                saasGlassInsetClassName,
                                "flex min-h-full flex-col p-3 text-left sm:p-5",
                              )}
                            >
                              <p className="text-sm font-semibold leading-relaxed text-zinc-100 sm:text-base">
                                {block.claim}
                              </p>
                              {block.source ? (
                                <p className="mt-auto pt-3 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                                  {block.source}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 space-y-3 border-t border-white/10 bg-gradient-to-t from-black/15 to-transparent pt-3 sm:space-y-4 sm:pt-4">
                    {analysisMessage ? (
                      <div className={cn(saasGlassInsetClassName, "p-3 sm:p-4")}>
                        <div className="flex items-center justify-center gap-3 text-sm text-zinc-200">
                          {isSubmitting || isUploadingCaptures ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                          ) : null}
                          <span>{analysisMessage}</span>
                        </div>
                        {isSubmitting || isUploadingCaptures ? (
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-white/40" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {showStepFooterNav ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                          disabled={stepIndex === 0 || isSubmitting}
                          className={cn(
                            "h-11 sm:h-12",
                            onboardingBackButtonClassName,
                          )}
                        >
                          {i18n(language, { en: "Back", fr: "Retour" })}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={isSubmitting}
                          className={cn(
                            "h-11 text-sm sm:h-12 sm:text-base",
                            onboardingPrimaryCtaClassName,
                          )}
                        >
                          {i18n(language, { en: "Continue", fr: "Continuer" })}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </>
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
    </div>
  );
}
