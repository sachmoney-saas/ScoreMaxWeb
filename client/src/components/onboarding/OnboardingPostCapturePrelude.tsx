import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Durée cible pour franchir les 8 premières étapes (index 0→8) ; le reste du temps reste sur la dernière. */
const GEOMETRY_NOMINAL_PHASE_MS = 60_000;
const GEOMETRY_STEP_MIN_INTERVAL_MS = 1_800;
const GEOMETRY_FAST_STEP_MS = 140;
const GEOMETRY_EXIT_HOLD_MS = 260;

const GEOMETRY_STEPS: readonly { en: string; fr: string }[] = [
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
    en: "Calculating proportions",
    fr: "Calcul des proportions",
  },
  {
    en: "Mapping facial thirds & ratios",
    fr: "Tiers et ratios du visage",
  },
  {
    en: "Measuring symmetry",
    fr: "Mesure de la symétrie",
  },
  {
    en: "Fusing multi-angle views",
    fr: "Fusion des vues multi-angles",
  },
  {
    en: "Scoring landmark confidence",
    fr: "Score de confiance des repères",
  },
  {
    en: "Generating insights",
    fr: "Génération des indicateurs",
  },
] as const;

function buildEightRandomIntervals(totalMs: number, minEach: number): number[] {
  const n = 8;
  const minTotal = minEach * n;
  if (totalMs < minTotal) {
    return Array.from({ length: n }, () => Math.floor(totalMs / n));
  }
  const slack = totalMs - minTotal;
  const raw = Array.from({ length: n }, () => Math.random());
  const sum = raw.reduce((a, b) => a + b, 0);
  const intervals = raw.map((r) => minEach + Math.floor((r / sum) * slack));
  let deficit = totalMs - intervals.reduce((a, b) => a + b, 0);
  let i = 0;
  while (deficit > 0) {
    intervals[i % n] += 1;
    deficit -= 1;
    i += 1;
  }
  return intervals;
}

type SplashProps = {
  language: AppLanguage;
};

/** Écran ~3s : coche dans un rond bleu DA, avant le hero 3D. */
export function OnboardingScanCompleteSplash({ language }: SplashProps) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div
        className={cn(
          "flex size-[4.5rem] items-center justify-center rounded-full sm:size-[5.25rem]",
          "bg-sky-400 shadow-[0_12px_40px_-12px_rgba(56,189,248,0.75)] ring-4 ring-sky-400/25",
        )}
      >
        <Check
          className="size-[2.35rem] text-slate-950 sm:size-[2.65rem]"
          strokeWidth={3.25}
          aria-hidden
        />
      </div>
      <h2 className="font-hero mt-6 max-w-[20ch] text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:mt-7 sm:text-[1.65rem]">
        {i18n(language, {
          en: "Scan Complete!",
          fr: "Scan terminé !",
        })}
      </h2>
      <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-zinc-300 sm:text-base">
        {i18n(language, {
          en: "Your face has been successfully scanned.",
          fr: "Ton visage a bien été scanné.",
        })}
      </p>
    </motion.div>
  );
}

type GeometryProps = {
  language: AppLanguage;
  /** Quand la génération d’image est prête / a échoué / timeout — le loader accélère puis appelle `onExitComplete`. */
  workCompleteSignal: boolean;
  onExitComplete: () => void;
};

/** Loader style « géométrie faciale » — fond glass / DA onboarding (pas de noir plein écran). */
export function OnboardingFacialGeometryLoader({
  language,
  workCompleteSignal,
  onExitComplete,
}: GeometryProps) {
  const [step, setStep] = React.useState(0);
  const stepDelays = React.useMemo(
    () =>
      buildEightRandomIntervals(
        GEOMETRY_NOMINAL_PHASE_MS,
        GEOMETRY_STEP_MIN_INTERVAL_MS,
      ),
    [],
  );
  const lastIndex = GEOMETRY_STEPS.length - 1;
  const didExitRef = React.useRef(false);

  React.useEffect(() => {
    if (step >= lastIndex) return;

    const delay = workCompleteSignal
      ? GEOMETRY_FAST_STEP_MS
      : (stepDelays[step] ?? 2_000);

    const id = window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, lastIndex));
    }, delay);
    return () => window.clearTimeout(id);
  }, [step, stepDelays, lastIndex, workCompleteSignal]);

  React.useEffect(() => {
    if (!workCompleteSignal || step !== lastIndex || didExitRef.current) {
      return;
    }
    const id = window.setTimeout(() => {
      didExitRef.current = true;
      onExitComplete();
    }, GEOMETRY_EXIT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [workCompleteSignal, step, lastIndex, onExitComplete]);

  return (
    <motion.div
      // Tailles 100% fluides (vh-based) + `overflow-hidden` : le contenu
      // s'adapte à la hauteur disponible du panneau onboarding, jamais de
      // scrollbar. Le `gap` remplace les marges entre les blocs pour que
      // l'écart se compresse uniformément quand la fenêtre se rétrécit.
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.75rem,2.5vh,2rem)] overflow-hidden px-4 py-[clamp(0.75rem,2vh,1.75rem)] sm:px-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <h2 className="font-hero shrink-0 text-center text-[clamp(1rem,2.4vh,1.4rem)] font-semibold leading-snug tracking-[-0.02em] text-white">
        {i18n(language, {
          en: "Analyzing facial geometry",
          fr: "Analyse de la géométrie du visage",
        })}
      </h2>

      <div className="relative mx-auto flex size-[clamp(5rem,14vh,11rem)] shrink-0 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-white/10"
          aria-hidden
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 border-r-sky-400/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          aria-hidden
        />
        <Loader2
          className="size-[clamp(1.75rem,4.5vh,2.75rem)] text-sky-400/90"
          strokeWidth={2}
          aria-hidden
        />
      </div>

      <ul
        className={cn(
          "mx-auto w-full max-w-sm shrink-0 space-y-[clamp(0.35rem,1vh,0.75rem)] text-left",
          saasGlassInsetClassName,
          "rounded-2xl p-[clamp(0.6rem,1.6vh,1.25rem)]",
        )}
        aria-label={i18n(language, {
          en: "Analysis steps",
          fr: "Étapes d’analyse",
        })}
      >
        {GEOMETRY_STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li
              key={label.en}
              className="flex items-start gap-[clamp(0.5rem,1.1vh,0.75rem)]"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-[clamp(1.1rem,2.2vh,1.5rem)] shrink-0 items-center justify-center rounded-full border text-[clamp(0.55rem,1.2vh,0.7rem)] font-bold tabular-nums",
                  done && "border-sky-400/60 bg-sky-400/20 text-sky-200",
                  active &&
                    "border-sky-400 bg-sky-400/25 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.35)]",
                  !done &&
                    !active &&
                    "border-white/15 bg-white/[0.04] text-zinc-500",
                )}
                aria-hidden
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-[clamp(0.75rem,1.7vh,0.9375rem)] leading-snug",
                  active && "font-medium text-white",
                  done && "text-zinc-300",
                  !done && !active && "text-zinc-500",
                )}
              >
                {i18n(language, label)}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
