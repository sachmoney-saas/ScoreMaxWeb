import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const GEOMETRY_STEPS: readonly { en: string; fr: string }[] = [
  {
    en: "Mapping facial landmarks",
    fr: "Cartographie des repères faciaux",
  },
  {
    en: "Calculating proportions",
    fr: "Calcul des proportions",
  },
  {
    en: "Measuring symmetry",
    fr: "Mesure de la symétrie",
  },
  {
    en: "Generating insights",
    fr: "Génération des indicateurs",
  },
] as const;

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
};

/** Loader style « géométrie faciale » — fond glass / DA onboarding (pas de noir plein écran). */
export function OnboardingFacialGeometryLoader({ language }: GeometryProps) {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (step >= GEOMETRY_STEPS.length - 1) return;
    const id = window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, GEOMETRY_STEPS.length - 1));
    }, 680);
    return () => window.clearTimeout(id);
  }, [step]);

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <h2 className="font-hero shrink-0 text-center text-[1.2rem] font-semibold leading-snug tracking-[-0.02em] text-white sm:text-[1.4rem]">
        {i18n(language, {
          en: "Analyzing facial geometry",
          fr: "Analyse de la géométrie du visage",
        })}
      </h2>

      <div className="relative mx-auto mt-8 flex size-36 shrink-0 items-center justify-center sm:mt-10 sm:size-44">
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
        <div className="flex size-[4.5rem] items-center justify-center sm:size-[5rem]">
          <Loader2
            className="size-10 text-sky-400/90 sm:size-11"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      </div>

      <ul
        className={cn(
          "mx-auto mt-8 w-full max-w-sm space-y-3 text-left sm:mt-10",
          saasGlassInsetClassName,
          "rounded-2xl p-4 sm:p-5",
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
            <li key={label.en} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
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
                  "text-sm leading-snug sm:text-[0.9375rem]",
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
