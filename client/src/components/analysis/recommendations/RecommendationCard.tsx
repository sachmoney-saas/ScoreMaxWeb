import * as React from "react";
import { BookmarkCheck, Check, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analysisSurfaceCardClassName } from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
  type FaceAnalysisLocale,
} from "@/lib/face-analysis-display";
import {
  buildReasonFragments,
  useUpsertRecommendationAction,
  type MatchedRecommendation,
  type Recommendation,
  type RecommendationAction,
  type RecommendationCategory,
  type RecommendationDurationUnit,
  type RecommendationRisk,
} from "@/lib/recommendations";
import { useIsRecommendationDocumentSurface } from "@/components/analysis/recommendations/RecommendationDocumentContext";

/* ============================================================================
 * Visual helpers — kept here so any consumer (worker page, analysis tab) gets
 * the same look without duplicating code.
 * ========================================================================= */

export function categoryLabel(
  category: RecommendationCategory,
  language: AppLanguage,
): string {
  const map: Record<RecommendationCategory, { en: string; fr: string }> = {
    habit:           { en: "Habit",            fr: "Habitude" },
    exercise:        { en: "Exercise",         fr: "Exercice" },
    topical:         { en: "Topical",          fr: "Soin topique" },
    nutrition:       { en: "Nutrition",        fr: "Nutrition" },
    device:          { en: "Device",           fr: "Accessoire" },
    injectable:      { en: "Injectable",       fr: "Injectable" },
    energy:          { en: "Energy",           fr: "Énergie" },
    surgery:         { en: "Surgery",          fr: "Chirurgie" },
    device_clinical: { en: "Clinical device",  fr: "Appareil clinique" },
    cosmetic:        { en: "Cosmetic",         fr: "Cosmétique" },
  };
  return i18n(language, map[category]);
}

export function riskClasses(risk: RecommendationRisk): string {
  switch (risk) {
    case "none":   return "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20";
    case "low":    return "bg-lime-400/12 text-lime-200 ring-lime-300/20";
    case "medium": return "bg-amber-400/15 text-amber-200 ring-amber-300/25";
    case "high":   return "bg-rose-400/15 text-rose-200 ring-rose-300/25";
  }
}

function riskClassesDocument(risk: RecommendationRisk): string {
  switch (risk) {
    case "none":   return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "low":    return "bg-lime-50 text-lime-900 ring-lime-200";
    case "medium": return "bg-amber-50 text-amber-950 ring-amber-200";
    case "high":   return "bg-rose-50 text-rose-900 ring-rose-200";
  }
}

export function riskLabel(
  risk: RecommendationRisk,
  language: AppLanguage,
): string {
  const map: Record<RecommendationRisk, { en: string; fr: string }> = {
    none:   { en: "No risk",     fr: "Aucun risque" },
    low:    { en: "Low risk",    fr: "Risque faible" },
    medium: { en: "Medium risk", fr: "Risque modéré" },
    high:   { en: "High risk",   fr: "Risque élevé" },
  };
  return i18n(language, map[risk]);
}

export function durationLabel(
  value: number | null,
  unit: RecommendationDurationUnit | null,
  language: AppLanguage,
): string | null {
  if (value === null || !unit) return null;
  const fr: Record<RecommendationDurationUnit, string> = {
    days: value > 1 ? "jours" : "jour",
    weeks: value > 1 ? "semaines" : "semaine",
    months: value > 1 ? "mois" : "mois",
    session: value > 1 ? "séances" : "séance",
    permanent: "permanent",
  };
  const en: Record<RecommendationDurationUnit, string> = {
    days: value > 1 ? "days" : "day",
    weeks: value > 1 ? "weeks" : "week",
    months: value > 1 ? "months" : "month",
    session: value > 1 ? "sessions" : "session",
    permanent: "permanent",
  };
  if (unit === "permanent") {
    return i18n(language, { en: en.permanent, fr: fr.permanent });
  }
  return `${value} ${i18n(language, { en: en[unit], fr: fr[unit] })}`;
}

export function costLabel(
  rec: Recommendation,
  language: AppLanguage,
): string | null {
  if (rec.cost_min === null && rec.cost_max === null) return null;
  if (rec.cost_max === 0 && rec.cost_min === 0) {
    return i18n(language, { en: "Free", fr: "Gratuit" });
  }
  const currency = rec.cost_currency ?? "EUR";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
  if (rec.cost_min === rec.cost_max) {
    return `${rec.cost_min}${symbol}`;
  }
  return `${rec.cost_min ?? "?"}–${rec.cost_max ?? "?"} ${symbol}`;
}

/* The card surfaces a single saved/not-saved state — no need for full status
 * mapping here. Other statuses (in_progress, done, dismissed) remain in the
 * type system for future protocol features but aren't rendered as badges. */

/* ============================================================================
 * Reason — translates DSL fragments into human "why for you" copy
 * ========================================================================= */

export function formatReason(
  rec: Recommendation,
  worker: string,
  aggregates: Record<string, unknown>,
  language: AppLanguage,
): string | null {
  const fragments = buildReasonFragments(rec, aggregates);
  const locale: FaceAnalysisLocale = language === "fr" ? "fr" : "en";

  const parts = fragments
    .map((frag) => {
      const label = formatAggregateDisplayLabel(worker, frag.key, locale);
      if (frag.score !== undefined && frag.score !== null) {
        return language === "fr"
          ? `${label} : ${frag.score.toFixed(1)}/10`
          : `${label}: ${frag.score.toFixed(1)}/10`;
      }
      if (frag.enumValue) {
        const formatted = formatAggregateDisplayValue(
          worker,
          frag.key,
          frag.enumValue,
          locale,
        );
        return language === "fr"
          ? `${label} : ${formatted.toLowerCase()}`
          : `${label}: ${formatted.toLowerCase()}`;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s));

  if (parts.length === 0) {
    return rec.targets.length > 0
      ? i18n(language, {
          en: "Reinforces this area of your face.",
          fr: "Renforce cette zone de ton visage.",
        })
      : null;
  }

  return language === "fr"
    ? `Pour toi : ${parts.join(" • ")}`
    : `For you: ${parts.join(" • ")}`;
}

/* ============================================================================
 * RecommendationCard — the visual unit reused everywhere
 * ========================================================================= */

export interface RecommendationCardProps {
  rec: MatchedRecommendation;
  worker: string;
  aggregates: Record<string, unknown>;
  language: AppLanguage;
  action: RecommendationAction | undefined;
  /** Hide the "why for you" block (e.g. when it's already implicit in context). */
  hideReason?: boolean;
}

export function RecommendationCard({
  rec,
  worker,
  aggregates,
  language,
  action,
  hideReason,
}: RecommendationCardProps) {
  const isDocument = useIsRecommendationDocumentSurface();
  const upsert = useUpsertRecommendationAction();

  const title = language === "fr" ? rec.title_fr : rec.title_en;
  const summary = language === "fr" ? rec.summary_fr : rec.summary_en;
  const reason = hideReason ? null : formatReason(rec, worker, aggregates, language);
  const duration = durationLabel(rec.duration_value, rec.duration_unit, language);
  const cost = costLabel(rec, language);

  const isHard = rec.type === "hard";
  const isInProtocol = action?.status !== "dismissed";

  const railDivider = isDocument
    ? "md:border-zinc-200 md:border-r"
    : "md:border-white/10 md:border-r";

  const toggleProtocol = (): void => {
    if (isInProtocol) {
      upsert.mutate({ recommendationId: rec.id, worker, status: "dismissed" });
    } else {
      upsert.mutate({ recommendationId: rec.id, worker, status: "saved" });
    }
  };

  const isPending = upsert.isPending;

  return (
    <Card
      className={cn(
        isDocument
          ? "rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-none"
          : analysisSurfaceCardClassName,
        !isDocument && "rounded-xl transition duration-300 hover:border-white/35",
      )}
    >
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Rail — identité & action */}
          <div
            className={cn(
              "flex shrink-0 flex-col gap-3 px-5 py-5 sm:gap-4 md:w-[min(100%,270px)] md:py-6",
              "border-b pb-5 md:border-b-0 md:pb-6",
              railDivider,
            )}
          >
            <h4
              className={cn(
                "font-display text-[1.05rem] font-semibold leading-snug tracking-tight sm:text-base",
                isDocument ? "text-zinc-900" : "text-white",
              )}
            >
              {title}
            </h4>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                isDocument ? "text-zinc-500" : "text-zinc-400",
              )}
            >
              {categoryLabel(rec.category, language)}
            </p>
            <span
              className={cn(
                "w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
                isHard
                  ? isDocument
                    ? "bg-rose-50 text-rose-900 ring-rose-200"
                    : "bg-rose-400/12 text-rose-200 ring-rose-300/20"
                  : isDocument
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : "bg-emerald-400/12 text-emerald-200 ring-emerald-300/20",
              )}
            >
              {isHard
                ? i18n(language, { en: "Hardmaxxing", fr: "Hardmaxxing" })
                : i18n(language, { en: "Softmaxxing", fr: "Softmaxxing" })}
            </span>
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                variant={
                  isDocument
                    ? isInProtocol
                      ? "secondary"
                      : "outline"
                    : "ghost"
                }
                disabled={isPending}
                onClick={toggleProtocol}
                className={cn(
                  "h-9 w-full gap-1.5 px-3 text-xs sm:h-10",
                  isDocument &&
                    !isInProtocol &&
                    "border-zinc-300 text-zinc-800 hover:bg-zinc-100 hover:text-zinc-900",
                  !isDocument &&
                    !isInProtocol &&
                    "border border-white/15 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.11] hover:text-white",
                  !isDocument &&
                    isInProtocol &&
                    cn(
                      "!text-white shadow-none [&_svg]:!text-white",
                      "border border-white/35 bg-white/12 hover:!text-white hover:bg-white/22",
                      "active:!text-white active:bg-white/28",
                      "focus-visible:!text-white",
                    ),
                )}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : isInProtocol ? (
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isDocument ? "text-emerald-700" : "text-white",
                    )}
                  />
                ) : (
                  <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                )}
                {isInProtocol
                  ? i18n(language, {
                      en: "In your protocol",
                      fr: "Dans ton protocole",
                    })
                  : i18n(language, {
                      en: "Add to my protocol",
                      fr: "Ajouter à mon protocole",
                    })}
              </Button>
            </div>
          </div>

          {/* Corps — lecture détaillée */}
          <div className="min-w-0 flex-1 space-y-4 px-5 py-5 md:py-6 md:pl-6 md:pr-6">
            <p
              className={cn(
                "text-sm leading-relaxed",
                isDocument ? "text-zinc-700" : "text-zinc-300",
              )}
            >
              {summary}
            </p>

            {reason ? (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  isDocument
                    ? "border border-zinc-200 bg-zinc-50 text-zinc-800"
                    : "rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300",
                )}
              >
                <span
                  className={cn(
                    "mr-1 font-semibold",
                    isDocument ? "text-zinc-900" : "text-white",
                  )}
                >
                  {i18n(language, { en: "Why:", fr: "Pourquoi :" })}
                </span>
                {reason}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {duration ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                    isDocument
                      ? "border border-zinc-200 bg-zinc-50 text-zinc-700"
                      : "border border-white/10 bg-white/[0.04] text-zinc-300",
                  )}
                >
                  {duration}
                </span>
              ) : null}
              {cost ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                    isDocument
                      ? "border border-zinc-200 bg-zinc-50 text-zinc-700"
                      : "border border-white/10 bg-white/[0.04] text-zinc-300",
                  )}
                >
                  {cost}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${
                  isDocument ? riskClassesDocument(rec.risk) : riskClasses(rec.risk)
                }`}
              >
                {riskLabel(rec.risk, language)}
              </span>
            </div>

            {rec.steps.length > 0 ? (
              <div>
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.14em]",
                    isDocument ? "text-zinc-500" : "text-zinc-500",
                  )}
                >
                  {i18n(language, {
                    en: "Steps",
                    fr: "Étapes",
                  })}
                </p>
                <ol className="mt-2 space-y-2">
                  {rec.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className={cn(
                        "flex gap-3 rounded-lg px-3 py-2 text-xs leading-relaxed",
                        isDocument
                          ? "border border-zinc-100 bg-zinc-50 text-zinc-800"
                          : "bg-white/[0.03] text-zinc-300",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-px font-display text-sm font-bold tabular-nums",
                          isDocument ? "text-zinc-500" : "text-zinc-500",
                        )}
                      >
                        {idx + 1}.
                      </span>
                      <span>{language === "fr" ? step.fr : step.en}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
