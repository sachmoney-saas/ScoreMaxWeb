import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type BrandLoaderTone = "on-dark" | "on-light";

/** Bleu ciel du titre hero — loaders circulaires, étapes actives. */
export const SCOREMAX_HERO_SKY = "#d6e4ff";

type HeroSkyProgressRingProps = {
  className?: string;
  tone?: BrandLoaderTone;
  children?: React.ReactNode;
};

/** Anneau qui tourne (arc seul, sans piste fixe) avec contenu centré. */
export function HeroSkyProgressRing({
  className,
  tone = "on-dark",
  children,
}: HeroSkyProgressRingProps) {
  const labelClass = tone === "on-dark" ? "text-[#d6e4ff]" : "text-[#2d4a6f]";

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", className)}>
      <motion.div
        className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#d6e4ff] border-r-[#d6e4ff]/50"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.15,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
        aria-hidden
      />
      {children ? (
        <div
          className={cn(
            "relative z-[1] flex size-full items-center justify-center text-center text-[clamp(0.8125rem,2vh,1.0625rem)] font-semibold tabular-nums tracking-tight",
            labelClass,
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type BrandLoaderProps = {
  className?: string;
  /** Libellé vocal / lecteurs d’écran uniquement (pas de texte visible). */
  label?: string;
  tone?: BrandLoaderTone;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "size-10",
  md: "size-[3.25rem]",
  lg: "size-16",
} as const;

const ringInnerMap = {
  sm: "inset-[5px]",
  md: "inset-[7px]",
  lg: "inset-[9px]",
} as const;

const toneClasses: Record<
  BrandLoaderTone,
  { outer: string; inner: string; core: string; glow: string }
> = {
  "on-dark": {
    outer: "border-white/[0.14] border-t-white/[0.92]",
    inner: "border-white/[0.08] border-b-white/[0.35]",
    core: "bg-white shadow-[0_0_20px_rgba(255,255,255,0.35)]",
    glow: "bg-[radial-gradient(circle,rgba(255,255,255,0.28)_0%,transparent_68%)]",
  },
  "on-light": {
    outer: "border-slate-200/90 border-t-slate-950",
    inner: "border-slate-200/70 border-b-slate-400",
    core: "bg-slate-950 shadow-[0_0_16px_rgba(15,23,42,0.22)]",
    glow: "bg-[radial-gradient(circle,rgba(15,23,42,0.12)_0%,transparent_68%)]",
  },
};

/**
 * Indicateur de chargement visuel — pas de texte visible ; DA alignée glass / métal ScoreMax.
 */
export function BrandLoader({
  className,
  label = "Chargement",
  tone = "on-dark",
  size = "md",
}: BrandLoaderProps) {
  const t = toneClasses[tone];

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("relative inline-flex items-center justify-center", className)}
    >
      <span className="sr-only">{label}</span>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          sizeMap[size],
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-0 animate-spin rounded-full border-2 motion-reduce:animate-none",
            t.outer,
          )}
          style={{
            animationDuration: "1.35s",
            animationTimingFunction: "cubic-bezier(0.55, 0.2, 0.35, 0.9)",
          }}
        />
        <span
          className={cn(
            "pointer-events-none absolute animate-spin rounded-full border motion-reduce:animate-none",
            ringInnerMap[size],
            t.inner,
          )}
          style={{
            animationDuration: "2.1s",
            animationDirection: "reverse",
            animationTimingFunction: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
          }}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 scale-110 rounded-full opacity-70 blur-md motion-reduce:opacity-40",
            t.glow,
          )}
        />
        <span
          className={cn(
            "relative z-[1] size-2 shrink-0 rounded-full motion-safe:animate-[pulse_2s_ease-in-out_infinite]",
            t.core,
          )}
        />
      </div>
    </div>
  );
}

type BrandLoaderTrackProps = {
  className?: string;
  tone?: BrandLoaderTone;
  /**
   * 0–100 : remplissage proportionnel (synchronisé avec le % affiché à l’écran).
   * Sans valeur : animation indéterminée (shimmer).
   */
  progressPercent?: number;
};

export function BrandLoaderTrack({
  className,
  tone = "on-dark",
  progressPercent,
}: BrandLoaderTrackProps) {
  const track =
    tone === "on-dark"
      ? "bg-white/[0.07]"
      : "bg-slate-200/80";
  const shimmer =
    tone === "on-dark"
      ? "bg-gradient-to-r from-transparent via-white/35 to-transparent"
      : "bg-gradient-to-r from-transparent via-slate-900/25 to-transparent";
  const fill =
    tone === "on-dark"
      ? "bg-gradient-to-r from-[#d6e4ff]/75 via-[#d6e4ff]/95 to-[#d6e4ff]/80"
      : "bg-gradient-to-r from-slate-800/80 via-slate-600/90 to-slate-800/80";

  const pct =
    typeof progressPercent === "number" && Number.isFinite(progressPercent)
      ? Math.max(0, Math.min(100, progressPercent))
      : null;

  return (
    <div
      className={cn(
        "relative mx-auto mt-7 h-[3px] w-[min(220px,72vw)] overflow-hidden rounded-full",
        track,
        className,
      )}
      role={pct !== null ? "progressbar" : undefined}
      aria-valuemin={pct !== null ? 0 : undefined}
      aria-valuemax={pct !== null ? 100 : undefined}
      aria-valuenow={pct !== null ? Math.round(pct) : undefined}
      aria-hidden={pct === null ? true : undefined}
    >
      {pct !== null ? (
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            fill,
          )}
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-y-0 w-[42%] animate-brand-loader-shimmer rounded-full blur-[1px]",
            shimmer,
          )}
        />
      )}
    </div>
  );
}
