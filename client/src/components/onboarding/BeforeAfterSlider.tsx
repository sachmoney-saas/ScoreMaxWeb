import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

const DEFAULT_POSITION = 50;

/**
 * Même empreinte que le slider pour l'écran de chargement du potentiel
 * (évite le saut de layout). Les `max-h` sont fluides en `vh` pour laisser
 * la place au titre, au bloc « What this means » et au CTA Continuer sans
 * provoquer de scroll.
 */
export const beforeAfterMediaFrameClassName =
  "relative aspect-[4/5] w-full max-w-[min(100%,21rem)] max-h-[min(28vh,15.5rem)] overflow-visible rounded-xl border border-white/15 bg-black/25 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.7)] sm:max-h-[min(32vh,17.5rem)] sm:max-w-[min(100%,23rem)] md:max-h-[min(36vh,19.5rem)] md:max-w-[min(100%,24rem)]";

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
      event.preventDefault();
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
  const beforeLabel = i18n(language, {
    en: "CURRENTLY",
    fr: "ACTUELLEMENT",
  });
  const afterLabelLine1 = i18n(language, {
    en: "AFTER 12",
    fr: "APRÈS 12",
  });
  const afterLabelLine2 = i18n(language, {
    en: "FIRST WEEKS",
    fr: "PREMIÈRES SEMAINES",
  });
  const afterLabelAria = i18n(language, {
    en: "After the first 12 weeks",
    fr: "Après 12 premières semaines",
  });

  const pillClass =
    "rounded-md bg-black/50 px-2 py-1 text-[8px] font-semibold uppercase leading-snug tracking-wider text-white/90 backdrop-blur-sm sm:text-[9px]";

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <div
        ref={containerRef}
        className={cn(
          beforeAfterMediaFrameClassName,
          "touch-none select-none",
          isDragging && "cursor-ew-resize",
          showAfter &&
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        )}
        role={showAfter ? "slider" : "group"}
        tabIndex={showAfter ? 0 : undefined}
        aria-valuemin={showAfter ? 0 : undefined}
        aria-valuemax={showAfter ? 100 : undefined}
        aria-valuenow={showAfter ? Math.round(position) : undefined}
        aria-label={i18n(language, {
          en: "Current vs after 12 weeks — drag to compare",
          fr: "Actuellement vs après 12 premières semaines — fais glisser pour comparer",
        })}
        onKeyDown={showAfter ? onKeyDown : undefined}
        onPointerDown={showAfter ? onPointerDown : undefined}
        onPointerMove={showAfter ? onPointerMove : undefined}
        onPointerUp={showAfter ? onPointerUp : undefined}
        onPointerCancel={showAfter ? onPointerUp : undefined}
        onLostPointerCapture={showAfter ? onPointerUp : undefined}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {showAfter ? (
            <>
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
              {beforeSrc ? (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                  aria-hidden={position <= 0}
                >
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
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden />
                </div>
              )}
            </>
          ) : (
            <>
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

              <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(180deg,rgba(20,28,40,0.55),rgba(10,16,22,0.75))]">
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white/80" aria-hidden />
                <p className="px-4 text-center text-[11px] font-medium leading-snug text-white/85 sm:text-xs">
                  {i18n(language, {
                    en: "Generating your potential…",
                    fr: "Génération de ton potentiel…",
                  })}
                </p>
              </div>
            </>
          )}
        </div>

        {(showAfter || beforeSrc) && (
          <>
            <div className="pointer-events-none absolute left-2 top-2 z-20 max-w-[min(12rem,46%)] sm:left-2.5 sm:top-2.5">
              <span className={cn(pillClass, "block text-left")}>{beforeLabel}</span>
            </div>
            {showAfter ? (
              <div
                className="pointer-events-none absolute right-2 top-2 z-20 max-w-[min(13.5rem,50%)] sm:right-2.5 sm:top-2.5"
                aria-label={afterLabelAria}
              >
                <span
                  className={cn(
                    pillClass,
                    "inline-flex flex-col items-end gap-0 leading-[1.08] text-right",
                  )}
                >
                  <span>{afterLabelLine1}</span>
                  <span>{afterLabelLine2}</span>
                </span>
              </div>
            ) : null}
          </>
        )}

        {showAfter ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-0"
              style={{ left: `${position}%` }}
              aria-hidden
            >
              <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.45)]" />
            </div>

            <div
              className={cn(
                "pointer-events-none absolute top-1/2 z-30 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-[rgba(10,16,22,0.82)] shadow-[0_8px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md transition-transform sm:h-12 sm:w-12",
                isDragging && "scale-105",
              )}
              style={{ left: `${position}%` }}
              aria-hidden
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
