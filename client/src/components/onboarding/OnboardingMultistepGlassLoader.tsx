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
  /** `featured` : une barre, texte centré — teaser potentiel. */
  variant?: "default" | "featured";
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
  variant = "default",
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
  const progressRounded = Math.min(100, Math.max(0, Math.round(progressPct)));
  const progressLabel = i18n(language, {
    fr: `${progressRounded}\u00a0%`,
    en: `${progressRounded}%`,
  });
  const isFeatured = variant === "featured";

  return (
    <motion.div
      className={cn(
        saasGlassInsetClassName,
        "w-full",
        isFeatured ? "px-5 py-6 text-center sm:px-6 sm:py-7" : "p-3 text-left sm:p-4",
        className,
      )}
    >
      {n > 1 && !isFeatured ? (
        <motion.div
          className="mb-3 flex gap-1.5"
          role="group"
          aria-label={i18n(language, {
            en: "Loading steps",
            fr: "Étapes de chargement",
          })}
        >
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= safeIndex ? "bg-white/90" : "bg-white/15",
              )}
              aria-hidden
            />
          ))}
        </motion.div>
      ) : null}

      <motion.div
        className={cn(
          "flex gap-3 text-sm text-zinc-200",
          isFeatured ? "flex-col items-center" : "items-start",
        )}
      >
        <Loader2
          className={cn(
            "shrink-0 animate-spin",
            isFeatured ? "h-6 w-6 text-sky-400" : "mt-0.5 h-4 w-4 text-zinc-400",
          )}
          aria-hidden
        />
        <motion.div className={cn("min-w-0", isFeatured ? "w-full" : "flex-1")}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${cycleResetKey ?? "default"}-${safeIndex}`}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "leading-snug",
                isFeatured && "text-base font-medium text-white sm:text-lg",
              )}
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <div
        className={cn(
          "flex items-center gap-3",
          isFeatured
            ? "mx-auto mt-5 w-full max-w-xs justify-center"
            : "mt-3 justify-start",
        )}
      >
        <span
          className={cn(
            "tabular-nums tracking-tight",
            isFeatured
              ? "text-sm font-semibold text-white/90"
              : "text-xs font-medium text-zinc-400",
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {progressLabel}
        </span>
      </div>

      <motion.div
        className={cn(
          "relative overflow-hidden rounded-full bg-white/10",
          isFeatured ? "mx-auto mt-2 h-2 w-full max-w-xs" : "mt-1.5 h-1.5",
        )}
      >
        <motion.div
          className={cn(
            "h-full rounded-full",
            isFeatured
              ? "bg-gradient-to-r from-sky-500/80 via-sky-300/90 to-sky-400/80"
              : "bg-white/45",
          )}
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-brand-loader-shimmer motion-reduce:hidden"
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}
