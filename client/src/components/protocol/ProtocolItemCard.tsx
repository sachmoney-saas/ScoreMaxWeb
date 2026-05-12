import * as React from "react";
import { Loader2, MinusCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { useDeleteRecommendationAction } from "@/lib/recommendations";
import type { RecommendationRisk } from "@/lib/recommendations";
import {
  categoryLabel,
  durationLabel,
  riskClasses,
  riskLabel,
} from "@/components/analysis/recommendations/RecommendationCard";
import type { ProtocolItem } from "@/lib/protocol";

function riskSheetClasses(risk: RecommendationRisk): string {
  switch (risk) {
    case "none":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "low":
      return "bg-lime-50 text-lime-900 ring-lime-200";
    case "medium":
      return "bg-amber-50 text-amber-950 ring-amber-200";
    case "high":
      return "bg-rose-50 text-rose-900 ring-rose-200";
  }
}

/* ============================================================================
 * ProtocolItemCard
 *
 * The compact unit shown inside every protocol section. Stripped down on
 * purpose — the user already opted into this rec, so we don't repeat the
 * "why" or the recommendation-engine ceremony from the analysis page.
 * ========================================================================= */

export interface ProtocolItemCardProps {
  item: ProtocolItem;
  language: AppLanguage;
  /** Optional override for the right-hand metadata pill (e.g. cure progress). */
  trailing?: React.ReactNode;
  /** `glass` : ancien style sombre (hors page protocole). */
  surface?: "sheet" | "glass";
}

export function ProtocolItemCard({
  item,
  language,
  trailing,
  surface = "sheet",
}: ProtocolItemCardProps) {
  const { recommendation: rec, action } = item;
  const remove = useDeleteRecommendationAction();

  const title = language === "fr" ? rec.title_fr : rec.title_en;
  const summary = language === "fr" ? rec.summary_fr : rec.summary_en;
  const duration = durationLabel(
    rec.duration_value,
    rec.duration_unit,
    language,
  );

  const isSheet = surface === "sheet";

  const handleRemove = (): void => {
    remove.mutate({ recommendationId: rec.id, worker: action.worker });
  };

  return (
    <Card
      className={
        isSheet
          ? "group relative overflow-hidden border border-zinc-200 bg-white transition-shadow hover:shadow-md"
          : "group relative overflow-hidden border-white/10 bg-white/[0.03] backdrop-blur-sm transition-colors hover:bg-white/[0.05]"
      }
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4
              className={
                isSheet
                  ? "font-display text-sm font-semibold leading-tight tracking-tight text-zinc-950"
                  : "font-display text-sm font-semibold leading-tight tracking-tight text-white"
              }
            >
              {title}
            </h4>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              {categoryLabel(rec.category, language)}
            </p>
          </div>

          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>

        <p
          className={
            isSheet
              ? "text-xs leading-relaxed text-zinc-700"
              : "text-xs leading-relaxed text-zinc-300"
          }
        >
          {summary}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {duration ? (
            <span
              className={
                isSheet
                  ? "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-700"
                  : "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300"
              }
            >
              {duration}
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${
              isSheet ? riskSheetClasses(rec.risk) : riskClasses(rec.risk)
            }`}
          >
            {riskLabel(rec.risk, language)}
          </span>
        </div>

        {rec.steps.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {i18n(language, { en: "Steps", fr: "Étapes" })}
            </p>
            <ol className="mt-2 space-y-1.5">
              {rec.steps.map((step, idx) => (
                <li
                  key={idx}
                  className={
                    isSheet
                      ? "flex gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-800"
                      : "flex gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-300"
                  }
                >
                  <span className="mt-px font-display text-xs font-bold tabular-nums text-zinc-500">
                    {idx + 1}.
                  </span>
                  <span>{language === "fr" ? step.fr : step.en}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex items-center justify-end pt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={handleRemove}
            className={
              isSheet
                ? "h-7 gap-1.5 px-2 text-[11px] text-zinc-500 hover:text-rose-700"
                : "h-7 gap-1.5 px-2 text-[11px] text-zinc-500 hover:text-rose-300"
            }
          >
            {remove.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MinusCircle className="h-3 w-3" />
            )}
            {i18n(language, {
              en: "Remove from protocol",
              fr: "Retirer du protocole",
            })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
