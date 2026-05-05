import { cn } from "@/lib/utils";

type BrandLoaderTone = "on-dark" | "on-light";

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
            "pointer-events-none absolute inset-0 animate-spin rounded-full border-2 duration-[1.35s] motion-reduce:animate-none",
            t.outer,
          )}
          style={{ animationTimingFunction: "cubic-bezier(0.55, 0.2, 0.35, 0.9)" }}
        />
        <span
          className={cn(
            "pointer-events-none absolute animate-spin rounded-full border duration-[2.1s] motion-reduce:animate-none",
            ringInnerMap[size],
            t.inner,
          )}
          style={{
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
};

/** Fine piste indéterminée sous le loader (DA SaaS, sans pourcentage trompeur). */
export function BrandLoaderTrack({ className, tone = "on-dark" }: BrandLoaderTrackProps) {
  const track =
    tone === "on-dark"
      ? "bg-white/[0.07]"
      : "bg-slate-200/80";
  const shimmer =
    tone === "on-dark"
      ? "bg-gradient-to-r from-transparent via-white/35 to-transparent"
      : "bg-gradient-to-r from-transparent via-slate-900/25 to-transparent";

  return (
    <div
      className={cn(
        "relative mx-auto mt-7 h-[3px] w-[min(220px,72vw)] overflow-hidden rounded-full",
        track,
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-y-0 w-[42%] animate-brand-loader-shimmer rounded-full blur-[1px]",
          shimmer,
        )}
      />
    </div>
  );
}
