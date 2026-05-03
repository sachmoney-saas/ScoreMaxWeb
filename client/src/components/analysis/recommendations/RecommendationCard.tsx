import * as React from "react";
import {
  Activity,
  Apple,
  BookmarkCheck,
  Check,
  Droplets,
  HeartPulse,
  Loader2,
  Scissors,
  Sparkles,
  Stethoscope,
  Syringe,
  Waves,
  Wand2,
  Zap,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
  type FaceAnalysisLocale,
} from "@/lib/face-analysis-display";
import {
  buildReasonFragments,
  useUpsertRecommendationAction,
  useDeleteRecommendationAction,
  type MatchedRecommendation,
  type Recommendation,
  type RecommendationAction,
  type RecommendationCategory,
  type RecommendationDurationUnit,
  type RecommendationRisk,
} from "@/lib/recommendations";

/* ============================================================================
 * Visual helpers — kept here so any consumer (worker page, analysis tab) gets
 * the same look without duplicating code.
 * ========================================================================= */

export function categoryIcon(category: RecommendationCategory): React.ReactNode {
  const cls = "h-4 w-4";
  switch (category) {
    case "habit":           return <HeartPulse className={cls} />;
    case "exercise":        return <Activity className={cls} />;
    case "topical":         return <Droplets className={cls} />;
    case "nutrition":       return <Apple className={cls} />;
    case "device":          return <Wand2 className={cls} />;
    case "injectable":      return <Syringe className={cls} />;
    case "energy":          return <Zap className={cls} />;
    case "surgery":         return <Scissors className={cls} />;
    case "device_clinical": return <Stethoscope className={cls} />;
    case "cosmetic":        return <Sparkles className={cls} />;
    default:                return <Sparkles className={cls} />;
  }
}

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
  const upsert = useUpsertRecommendationAction();
  const remove = useDeleteRecommendationAction();

  const title = language === "fr" ? rec.title_fr : rec.title_en;
  const summary = language === "fr" ? rec.summary_fr : rec.summary_en;
  const reason = hideReason ? null : formatReason(rec, worker, aggregates, language);
  const duration = durationLabel(rec.duration_value, rec.duration_unit, language);
  const cost = costLabel(rec, language);

  const isHard = rec.type === "hard";
  const isInProtocol = action?.status === "saved";

  const toggleProtocol = (): void => {
    if (isInProtocol) {
      remove.mutate({ recommendationId: rec.id, worker });
    } else {
      upsert.mutate({ recommendationId: rec.id, worker, status: "saved" });
    }
  };

  const isPending = upsert.isPending || remove.isPending;

  return (
    <Card className="relative overflow-hidden border-white/10 bg-white/[0.03] backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isHard
                  ? "bg-rose-400/12 text-rose-200"
                  : "bg-emerald-400/12 text-emerald-200"
              }`}
            >
              {categoryIcon(rec.category)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-display text-base font-semibold leading-tight tracking-tight text-white">
                  {title}
                </h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${
                    isHard
                      ? "bg-rose-400/12 text-rose-200 ring-rose-300/20"
                      : "bg-emerald-400/12 text-emerald-200 ring-emerald-300/20"
                  }`}
                >
                  {isHard
                    ? i18n(language, { en: "Hard", fr: "Hard" })
                    : i18n(language, { en: "Soft", fr: "Soft" })}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                {categoryLabel(rec.category, language)}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-zinc-300">{summary}</p>

        {reason ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300">
            <span className="mr-1 font-semibold text-white">
              {i18n(language, { en: "Why:", fr: "Pourquoi :" })}
            </span>
            {reason}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {duration ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              <Waves className="h-3 w-3" />
              {duration}
            </span>
          ) : null}
          {cost ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              {cost}
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${riskClasses(
              rec.risk,
            )}`}
          >
            {riskLabel(rec.risk, language)}
          </span>
        </div>

        {rec.steps.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {i18n(language, {
                en: "Steps",
                fr: "Étapes",
              })}
            </p>
            <ol className="mt-2 space-y-2">
              {rec.steps.map((step, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-300"
                >
                  <span className="mt-px font-display text-sm font-bold tabular-nums text-zinc-500">
                    {idx + 1}.
                  </span>
                  <span>{language === "fr" ? step.fr : step.en}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant={isInProtocol ? "secondary" : "ghost"}
            disabled={isPending}
            onClick={toggleProtocol}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isInProtocol ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <BookmarkCheck className="h-3 w-3" />
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
          {isInProtocol ? (
            <span className="text-[11px] text-zinc-500">
              {i18n(language, {
                en: "Manage from your protocol",
                fr: "Gérable depuis ton protocole",
              })}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
