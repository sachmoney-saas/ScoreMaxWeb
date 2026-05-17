import * as React from "react";

import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { dayOffsetToDate } from "@/lib/protocol-day";

const DAY_COUNT = 7;

export interface RoutineDaySliderProps {
  language: AppLanguage;
  selectedOffset: number;
  onSelectOffset: (offset: number) => void;
}

function formatDayLabel(
  language: AppLanguage,
  offset: number,
  today: Date,
): string {
  const date = dayOffsetToDate(offset, today);
  if (offset === 0) {
    return i18n(language, { en: "Today", fr: "Aujourd'hui" });
  }
  return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function RoutineDaySlider({
  language,
  selectedOffset,
  onSelectOffset,
}: RoutineDaySliderProps) {
  const today = React.useMemo(() => new Date(), []);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-day-offset="${selectedOffset}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedOffset]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && selectedOffset > 0) {
        onSelectOffset(selectedOffset - 1);
      }
      if (e.key === "ArrowRight" && selectedOffset < DAY_COUNT - 1) {
        onSelectOffset(selectedOffset + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOffset, onSelectOffset]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={i18n(language, {
        en: "Days",
        fr: "Jours",
      })}
    >
      {Array.from({ length: DAY_COUNT }, (_, offset) => {
        const selected = offset === selectedOffset;
        return (
          <button
            key={offset}
            type="button"
            role="tab"
            data-day-offset={offset}
            aria-selected={selected}
            onClick={() => onSelectOffset(offset)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
              selected
                ? "bg-white/12 text-zinc-50 underline decoration-zinc-300 underline-offset-4"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
            )}
          >
            {formatDayLabel(language, offset, today)}
          </button>
        );
      })}
    </div>
  );
}
