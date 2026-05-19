import * as React from "react";

import { analysisTabBarGlassClassName } from "@/components/analysis/workers/_shared";
import {
  hardmaxxingGradientPillClassName,
  softmaxxingGradientPillClassName,
} from "@/components/analysis/recommendations/recommendation-type-styles";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

export interface RecommendationTypeFilterBarProps {
  showSoft: boolean;
  showHard: boolean;
  onSoftChange: (next: boolean) => void;
  onHardChange: (next: boolean) => void;
  language: AppLanguage;
  className?: string;
  compact?: boolean;
  surface?: "glass" | "plain";
}

const RECOMMENDATION_TYPE_TOGGLE_BTN_BASE = cn(
  "relative rounded-xl border border-transparent text-left font-medium transition-colors",
  "data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:bg-white/[0.07] data-[state=inactive]:hover:text-zinc-300",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(14,20,26,0.96)]",
  "data-[state=active]:hover:brightness-[1.02]",
);

export function RecommendationTypeFilterBar({
  showSoft,
  showHard,
  onSoftChange,
  onHardChange,
  language,
  className,
  compact = false,
  surface = "glass",
}: RecommendationTypeFilterBarProps) {
  const toggleSoft = () => {
    if (showSoft && !showHard) return;
    onSoftChange(!showSoft);
  };
  const toggleHard = () => {
    if (showHard && !showSoft) return;
    onHardChange(!showHard);
  };

  return (
    <div className={cn("flex w-full justify-center px-2", className)}>
      <div
        className={cn(
          surface === "glass" ? analysisTabBarGlassClassName : null,
          "inline-flex h-auto max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl p-1.5 sm:flex-nowrap",
        )}
        role="group"
        aria-label={i18n(language, {
          en: "Filter recommendations by category",
          fr: "Filtrer les recommandations par type",
        })}
      >
        <button
          type="button"
          data-state={showSoft ? "active" : "inactive"}
          aria-pressed={showSoft}
          onClick={toggleSoft}
          className={cn(
            RECOMMENDATION_TYPE_TOGGLE_BTN_BASE,
            compact
              ? "px-3 py-1.5 text-xs sm:px-3.5"
              : "px-4 py-2.5 text-sm sm:px-5",
            showSoft ? softmaxxingGradientPillClassName : null,
          )}
        >
          <span className="relative z-10 font-semibold">
            {i18n(language, { en: "Softmaxxing", fr: "Softmaxxing" })}
          </span>
        </button>
        <button
          type="button"
          data-state={showHard ? "active" : "inactive"}
          aria-pressed={showHard}
          onClick={toggleHard}
          className={cn(
            RECOMMENDATION_TYPE_TOGGLE_BTN_BASE,
            compact
              ? "px-3 py-1.5 text-xs sm:px-3.5"
              : "px-4 py-2.5 text-sm sm:px-5",
            showHard ? hardmaxxingGradientPillClassName : null,
          )}
        >
          <span className="relative z-10 font-semibold">
            {i18n(language, { en: "Hardmaxxing", fr: "Hardmaxxing" })}
          </span>
        </button>
      </div>
    </div>
  );
}
