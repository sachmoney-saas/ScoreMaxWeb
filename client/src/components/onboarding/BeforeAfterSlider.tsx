import * as React from "react";
import { GripVertical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

const DEFAULT_POSITION = 50;

type Props = {
  language: AppLanguage;
  beforeSrc: string | null;
  afterSrc: string | null;
  className?: string;
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function BeforeAfterSlider({
  language,
  beforeSrc,
  afterSrc,
  className,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = React.useState(false);

  const updateFromClientX = React.useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(clampPercent(pct));
  }, []);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      setIsDragging(true);
      containerRef.current?.setPointerCapture(event.pointerId);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      updateFromClientX(event.clientX);
    },
    [isDragging, updateFromClientX],
  );

  const onPointerUp = React.useCallback((event: React.PointerEvent) => {
    setIsDragging(false);
    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPosition((p) => clampPercent(p - 4));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((p) => clampPercent(p + 4));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  }, []);

  const showAfter = Boolean(afterSrc);
  const beforeLabel = i18n(language, { en: "Before", fr: "Avant" });
  const afterLabel = i18n(language, { en: "After", fr: "Après" });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-[4/5] w-full max-w-[min(100%,24rem)] select-none overflow-hidden rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)] sm:max-w-md",
        isDragging && "cursor-ew-resize",
        showAfter &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
      role={showAfter ? "slider" : "group"}
      tabIndex={showAfter ? 0 : undefined}
      aria-valuemin={showAfter ? 0 : undefined}
      aria-valuemax={showAfter ? 100 : undefined}
      aria-valuenow={showAfter ? Math.round(position) : undefined}
      aria-label={i18n(language, {
        en: "Before and after comparison — drag to compare",
        fr: "Comparaison avant / après — fais glisser pour comparer",
      })}
      onKeyDown={showAfter ? onKeyDown : undefined}
      onPointerDown={showAfter ? onPointerDown : undefined}
      onPointerMove={showAfter ? onPointerMove : undefined}
      onPointerUp={showAfter ? onPointerUp : undefined}
      onPointerCancel={showAfter ? onPointerUp : undefined}
    >
      {beforeSrc ? (
        <img
          src={beforeSrc}
          alt={i18n(language, {
            en: "Your current look",
            fr: "Ton look actuel",
          })}
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden />
        </div>
      )}

      {showAfter ? (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden={position <= 0}
        >
          <img
            src={afterSrc!}
            alt={i18n(language, {
              en: "Your AI-generated potential",
              fr: "Ton potentiel généré par IA",
            })}
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(180deg,rgba(20,28,40,0.55),rgba(10,16,22,0.75))]">
          <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white/80" aria-hidden />
          <p className="px-4 text-center text-[11px] font-medium leading-snug text-white/85 sm:text-xs">
            {i18n(language, {
              en: "Generating your potential…",
              fr: "Génération de ton potentiel…",
            })}
          </p>
        </div>
      )}

      <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
        {beforeLabel}
      </span>

      {showAfter ? (
        <>
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {afterLabel}
          </span>

          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-0"
            style={{ left: `${position}%` }}
            aria-hidden
          >
            <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.45)]" />
          </div>

          <div
            className={cn(
              "pointer-events-none absolute top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[rgba(10,16,22,0.82)] text-white shadow-[0_8px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md transition-transform sm:h-12 sm:w-12",
              isDragging && "scale-105",
            )}
            style={{ left: `${position}%` }}
            aria-hidden
          >
            <GripVertical className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
          </div>
        </>
      ) : null}
    </div>
  );
}
