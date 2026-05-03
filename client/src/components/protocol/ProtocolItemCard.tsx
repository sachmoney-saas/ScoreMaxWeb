import * as React from "react";
import { Loader2, MinusCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { useDeleteRecommendationAction } from "@/lib/recommendations";
import {
  categoryIcon,
  categoryLabel,
  durationLabel,
  riskClasses,
  riskLabel,
} from "@/components/analysis/recommendations/RecommendationCard";
import type { ProtocolItem } from "@/lib/protocol";

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
}

export function ProtocolItemCard({
  item,
  language,
  trailing,
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

  const isHard = rec.type === "hard";

  const handleRemove = (): void => {
    remove.mutate({ recommendationId: rec.id, worker: action.worker });
  };

  return (
    <Card className="group relative overflow-hidden border-white/10 bg-white/[0.03] backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isHard
                  ? "bg-rose-400/12 text-rose-200"
                  : "bg-emerald-400/12 text-emerald-200"
              }`}
            >
              {categoryIcon(rec.category)}
            </div>
            <div className="min-w-0">
              <h4 className="font-display text-sm font-semibold leading-tight tracking-tight text-white">
                {title}
              </h4>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                {categoryLabel(rec.category, language)}
              </p>
            </div>
          </div>

          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>

        <p className="text-xs leading-relaxed text-zinc-300">{summary}</p>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {duration ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              {duration}
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
              {i18n(language, { en: "Steps", fr: "Étapes" })}
            </p>
            <ol className="mt-2 space-y-1.5">
              {rec.steps.map((step, idx) => (
                <li
                  key={idx}
                  className="flex gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-300"
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
            className="h-7 gap-1.5 px-2 text-[11px] text-zinc-500 hover:text-rose-300"
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
