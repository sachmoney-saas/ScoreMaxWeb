import * as React from "react";

import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { buildDayPlan } from "@/lib/protocol-day";
import type { ActivePreset } from "@shared/protocol-presets";
import { RoutineDayPanel } from "@/components/protocol/RoutineDayPanel";

const DAY_COUNT = 7;

export interface RoutineDayCarouselProps {
  language: AppLanguage;
  presets: ActivePreset[];
  selectedOffset: number;
  onSelectedOffsetChange: (offset: number) => void;
  userId: string | null;
}

export function RoutineDayCarousel({
  language,
  presets,
  selectedOffset,
  onSelectedOffsetChange,
  userId,
}: RoutineDayCarouselProps) {
  const today = React.useMemo(() => new Date(), []);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isScrollingRef = React.useRef(false);

  const dayPlans = React.useMemo(
    () =>
      Array.from({ length: DAY_COUNT }, (_, offset) =>
        buildDayPlan(presets, offset, language, today),
      ),
    [presets, language, today],
  );

  const scrollToOffset = React.useCallback((offset: number, smooth: boolean) => {
    const container = scrollRef.current;
    if (!container) return;
    const slide = container.querySelector<HTMLElement>(
      `[data-day-slide="${offset}"]`,
    );
    if (!slide) return;
    isScrollingRef.current = true;
    slide.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
      inline: "start",
      block: "nearest",
    });
    window.setTimeout(() => {
      isScrollingRef.current = false;
    }, smooth ? 400 : 50);
  }, []);

  React.useEffect(() => {
    scrollToOffset(selectedOffset, false);
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isScrollingRef.current) return;
    scrollToOffset(selectedOffset, true);
  }, [selectedOffset, scrollToOffset]);

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container || isScrollingRef.current) return;

    const slideWidth = container.clientWidth;
    if (slideWidth <= 0) return;

    const index = Math.round(container.scrollLeft / slideWidth);
    const clamped = Math.max(0, Math.min(DAY_COUNT - 1, index));
    if (clamped !== selectedOffset) {
      onSelectedOffsetChange(clamped);
    }
  }, [selectedOffset, onSelectedOffsetChange]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && selectedOffset > 0) {
        onSelectedOffsetChange(selectedOffset - 1);
      }
      if (e.key === "ArrowRight" && selectedOffset < DAY_COUNT - 1) {
        onSelectedOffsetChange(selectedOffset + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOffset, onSelectedOffsetChange]);

  return (
    <div className="-mx-3 space-y-3 sm:mx-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        aria-label={i18n(language, {
          en: "Daily routine — swipe for upcoming days",
          fr: "Routine du jour — glisse pour les jours suivants",
        })}
      >
        {dayPlans.map((plan) => (
          <div
            key={plan.dayOffset}
            data-day-slide={plan.dayOffset}
            className="w-full shrink-0 snap-start"
          >
            <RoutineDayPanel
              language={language}
              plan={plan}
              today={today}
              userId={userId}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: DAY_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectedOffsetChange(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selectedOffset ? "w-4 bg-zinc-100" : "w-1.5 bg-zinc-600",
            )}
          />
        ))}
      </div>
    </div>
  );
}
