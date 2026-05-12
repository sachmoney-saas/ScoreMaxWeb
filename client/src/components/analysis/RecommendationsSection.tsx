import * as React from "react";
import { Loader2 } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  educationalDisclaimerI18n,
  educationalDisclaimerNoticeClassName,
  educationalDisclaimerWrapperClassName,
} from "@/lib/educational-disclaimer";
import {
  useMatchedRecommendations,
  useRecommendationActions,
  type RecommendationAction,
  type RecommendationType,
} from "@/lib/recommendations";
import { analysisSurfaceCardClassName } from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { RecommendationCard } from "@/components/analysis/recommendations/RecommendationCard";

/* ----------------------------------------------------------------------------
 * Section header for a recommendation group (Soft / Hard)
 * ------------------------------------------------------------------------- */

function GroupHeader({
  type,
  count,
  language,
}: {
  type: RecommendationType;
  count: number;
  language: AppLanguage;
}) {
  const isHard = type === "hard";
  return (
    <div className="flex items-end justify-between gap-3 border-b border-white/5 pb-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {isHard
            ? i18n(language, { en: "Hardmaxxing", fr: "Hardmaxxing" })
            : i18n(language, { en: "Softmaxxing", fr: "Softmaxxing" })}
        </p>
        <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
          {isHard
            ? i18n(language, {
                en: "Clinical & cosmetic interventions",
                fr: "Interventions cliniques et cosmétiques",
              })
            : i18n(language, {
                en: "Natural daily routine",
                fr: "Routine naturelle quotidienne",
              })}
        </h3>
        <p className="mt-1 max-w-xl text-xs text-zinc-400">
          {isHard
            ? i18n(language, {
                en: "Faster, more visible results — but with cost, downtime and real medical risk. Always consult a qualified professional.",
                fr: "Résultats plus rapides et visibles — mais coût, arrêt et risques médicaux réels. Consulte toujours un professionnel qualifié.",
              })
            : i18n(language, {
                en: "Free or low-cost daily habits, exercises and topicals. The foundation for everything else.",
                fr: "Habitudes, exercices et soins du quotidien, gratuits ou peu coûteux. La base de tout le reste.",
              })}
        </p>
      </div>
      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold tabular-nums text-zinc-300">
        {count}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Public component
 * ------------------------------------------------------------------------- */

export interface RecommendationsSectionProps {
  worker: string;
  aggregates: Record<string, unknown>;
  language: AppLanguage;
}

export function RecommendationsSection({
  worker,
  aggregates,
  language,
}: RecommendationsSectionProps) {
  const matched = useMatchedRecommendations(worker, aggregates);
  const { data: actions = [] } = useRecommendationActions(worker);

  const actionByRec = React.useMemo(() => {
    const map = new Map<string, RecommendationAction>();
    for (const a of actions) map.set(a.recommendation_id, a);
    return map;
  }, [actions]);

  if (matched.isLoading) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "flex items-center justify-center gap-2 rounded-2xl p-12 text-sm text-zinc-300",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {i18n(language, {
          en: "Loading personalised recommendations…",
          fr: "Chargement des recommandations personnalisées…",
        })}
      </div>
    );
  }

  if (matched.error) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "rounded-2xl p-6 text-sm text-rose-200",
        )}
      >
        {i18n(language, {
          en: "Couldn't load recommendations.",
          fr: "Impossible de charger les recommandations.",
        })}
      </div>
    );
  }

  // Worker has no editorial content yet — render nothing rather than a
  // misleading "all good" message. Per-worker seeds will be added over time.
  if (matched.totalAvailable === 0) {
    return null;
  }

  if (matched.soft.length === 0 && matched.hard.length === 0) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "space-y-2 rounded-2xl p-6 text-sm text-zinc-300",
        )}
      >
        <p className="font-display text-lg font-semibold text-white">
          {i18n(language, {
            en: "Nothing critical to address",
            fr: "Rien de critique à adresser",
          })}
        </p>
        <p className="text-zinc-400">
          {i18n(language, {
            en: "Your scores on this worker are healthy — keep your routine consistent.",
            fr: "Tes scores sur ce worker sont sains — garde ta routine régulière.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        analysisSurfaceCardClassName,
        "space-y-8 rounded-2xl p-6",
      )}
    >
        {matched.soft.length > 0 ? (
          <section className="space-y-4">
            <GroupHeader type="soft" count={matched.soft.length} language={language} />
            <div className="grid grid-cols-1 gap-3">
              {matched.soft.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  worker={worker}
                  aggregates={aggregates}
                  language={language}
                  action={actionByRec.get(rec.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {matched.hard.length > 0 ? (
          <section className="space-y-4">
            <GroupHeader type="hard" count={matched.hard.length} language={language} />
            <div className="grid grid-cols-1 gap-3">
              {matched.hard.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  worker={worker}
                  aggregates={aggregates}
                  language={language}
                  action={actionByRec.get(rec.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

      <div className={educationalDisclaimerWrapperClassName}>
        <p className={educationalDisclaimerNoticeClassName}>
          {i18n(language, educationalDisclaimerI18n)}
        </p>
      </div>
    </div>
  );
}
