import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BrandLoader,
  BrandLoaderTrack,
  HeroSkyProgressRing,
} from "@/components/ui/brand-loader";
import { analysisGlassPanelClassName } from "@/components/analysis/workers/_shared";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

const INITIALIZATION_STEPS_TICKER_MS = 5000;

/** Temps affiché pour passer linéairement de 0 % à 99 % (l’analyse reste affichée à 99 % ensuite). */
const ANALYSIS_PROGRESS_RAMP_MS = 180 * 1000; // 3 min
const ANALYSIS_PROGRESS_CAP_PERCENT = 99;

const INITIALIZATION_TICKER_MESSAGES: ReadonlyArray<{
  en: string;
  fr: string;
}> = [
  {
    fr: "Préparation des différents assets",
    en: "Preparing heterogeneous asset payloads",
  },
  {
    fr: "Agrégation des points de captures récupérés",
    en: "Aggregating sampled capture landmarks",
  },
  {
    fr: "Calibration du référentiel spatial normalisé",
    en: "Calibrating normalized spatial reference frame",
  },
  {
    fr: "Initialisation du pipeline de buffering entrant",
    en: "Spinning up inbound buffer pipeline",
  },
  {
    fr: "Alignement séquentiel des frames de poses",
    en: "Sequential alignment of pose frames",
  },
  {
    fr: "Vérification d'intégrité du lot avant fusion",
    en: "Pre-merge batch integrity verification",
  },
  {
    fr: "Synthèse des descripteurs géométriques intermédiaires",
    en: "Synthesizing intermediate geometric descriptors",
  },
  {
    fr: "Synchronisation sécurisée des canaux de transit de données",
    en: "Secure handshake on data transit channels",
  },
];

/** Références stables pour `useEffect` (évite resets du ticker si `schedule` est recréé). */
const INITIALIZATION_TICKER_SCHEDULE = {
  kind: "fixed",
  intervalMs: INITIALIZATION_STEPS_TICKER_MS,
} as const;

type AnalysisWorkerStep = Readonly<{
  worker: string;
  en: string;
  fr: string;
}>;

const IN_APP_ANALYSIS_WORKER_STEPS: ReadonlyArray<AnalysisWorkerStep> = [
  { worker: "age", fr: "Âge apparent : estimation visuelle", en: "Apparent age: visual estimate" },
  { worker: "age", fr: "Âge apparent : rétention juvénile", en: "Apparent age: juvenile retention" },
  { worker: "age", fr: "Âge apparent : maturité structurelle", en: "Apparent age: structural maturity" },
  { worker: "bodyfat", fr: "Masse grasse : niveau facial global", en: "Body fat: global facial level" },
  { worker: "bodyfat", fr: "Masse grasse : douceur du bas visage", en: "Body fat: lower-face softness" },
  { worker: "bodyfat", fr: "Masse grasse : contraste os / volume", en: "Body fat: bone-to-volume contrast" },
  { worker: "cheeks", fr: "Joues : projection malaire", en: "Cheeks: malar projection" },
  { worker: "cheeks", fr: "Joues : volume et creux", en: "Cheeks: fullness and hollows" },
  { worker: "cheeks", fr: "Joues : contour zygomatique", en: "Cheeks: zygomatic contour" },
  { worker: "chin", fr: "Menton : projection frontale", en: "Chin: frontal projection" },
  { worker: "chin", fr: "Menton : hauteur et proportion", en: "Chin: height and proportion" },
  { worker: "chin", fr: "Menton : intégration labio-mentonnière", en: "Chin: labiomental integration" },
  { worker: "coloring", fr: "Colorimétrie : contraste global", en: "Coloring: global contrast" },
  { worker: "coloring", fr: "Colorimétrie : sous-ton peau / cheveux", en: "Coloring: skin and hair undertone" },
  { worker: "coloring", fr: "Colorimétrie : harmonie du visage", en: "Coloring: facial color harmony" },
  { worker: "eye_brows", fr: "Sourcils : densité et toilettage", en: "Eyebrows: density and grooming" },
  { worker: "eye_brows", fr: "Sourcils : arche et inclinaison", en: "Eyebrows: arch and tilt" },
  { worker: "eye_brows", fr: "Sourcils : matrice masculin / subtil", en: "Eyebrows: masculine / subtle matrix" },
  { worker: "eyes", fr: "Yeux : inclinaison canthale", en: "Eyes: canthal tilt" },
  { worker: "eyes", fr: "Yeux : exposition palpébrale", en: "Eyes: eyelid exposure" },
  { worker: "eyes", fr: "Yeux : support orbitaire", en: "Eyes: orbital support" },
  { worker: "hair", fr: "Cheveux : ligne frontale", en: "Hair: hairline" },
  { worker: "hair", fr: "Cheveux : densité perçue", en: "Hair: perceived density" },
  { worker: "hair", fr: "Cheveux : cadrage du visage", en: "Hair: facial framing" },
  { worker: "jaw", fr: "Mâchoire : angle gonial", en: "Jaw: gonial angle" },
  { worker: "jaw", fr: "Mâchoire : largeur mandibulaire", en: "Jaw: mandibular width" },
  { worker: "jaw", fr: "Mâchoire : soutien du tiers inférieur", en: "Jaw: lower-third support" },
  { worker: "lips", fr: "Lèvres : volume du vermillon", en: "Lips: vermillion volume" },
  { worker: "lips", fr: "Lèvres : philtre et arc de Cupidon", en: "Lips: philtrum and Cupid's bow" },
  { worker: "lips", fr: "Lèvres : ratio haut / bas", en: "Lips: upper-to-lower ratio" },
  { worker: "neck", fr: "Cou : angle cervico-mentonnier", en: "Neck: cervicomental angle" },
  { worker: "neck", fr: "Cou : posture et largeur", en: "Neck: posture and width" },
  { worker: "neck", fr: "Cou : transition mâchoire-cou", en: "Neck: jaw-to-neck transition" },
  { worker: "nose", fr: "Nez : dos nasal et arête", en: "Nose: dorsum and bridge" },
  { worker: "nose", fr: "Nez : largeur alaire", en: "Nose: alar width" },
  { worker: "nose", fr: "Nez : projection de profil", en: "Nose: profile projection" },
  { worker: "skin", fr: "Peau : texture et pores", en: "Skin: texture and pores" },
  { worker: "skin", fr: "Peau : lissage et hydratation", en: "Skin: smoothness and hydration" },
  { worker: "skin", fr: "Peau : rougeurs et imperfections", en: "Skin: redness and blemishes" },
  { worker: "skin_tint", fr: "Teint : niveau de bronzage", en: "Skin tone: tan level" },
  { worker: "skin_tint", fr: "Teint : uniformité des zones", en: "Skin tone: zone uniformity" },
  { worker: "skin_tint", fr: "Teint : harmonie phototype", en: "Skin tone: phototype harmony" },
  { worker: "smile", fr: "Sourire : teinte dentaire", en: "Smile: tooth shade" },
  { worker: "smile", fr: "Sourire : arc et commissures", en: "Smile: arc and commissures" },
  { worker: "smile", fr: "Sourire : corridor buccal", en: "Smile: buccal corridor" },
  { worker: "symmetry_shape", fr: "Symétrie : tiers verticaux", en: "Symmetry: vertical thirds" },
  { worker: "symmetry_shape", fr: "Symétrie : forme globale du visage", en: "Symmetry: global face shape" },
  { worker: "symmetry_shape", fr: "Symétrie : équilibre gauche-droite", en: "Symmetry: left-right balance" },
] as const;

export type ProcessingTickerMessagePair = Readonly<{ en: string; fr: string }>;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function deterministicJitterWeight(index: number): number {
  const raw = Math.sin((index + 1) * 12.9898 + 78.233) * 43758.5453;
  const unit = raw - Math.floor(raw);
  return 0.86 + unit * 0.28;
}

function buildJitteredStepStartTimes(stepCount: number, totalMs: number): number[] {
  if (stepCount <= 0) return [0];
  if (stepCount === 1) return [0];
  const weights = Array.from({ length: stepCount - 1 }, (_, index) =>
    deterministicJitterWeight(index),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const startTimes = [0];
  let elapsed = 0;

  for (let index = 0; index < weights.length; index += 1) {
    elapsed += (weights[index] / totalWeight) * totalMs;
    startTimes.push(index === weights.length - 1 ? totalMs : Math.round(elapsed));
  }

  return startTimes;
}

const ANALYSIS_WORKER_STEP_START_TIMES_MS = buildJitteredStepStartTimes(
  IN_APP_ANALYSIS_WORKER_STEPS.length,
  ANALYSIS_PROGRESS_RAMP_MS,
);

function analysisWorkerStepIndexFromElapsedMs(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const lastStepIndex = IN_APP_ANALYSIS_WORKER_STEPS.length - 1;
  if (elapsedMs >= ANALYSIS_PROGRESS_RAMP_MS) return lastStepIndex;

  for (let index = 1; index < ANALYSIS_WORKER_STEP_START_TIMES_MS.length; index += 1) {
    if (elapsedMs < ANALYSIS_WORKER_STEP_START_TIMES_MS[index]) {
      return Math.max(0, index - 1);
    }
  }

  return lastStepIndex;
}

function getVisibleAnalysisStepIndices(activeStep: number, totalSteps: number): number[] {
  const visibleCount = Math.min(7, totalSteps);
  const maxStart = Math.max(0, totalSteps - visibleCount);
  const start = Math.max(0, Math.min(activeStep - 3, maxStart));
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function analysisStepOpacity(offset: number): number {
  const distance = Math.abs(offset);
  if (distance === 0) return 1;
  if (distance === 1) return offset < 0 ? 0.64 : 0.7;
  if (distance === 2) return offset < 0 ? 0.36 : 0.46;
  return offset < 0 ? 0.18 : 0.28;
}

type ProcessingStepTickerProps = {
  tone: "on-dark" | "on-light";
  messages: readonly ProcessingTickerMessagePair[];
  schedule: typeof INITIALIZATION_TICKER_SCHEDULE;
  rowKeyPrefix: string;
};

function ProcessingStepTicker({ tone, messages, schedule, rowKeyPrefix }: ProcessingStepTickerProps) {
  const language = useAppLanguage();
  const n = messages.length;

  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (n <= 0) return;

    const id = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % n);
    }, schedule.intervalMs);
    return () => window.clearInterval(id);
  }, [n, schedule]);

  const indices = React.useMemo(
    () =>
      [
        mod(activeIndex - 2, n),
        mod(activeIndex - 1, n),
        activeIndex,
      ] as const,
    [activeIndex, n],
  );

  const subtextMuted = tone === "on-dark" ? "text-zinc-500" : "text-slate-500";
  const subtextMedium = tone === "on-dark" ? "text-zinc-400" : "text-slate-600";

  const lines = indices.map((messageIndex, row) => ({
    row,
    key: `${rowKeyPrefix}-${messageIndex}`,
    text: i18n(language, messages[messageIndex]),
  }));

  return (
    <div
      className="mx-auto mt-8 w-[min(100%,20rem)] sm:mt-10"
      aria-live="polite"
      aria-atomic={false}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0.72 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex flex-col gap-2 text-left font-sans"
        >
          {lines.map(({ row, key, text }) => (
            <p
              key={key}
              className={cn(
                "min-h-[1.35em] truncate text-[0.6875rem] leading-snug tracking-tight sm:text-[0.8125rem]",
                row === 0 && cn("opacity-[0.32]", subtextMuted),
                row === 1 && cn("opacity-70", subtextMedium),
                row === 2 &&
                  cn(
                    "font-semibold tracking-[-0.01em]",
                    tone === "on-dark" ? "text-white" : "text-slate-900",
                  ),
              )}
              title={text}
              aria-current={row === 2 ? "step" : undefined}
            >
              {text}
            </p>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type NumberedAnalysisStepLoaderProps = {
  tone: "on-dark" | "on-light";
  language: AppLanguage;
  title: string;
  detailHint?: string;
  elapsedMs: number;
  showElapsedTimer?: boolean;
};

function NumberedAnalysisStepLoader({
  tone,
  language,
  title,
  detailHint,
  elapsedMs,
  showElapsedTimer = true,
}: NumberedAnalysisStepLoaderProps) {
  const activeStep = analysisWorkerStepIndexFromElapsedMs(Math.max(0, elapsedMs));
  const visibleStepIndices = getVisibleAnalysisStepIndices(
    activeStep,
    IN_APP_ANALYSIS_WORKER_STEPS.length,
  );
  const onDark = tone === "on-dark";

  const progressPercent = showElapsedTimer
    ? analysisProgressPercentFromElapsedMs(elapsedMs)
    : 0;
  const progressLabel = formatAnalysisProgressPercent(progressPercent, language);

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-[clamp(0.85rem,2.2vh,1.35rem)]">
      <div className="space-y-1 text-center">
        <h2
          className={cn(
            "font-hero text-[clamp(1.05rem,2.4vh,1.45rem)] font-semibold leading-snug tracking-[-0.02em]",
            onDark ? "text-white" : "text-slate-950",
          )}
        >
          {title}
        </h2>
        {detailHint ? (
          <p
            className={cn(
              "mx-auto max-w-[28ch] text-[clamp(0.72rem,1.5vh,0.875rem)] leading-snug",
              onDark ? "text-zinc-400" : "text-slate-500",
            )}
          >
            {detailHint}
          </p>
        ) : null}
      </div>

      <HeroSkyProgressRing
        className="mx-auto size-[clamp(5rem,13vh,7.5rem)]"
        tone={onDark ? "on-dark" : "on-light"}
      >
        {showElapsedTimer ? (
          progressLabel
        ) : (
          <Loader2
            className={cn(
              "size-[clamp(1.75rem,4.5vh,2.5rem)]",
              onDark ? "text-[#d6e4ff]" : "text-[#2d4a6f]",
            )}
            strokeWidth={2}
            aria-hidden
          />
        )}
      </HeroSkyProgressRing>

      <ul
        className={cn(
          "mx-auto w-full max-w-sm shrink-0 space-y-[clamp(0.35rem,0.9vh,0.65rem)] rounded-2xl p-[clamp(0.65rem,1.6vh,1rem)] text-left",
          onDark
            ? "border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "border border-slate-200 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        )}
        aria-label={i18n(language, {
          en: "Analysis steps",
          fr: "Étapes d'analyse",
        })}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleStepIndices.map((stepIndex) => {
            const label = IN_APP_ANALYSIS_WORKER_STEPS[stepIndex];
            const offset = stepIndex - activeStep;
            const active = offset === 0;
            const past = offset < 0;
            const upcoming = offset > 0;
            const opacity = analysisStepOpacity(offset);

            return (
              <motion.li
                key={`${label.worker}-${stepIndex}`}
                layout
                initial={{
                  opacity: 0,
                  y: upcoming ? 10 : -10,
                }}
                animate={{
                  opacity,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: past ? -12 : 12,
                }}
                transition={{
                  duration: 0.45,
                  ease: "easeOut",
                }}
                className="flex items-start gap-[clamp(0.5rem,1.1vh,0.75rem)]"
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-[clamp(1.1rem,2.2vh,1.45rem)] shrink-0 items-center justify-center rounded-full border text-[clamp(0.55rem,1.2vh,0.7rem)] font-bold tabular-nums",
                    past && "border-[#d6e4ff]/35 bg-[#d6e4ff]/10 text-[#d6e4ff]",
                    active &&
                      "border-[#d6e4ff] bg-[#d6e4ff]/25 text-[#d6e4ff] shadow-[0_0_14px_rgba(214,228,255,0.35)]",
                    upcoming &&
                      (onDark
                        ? "border-white/15 bg-white/[0.04] text-zinc-500"
                        : "border-slate-200 bg-slate-950/[0.03] text-slate-400"),
                  )}
                  aria-hidden
                >
                  {String(stepIndex + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "text-[clamp(0.75rem,1.65vh,0.9rem)] leading-snug",
                    active &&
                      (onDark
                        ? "font-medium text-[#d6e4ff]"
                        : "font-medium text-[#2d4a6f]"),
                    past && (onDark ? "text-zinc-300" : "text-slate-600"),
                    upcoming && (onDark ? "text-zinc-500" : "text-slate-400"),
                  )}
                >
                  {i18n(language, label)}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

type AnalysisProcessingStateProps = {
  /** Contexte pour lecteurs d’écran (file vs analyse, etc.). */
  message?: string | null;
  /** Variante compacte (ex. carte « Nouvelle analyse » ou onboarding). */
  minimalChrome?: boolean;
  theme?: "light" | "dark";
  /**
   * Sur le fond Wave du shell app : panneau vitré centré (comme les cartes résultats).
   */
  backdrop?: boolean;
  /**
   * Timestamp création du job (`Date.parse(job.created_at)`).
   * Si défini, le chrono suit le temps réel côté serveur (pas de reset au changement de page).
   */
  elapsedAnchorEpochMs?: number | null;
  /**
   * Affiche la progression en % (0–99 sur ~2 min 30), basée sur le temps écoulé
   * depuis `elapsedAnchorEpochMs` ou depuis le premier rendu.
   * À false : pas de pourcentage (ex. phase « Initialisation »).
   */
  showElapsedTimer?: boolean;
  /** Remplace le titre sous le loader (« Analyse en cours » par défaut). */
  title?: string | null;
  /**
   * Libellés pseudo-techniques — phase initialisation (onboarding après capture).
   */
  initializationStepTicker?: boolean;
  /** Libellés pseudo-techniques — analyse in-app (file / résultats). */
  analysisStepTicker?: boolean;
};

/** Pourcentage 0–99 : 0 % à t=0, 99 % à t=2 min 30 (puis plafonné jusqu’à la fin du job). */
export function analysisProgressPercentFromElapsedMs(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const raw = Math.floor((elapsedMs / ANALYSIS_PROGRESS_RAMP_MS) * ANALYSIS_PROGRESS_CAP_PERCENT);
  return Math.min(ANALYSIS_PROGRESS_CAP_PERCENT, raw);
}

export function formatAnalysisProgressPercent(percent: number, lang: AppLanguage): string {
  const p = Math.max(0, Math.min(ANALYSIS_PROGRESS_CAP_PERCENT, Math.floor(percent)));
  return i18n(lang, {
    fr: `${p}\u00a0%`,
    en: `${p}%`,
  });
}

/**
 * À passer à `elapsedAnchorEpochMs` pour un chrono stable (ISO `analysis_jobs.created_at`).
 */
export function analysisElapsedAnchorEpochMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function AnalysisProcessingState({
  message,
  minimalChrome = false,
  theme = "light",
  backdrop = false,
  elapsedAnchorEpochMs = null,
  showElapsedTimer = true,
  title: titleOverride = null,
  initializationStepTicker = false,
  analysisStepTicker = false,
}: AnalysisProcessingStateProps) {
  const language = useAppLanguage();
  const isDark = theme === "dark";
  const tone = backdrop || isDark ? "on-dark" : "on-light";

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!showElapsedTimer) return;
    const id = window.setInterval(() => setTick((previous) => previous + 1), 1000);
    return () => window.clearInterval(id);
  }, [showElapsedTimer]);

  const hasAnchor =
    typeof elapsedAnchorEpochMs === "number" && Number.isFinite(elapsedAnchorEpochMs);

  /**
   * Le pourcentage 0–99 est censé « partir de 0 » quand l’utilisateur voit le loader.
   * `created_at` du job est souvent *antérieur* (création en base, upload long, file)
   * — utiliser `Date.now() - created_at` affichait typiquement ~11 % dès l’ouverture.
   *
   * On conserve `elapsedAnchorEpochMs` comme identifiant de job (changement = nouveau run)
   * mais on mesure l’écoulement depuis le premier rendu où cet ancrage est actif.
   */
  const lastServerAnchorRef = React.useRef<number | null>(null);
  const uiProgressStartRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    if (!showElapsedTimer) {
      return;
    }
    if (!hasAnchor) {
      lastServerAnchorRef.current = null;
      uiProgressStartRef.current = null;
      return;
    }
    if (lastServerAnchorRef.current !== elapsedAnchorEpochMs) {
      lastServerAnchorRef.current = elapsedAnchorEpochMs;
      uiProgressStartRef.current = Date.now();
    }
  }, [elapsedAnchorEpochMs, hasAnchor, showElapsedTimer]);

  const elapsedMs = React.useMemo(() => {
    if (!showElapsedTimer) return 0;
    if (hasAnchor) {
      const start = uiProgressStartRef.current;
      if (start == null) return 0;
      return Math.max(0, Date.now() - start);
    }
    return tick * 1000;
  }, [elapsedAnchorEpochMs, hasAnchor, showElapsedTimer, tick]);

  const progressPercent = analysisProgressPercentFromElapsedMs(elapsedMs);
  const progressLabel = formatAnalysisProgressPercent(progressPercent, language);

  const titleLabel =
    titleOverride?.trim() ||
    i18n(language, {
      fr: "Analyse en cours",
      en: "Analysis in progress",
    });

  const detailHint = message?.trim();
  const ariaLabel = showElapsedTimer
    ? [titleLabel, detailHint, progressLabel].filter(Boolean).join(" — ")
    : [titleLabel, detailHint].filter(Boolean).join(" — ");

  const loaderSize = backdrop ? "lg" : minimalChrome ? "md" : "lg";
  const trackGap = "mt-7";

  /**
   * `minimalChrome` = pas de panneau intérieur (le parent fournit déjà la box).
   * Évite la « double box » dans Onboarding / NewAnalysis qui rendent le loader
   * dans une carte vitrée.
   */
  const panelClass = minimalChrome
    ? cn(
        "mx-auto flex w-full flex-col items-center px-4 py-6 sm:px-6 sm:py-8",
        tone === "on-dark" ? "text-zinc-50" : "text-slate-900",
      )
    : cn(
        "mx-auto flex w-full max-w-[min(100%,22rem)] flex-col items-center rounded-[2rem] px-8 py-10 sm:max-w-md sm:px-10 sm:py-11",
        tone === "on-dark"
          ? cn(analysisGlassPanelClassName, "text-zinc-50")
          : "border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-md",
      );

  const outerClass = "flex w-full flex-col items-center justify-center px-2 py-2 text-center sm:px-3";

  if (analysisStepTicker) {
    return (
      <div className={outerClass}>
        <div className={panelClass}>
          <NumberedAnalysisStepLoader
            tone={tone}
            language={language}
            title={titleLabel}
            detailHint={detailHint}
            elapsedMs={elapsedMs}
            showElapsedTimer={showElapsedTimer}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={outerClass}>
      <div className={panelClass}>
        <BrandLoader
          label={ariaLabel}
          tone={tone}
          size={loaderSize}
          className={cn(
            tone === "on-dark"
              ? "drop-shadow-[0_8px_28px_rgba(0,0,0,0.38)]"
              : "drop-shadow-[0_12px_28px_rgba(0,0,0,0.14)]",
          )}
        />

        <h2
          className={cn(
            "mt-7 font-display text-lg font-semibold tracking-tight sm:text-xl",
            tone === "on-dark" ? "text-white" : "text-slate-900",
          )}
        >
          {titleLabel}
        </h2>

        {showElapsedTimer ? (
          <p
            className={cn(
              "mt-2 text-sm tabular-nums tracking-tight",
              tone === "on-dark" ? "text-zinc-400" : "text-slate-500",
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {progressLabel}
          </p>
        ) : null}

        <BrandLoaderTrack
          tone={tone}
          className={cn(trackGap, "w-[min(240px,85%)]")}
          progressPercent={showElapsedTimer ? progressPercent : undefined}
        />

        {initializationStepTicker ? (
          <ProcessingStepTicker
            tone={tone}
            messages={INITIALIZATION_TICKER_MESSAGES}
            schedule={INITIALIZATION_TICKER_SCHEDULE}
            rowKeyPrefix="init-step"
          />
        ) : null}
      </div>
    </div>
  );
}
