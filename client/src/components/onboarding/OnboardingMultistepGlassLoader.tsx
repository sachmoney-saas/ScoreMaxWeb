import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";

export type OnboardingLoaderI18n = { en: string; fr: string };

type Props = {
  language: AppLanguage;
  steps: readonly OnboardingLoaderI18n[];
  className?: string;
  /** Réinitialise l’étape à 0 quand la valeur change (ex. envoi scan vs chargement session). */
  cycleResetKey?: string | number;
  /** Délai entre deux étapes (ms). */
  stepIntervalMs?: number;
};

/**
 * Loader glass multi-étapes : libellés qui avancent puis restent sur la dernière étape
 * tant que le parent reste monté (upload / chargement long).
 */
export function OnboardingMultistepGlassLoader({
  language,
  steps,
  className,
  cycleResetKey,
  stepIntervalMs = 1800,
}: Props) {
  const n = steps.length;
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [cycleResetKey]);

  React.useEffect(() => {
    if (n <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i < n - 1 ? i + 1 : i));
    }, stepIntervalMs);
    return () => window.clearInterval(id);
  }, [n, stepIntervalMs]);

  const safeIndex = Math.min(activeIndex, Math.max(0, n - 1));
  const message = n > 0 ? i18n(language, steps[safeIndex]!) : "";
  const progressPct = n > 0 ? ((safeIndex + 1) / n) * 100 : 0;

  return (
    <div
      className={cn(
        saasGlassInsetClassName,
        "w-full p-3 text-left sm:p-4",
        className,
      )}
    >
      {n > 1 ? (
        <div
          className="mb-3 flex gap-1.5"
          role="group"
          aria-label={i18n(language, {
            en: "Loading steps",
            fr: "Étapes de chargement",
          })}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= safeIndex ? "bg-white/90" : "bg-white/15",
              )}
              aria-hidden
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-start gap-3 text-sm text-zinc-200">
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-zinc-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${cycleResetKey ?? "default"}-${safeIndex}`}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="leading-snug"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-white/45"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-brand-loader-shimmer motion-reduce:hidden"
          aria-hidden
        />
      </div>
    </div>
  );
}
