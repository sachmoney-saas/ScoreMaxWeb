import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { analysisGlassPanelClassName } from "@/components/analysis/workers/_shared";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

const INITIALIZATION_STEPS_TICKER_MS = 5000;

/** Temps affiché pour passer linéairement de 0 % à 99 % (l’analyse reste affichée à 99 % ensuite). */
const ANALYSIS_PROGRESS_RAMP_MS = 150 * 1000; // 2 min 30
const ANALYSIS_PROGRESS_CAP_PERCENT = 99;

/** Entre deux messages du ticker analyse in-app (~2 min avec ~27 lignes). */
const ANALYSIS_STEPS_RANDOM_MS_MIN = 5000;
const ANALYSIS_STEPS_RANDOM_MS_MAX = 10_000;

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

const ANALYSIS_TICKER_SCHEDULE = {
  kind: "random",
  minMs: ANALYSIS_STEPS_RANDOM_MS_MIN,
  maxMs: ANALYSIS_STEPS_RANDOM_MS_MAX,
} as const;

const ANALYSIS_TICKER_MESSAGES: ReadonlyArray<{ en: string; fr: string }> = [
  { fr: "Harmonisation gauche-droite du visage.", en: "Left–right facial harmonisation." },
  { fr: "Lecture des tiers verticaux.", en: "Reading vertical facial thirds." },
  {
    fr: "Mesure du rythme des cinquièmes sous les yeux.",
    en: "Measuring horizontal fifths under the eyes.",
  },
  {
    fr: "Analyse orbitaire et blanc scléral.",
    en: "Orbital landmarks and scleral exposure.",
  },
  { fr: "Courbes et densité des sourcils.", en: "Brow shape and fullness." },
  {
    fr: "Profil du dos du nez et symétrie des narines.",
    en: "Nasal dorsum profile and nostril symmetry.",
  },
  { fr: "Philtre, sillons et volume des lèvres.", en: "Philtrum, folds and lip volume." },
  { fr: "Volume et courbure des pommettes.", en: "Cheek volume and curvature." },
  { fr: "Plan du menton et ligne mandibulaire.", en: "Chin plane and jawline contour." },
  {
    fr: "Angle de la mâchoire et relief latéral.",
    en: "Gonial angle and lateral jaw relief.",
  },
  { fr: "Transition mâchoire–cou.", en: "Jaw-to-neck transition." },
  {
    fr: "Arc du sourire et équilibre des commissures.",
    en: "Smile arc and commissure balance.",
  },
  {
    fr: "Ligne frontale et densité des cheveux.",
    en: "Hairline and perceived hair density.",
  },
  {
    fr: "Contraste cheveux / peau aux tempes.",
    en: "Hair-to-skin contrast at the temples.",
  },
  { fr: "Peau : homogénéité et micro-texture.", en: "Skin evenness and micro-texture." },
  {
    fr: "Teint : zones front / joues / nez.",
    en: "Tone balance across forehead, cheeks and nose.",
  },
  { fr: "Rougeurs et micro-contrastes cutanés.", en: "Redness and subtle skin contrasts." },
  {
    fr: "Brillances et pores en lumière normée.",
    en: "Shine and pore structure under normed light.",
  },
  {
    fr: "Croisement des vues frontale et trois-quarts.",
    en: "Cross-checking frontal and three-quarter views.",
  },
  {
    fr: "Recoupement des poses pour plus de stabilité.",
    en: "Cross-validating poses for stability.",
  },
  {
    fr: "Points de repère sur la zone péri-orbitaire.",
    en: "Anchoring peri-orbital reference points.",
  },
  {
    fr: "Carte fine du nez : ombres et jonctions.",
    en: "Fine nasal map — shadows and transitions.",
  },
  {
    fr: "Géométrie du vermillon et du cupidon.",
    en: "Vermillion contour and Cupid's bow geometry.",
  },
  { fr: "Indices de forme faciale globale.", en: "Global facial shape cues." },
  { fr: "Calage sur le score global sur 100.", en: "Locking onto the score out of 100." },
  { fr: "Pondération des scores par zone.", en: "Weighted scoring by facial zone." },
  {
    fr: "Préparation des textes et repères visuels.",
    en: "Preparing captions and visual callouts.",
  },
];

const IN_APP_ANALYSIS_GEOMETRY_STEPS: ReadonlyArray<{ en: string; fr: string }> = [
  {
    en: "Uploading captured poses",
    fr: "Envoi des poses capturées",
  },
  {
    en: "Mapping facial landmarks",
    fr: "Cartographie des repères faciaux",
  },
  {
    en: "Stabilizing pose & lighting",
    fr: "Stabilisation pose et lumière",
  },
  {
    en: "Segmenting facial features",
    fr: "Segmentation des traits du visage",
  },
  {
    en: "Calculating facial proportions",
    fr: "Calcul des proportions du visage",
  },
  {
    en: "Measuring symmetry",
    fr: "Mesure de la symétrie",
  },
  {
    en: "Running worker evaluations",
    fr: "Évaluation des zones du visage",
  },
  {
    en: "Scoring confidence",
    fr: "Score de confiance des mesures",
  },
  {
    en: "Generating insights",
    fr: "Génération des résultats",
  },
] as const;

export type ProcessingTickerMessagePair = Readonly<{ en: string; fr: string }>;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

type ProcessingStepTickerProps = {
  tone: "on-dark" | "on-light";
  messages: readonly ProcessingTickerMessagePair[];
  schedule:
    | typeof INITIALIZATION_TICKER_SCHEDULE
    | typeof ANALYSIS_TICKER_SCHEDULE;
  rowKeyPrefix: string;
};

function ProcessingStepTicker({ tone, messages, schedule, rowKeyPrefix }: ProcessingStepTickerProps) {
  const language = useAppLanguage();
  const n = messages.length;

  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (n <= 0) return;

    if (schedule.kind === "fixed") {
      const id = window.setInterval(() => {
        setActiveIndex((previous) => (previous + 1) % n);
      }, schedule.intervalMs);
      return () => window.clearInterval(id);
    }

    let cancelled = false;
    let timeoutId = 0;

    const bump = () => {
      setActiveIndex((previous) => (previous + 1) % n);
      scheduleNext();
    };

    const scheduleNext = () => {
      const span = Math.max(0, schedule.maxMs - schedule.minMs);
      const delay =
        schedule.minMs + (span > 0 ? Math.floor(Math.random() * (span + 1)) : 0);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        bump();
      }, delay);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
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
  const activeStep = Math.min(
    IN_APP_ANALYSIS_GEOMETRY_STEPS.length - 1,
    Math.floor(Math.max(0, elapsedMs) / 12_000),
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

      <div className="relative mx-auto flex size-[clamp(5rem,13vh,7.5rem)] shrink-0 items-center justify-center">
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2",
            onDark ? "border-white/10" : "border-slate-950/10",
          )}
          aria-hidden
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-r-sky-400/50 border-t-sky-400"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.15,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          aria-hidden
        />
        <Loader2
          className="size-[clamp(1.75rem,4.5vh,2.5rem)] text-sky-400/90"
          strokeWidth={2}
          aria-hidden
        />
      </div>

      {showElapsedTimer ? (
        <p
          className={cn(
            "text-sm tabular-nums tracking-tight",
            onDark ? "text-zinc-400" : "text-slate-500",
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {progressLabel}
        </p>
      ) : null}

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
        {IN_APP_ANALYSIS_GEOMETRY_STEPS.map((label, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <li
              key={label.en}
              className="flex items-start gap-[clamp(0.5rem,1.1vh,0.75rem)]"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-[clamp(1.1rem,2.2vh,1.45rem)] shrink-0 items-center justify-center rounded-full border text-[clamp(0.55rem,1.2vh,0.7rem)] font-bold tabular-nums",
                  done && "border-sky-400/60 bg-sky-400/20 text-sky-200",
                  active &&
                    "border-sky-400 bg-sky-400/25 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.35)]",
                  !done &&
                    !active &&
                    (onDark
                      ? "border-white/15 bg-white/[0.04] text-zinc-500"
                      : "border-slate-200 bg-slate-950/[0.03] text-slate-400"),
                )}
                aria-hidden
              >
                {done ? <Check className="size-[0.8em]" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[clamp(0.75rem,1.65vh,0.9rem)] leading-snug",
                  active && (onDark ? "font-medium text-white" : "font-medium text-slate-950"),
                  done && (onDark ? "text-zinc-300" : "text-slate-600"),
                  !done && !active && (onDark ? "text-zinc-500" : "text-slate-400"),
                )}
              >
                {i18n(language, label)}
              </span>
            </li>
          );
        })}
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

  const elapsedMs = React.useMemo(() => {
    if (!showElapsedTimer) return 0;
    if (hasAnchor) {
      return Math.max(0, Date.now() - elapsedAnchorEpochMs);
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
        {!initializationStepTicker && analysisStepTicker ? (
          <ProcessingStepTicker
            tone={tone}
            messages={ANALYSIS_TICKER_MESSAGES}
            schedule={ANALYSIS_TICKER_SCHEDULE}
            rowKeyPrefix="analysis-step"
          />
        ) : null}
      </div>
    </div>
  );
}
