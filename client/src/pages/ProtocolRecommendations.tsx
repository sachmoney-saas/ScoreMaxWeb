import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { Card, CardContent } from "@/components/ui/card";
import { RecommendationCard } from "@/components/analysis/recommendations/RecommendationCard";
import { ProtocolHubNavTabs } from "@/components/protocol/ProtocolHubNavTabs";
import {
  ProtocolPageShell,
  protocolPageTitleClassName,
} from "@/components/protocol/ProtocolPageShell";
import { cn } from "@/lib/utils";
import { getWorkerDisplayLabel } from "@/lib/face-analysis-display";
import { useAppLanguage, i18n, type AppLanguage } from "@/lib/i18n";
import {
  type MatchedRecommendation,
  type UserRecommendationEngagementItem,
  useUserRecommendationEngagement,
  type RecommendationActionStatus,
} from "@/lib/recommendations";

function toMatched(rec: UserRecommendationEngagementItem["recommendation"]): MatchedRecommendation {
  return { ...rec, relevance: rec.priority };
}

function statusLabel(status: RecommendationActionStatus, language: AppLanguage): string {
  const map: Record<RecommendationActionStatus, { en: string; fr: string }> = {
    saved: { en: "In protocol", fr: "Dans le protocole" },
    dismissed: { en: "Dismissed", fr: "Masquée" },
    in_progress: { en: "In progress", fr: "En cours" },
    done: { en: "Done", fr: "Terminée" },
  };
  return i18n(language, map[status]);
}

export default function ProtocolRecommendationsPage() {
  const language = useAppLanguage();
  const engagement = useUserRecommendationEngagement();

  const byWorker = React.useMemo(() => {
    const items = engagement.data ?? [];
    const m = new Map<string, UserRecommendationEngagementItem[]>();
    for (const row of items) {
      const w = row.action.worker;
      const bucket = m.get(w) ?? [];
      bucket.push(row);
      m.set(w, bucket);
    }
    return Array.from(m.entries()).sort((a, b) =>
      getWorkerDisplayLabel(a[0]).localeCompare(getWorkerDisplayLabel(b[0]), "fr", {
        sensitivity: "base",
      }),
    );
  }, [engagement.data]);

  if (engagement.isLoading) {
    const loadingLabel = i18n(language, {
      en: "Loading your recommendations…",
      fr: "Chargement de tes recommandations…",
    });
    return (
      <ProtocolPageShell
        topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
        header={
          <h1 className={cn(protocolPageTitleClassName, "text-center")}>
            {i18n(language, {
              en: "Recommendation history",
              fr: "Historique des recommandations",
            })}
          </h1>
        }
      >
        <div
          className="flex min-h-[min(400px,55vh)] w-full flex-col items-center justify-center gap-5 py-8"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <BrandLoader size="lg" tone="on-dark" label={loadingLabel} />
          <BrandLoaderTrack tone="on-dark" />
          <p className="text-center text-sm font-medium tracking-tight text-zinc-300">{loadingLabel}</p>
        </div>
      </ProtocolPageShell>
    );
  }

  if (engagement.error) {
    return (
      <ProtocolPageShell
        topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
        header={
          <h1 className={cn(protocolPageTitleClassName, "text-center")}>
            {i18n(language, {
              en: "Recommendation history",
              fr: "Historique des recommandations",
            })}
          </h1>
        }
      >
        <Card className="border-rose-200 bg-rose-50/90 text-rose-950 shadow-none">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-900">
                {i18n(language, {
                  en: "Couldn't load recommendation history.",
                  fr: "Impossible de charger l’historique des recommandations.",
                })}
              </p>
              <p className="mt-1 text-xs text-rose-800/90">{(engagement.error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      </ProtocolPageShell>
    );
  }

  const empty = byWorker.length === 0;

  return (
    <ProtocolPageShell
      topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
      header={
        <h1 className={cn(protocolPageTitleClassName, "text-center")}>
          {i18n(language, {
            en: "Recommendation history",
            fr: "Historique des recommandations",
          })}
        </h1>
      }
    >
      <div className="space-y-8">
        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-zinc-400">
          {i18n(language, {
            en: "Every recommendation you touched from past analyses — saved, dismissed or in progress — is listed here by area. This is not the per-analysis tab; it’s your account-wide log.",
            fr: "Chaque recommandation avec laquelle tu as interagi depuis tes analyses — enregistrée, masquée ou en cours — apparaît ici, par zone du visage. Ce n’est pas l’onglet d’une analyse précise : c’est la vue globale de ton compte.",
          })}
        </p>

        {empty ? (
          <Card className="border-white/12 bg-white/[0.06] text-zinc-100 shadow-none">
            <CardContent className="space-y-2 p-6 text-center text-sm text-zinc-300">
              <p className="font-display text-lg font-semibold text-white">
                {i18n(language, {
                  en: "Nothing here yet",
                  fr: "Rien pour l’instant",
                })}
              </p>
              <p className="text-zinc-400">
                {i18n(language, {
                  en: "Open any completed analysis → Recommendations to match cards to your scores. Actions you take there will show up on this page.",
                  fr: "Ouvre une analyse terminée → onglet Recommandations pour voir les fiches selon tes scores. Dès que tu interagis avec une fiche, elle apparaît ici.",
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {byWorker.map(([worker, rows]) => (
              <section key={worker} className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                  <h2 className="font-display text-lg font-bold tracking-tight text-white">
                    {getWorkerDisplayLabel(worker)}
                  </h2>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {rows.length}{" "}
                    {rows.length === 1
                      ? i18n(language, { en: "item", fr: "élément" })
                      : i18n(language, { en: "items", fr: "éléments" })}
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {rows.map((entry: UserRecommendationEngagementItem) => {
                    const { action, recommendation } = entry;
                    return (
                    <div key={action.id} className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                        {statusLabel(action.status, language)}
                      </p>
                      <RecommendationCard
                        rec={toMatched(recommendation)}
                        worker={worker}
                        aggregates={{}}
                        language={language}
                        action={action}
                        hideReason
                      />
                    </div>
                  );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-zinc-400">
          {i18n(language, {
            en: "Educational content only — not medical advice. Hard interventions require a qualified professional.",
            fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Les interventions hard nécessitent un professionnel qualifié.",
          })}
        </p>
      </div>
    </ProtocolPageShell>
  );
}
