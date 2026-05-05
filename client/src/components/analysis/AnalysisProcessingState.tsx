import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { analysisGlassPanelClassName } from "@/components/analysis/workers/_shared";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

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
};

/** Format « 42 s » / « 3 min 12 s » pour sidebar et écran d’analyse. */
export function formatAnalysisElapsedLabel(totalSeconds: number, lang: AppLanguage): string {
  if (totalSeconds < 60) {
    return i18n(lang, {
      fr: `${totalSeconds} s`,
      en: `${totalSeconds} s`,
    });
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return i18n(lang, {
    fr: `${minutes} min ${seconds} s`,
    en: `${minutes} min ${seconds} s`,
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
}: AnalysisProcessingStateProps) {
  const language = useAppLanguage();
  const isDark = theme === "dark";
  const tone = backdrop || isDark ? "on-dark" : "on-light";

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((previous) => previous + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hasAnchor =
    typeof elapsedAnchorEpochMs === "number" && Number.isFinite(elapsedAnchorEpochMs);

  const elapsedSeconds = React.useMemo(() => {
    if (hasAnchor) {
      return Math.max(0, Math.floor((Date.now() - elapsedAnchorEpochMs) / 1000));
    }
    return tick;
  }, [elapsedAnchorEpochMs, hasAnchor, tick]);

  const titleLabel = i18n(language, {
    fr: "Analyse en cours",
    en: "Analysis in progress",
  });

  const elapsedLabel = formatAnalysisElapsedLabel(elapsedSeconds, language);
  const detailHint = message?.trim();
  const ariaLabel = [titleLabel, detailHint, elapsedLabel].filter(Boolean).join(" — ");

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

        <p
          className={cn(
            "mt-2 text-sm tabular-nums tracking-tight",
            tone === "on-dark" ? "text-zinc-400" : "text-slate-500",
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {elapsedLabel}
        </p>

        <BrandLoaderTrack tone={tone} className={cn(trackGap, "w-[min(240px,85%)]")} />
      </div>
    </div>
  );
}
