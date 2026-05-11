import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { BrandLoader, BrandLoaderTrack } from "@/components/ui/brand-loader";
import { Card, CardContent } from "@/components/ui/card";
import { MiniRing } from "@/components/analysis/WorkerPreviewContent";
import { ProtocolHubNavTabs } from "@/components/protocol/ProtocolHubNavTabs";
import {
  ProtocolPageShell,
  protocolPageTitleClassName,
} from "@/components/protocol/ProtocolPageShell";
import { cn } from "@/lib/utils";
import { useAppLanguage, i18n, type AppLanguage } from "@/lib/i18n";
import { analysisHistoryGlobalScoreSummary } from "@/lib/analysis-history-global-summary";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";
import { buildAnalysisThumbnailUrl, type AnalysisHistoryItem } from "@/lib/face-analysis";
import { buildAnalysisViewHref } from "@/lib/analysis-view-href";
import { countUniqueSurfacedRecommendationsForHistoryJob } from "@/lib/critical-points";
import {
  normaliseRecommendationRow,
  type Recommendation,
} from "@/lib/recommendations";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useAnalysisHistory } from "@/hooks/use-supabase";
import {
  educationalDisclaimerI18n,
  educationalDisclaimerNoticeClassName,
  educationalDisclaimerWrapperClassName,
} from "@/lib/educational-disclaimer";

const recommendationsPageTitleI18n = {
  en: "Recommendations",
  fr: "Recommandations",
} as const;

function formatHistoryDate(iso: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function analysisJobSortKey(a: AnalysisHistoryItem): number {
  const t = a.completed_at ?? a.created_at;
  return new Date(t).getTime();
}

export default function ProtocolRecommendationsPage() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const search = useSearch();
  const userId = user?.id ?? null;

  const historyQuery = useAnalysisHistory({ enabled: !!userId });

  const completedAnalyses = React.useMemo(() => {
    const rows = historyQuery.data ?? [];
    return rows
      .filter(
        (a) =>
          a.status === "completed" &&
          Array.isArray(a.results) &&
          a.results.length > 0,
      )
      .sort((a, b) => analysisJobSortKey(b) - analysisJobSortKey(a));
  }, [historyQuery.data]);

  const unionWorkers = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of completedAnalyses) {
      for (const r of a.results) s.add(r.worker);
    }
    return Array.from(s);
  }, [completedAnalyses]);

  const recQueries = useQueries({
    queries: unionWorkers.map((worker) => ({
      queryKey: ["recommendations", worker],
      queryFn: async (): Promise<Recommendation[]> => {
        const { data, error } = await supabase
          .from("scoremax_recommendations")
          .select("*")
          .eq("worker", worker)
          .eq("enabled", true)
          .order("priority", { ascending: false });
        if (error) throw error;
        return (data ?? []).map(normaliseRecommendationRow);
      },
      staleTime: 1000 * 60 * 30,
    })),
  });

  const recDataSignature = recQueries.map((q) => q.dataUpdatedAt ?? 0).join("|");

  const recommendationsByWorker = React.useMemo(() => {
    const m = new Map<string, Recommendation[]>();
    unionWorkers.forEach((w, i) => {
      m.set(w, recQueries[i]?.data ?? []);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unionWorkers.join("|"), recDataSignature]);

  const recsLoading = recQueries.some((q) => q.isLoading);
  const recFirstError = recQueries.find((q) => q.error)?.error as Error | undefined;

  const isLoading = historyQuery.isLoading || (unionWorkers.length > 0 && recsLoading);
  const loadError = historyQuery.error ?? recFirstError;

  if (isLoading) {
    const loadingLabel = i18n(language, {
      en: "Loading…",
      fr: "Chargement…",
    });
    return (
      <ProtocolPageShell
        topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
        header={
          <h1 className={cn(protocolPageTitleClassName, "text-center")}>
            {i18n(language, recommendationsPageTitleI18n)}
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

  if (loadError) {
    return (
      <ProtocolPageShell
        topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
        header={
          <h1 className={cn(protocolPageTitleClassName, "text-center")}>
            {i18n(language, recommendationsPageTitleI18n)}
          </h1>
        }
      >
        <Card className="border-rose-200 bg-rose-50/90 text-rose-950 shadow-none">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-900">
                {i18n(language, {
                  en: "Couldn't load data.",
                  fr: "Impossible de charger les données.",
                })}
              </p>
              <p className="mt-1 text-xs text-rose-800/90">{(loadError as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      </ProtocolPageShell>
    );
  }

  const locale = language === "fr" ? "fr" : "en";
  const empty = completedAnalyses.length === 0;

  return (
    <ProtocolPageShell
      topNav={<ProtocolHubNavTabs language={language} active="recommendations" />}
      header={
        <h1 className={cn(protocolPageTitleClassName, "text-center")}>
          {i18n(language, recommendationsPageTitleI18n)}
        </h1>
      }
    >
      <div className="space-y-5">
        {empty ? (
          <Card className="border-white/12 bg-white/[0.06] text-zinc-100 shadow-none">
            <CardContent className="space-y-2 p-6 text-center text-sm text-zinc-300">
              <p className="font-display text-lg font-semibold text-white">
                {i18n(language, {
                  en: "No completed analysis yet",
                  fr: "Aucune analyse terminée",
                })}
              </p>
              <p className="text-zinc-400">
                {i18n(language, {
                  en: "When you have a finished analysis, it will appear here. Tap to open it on the Recommendations tab.",
                  fr: "Dès qu’une analyse est terminée, elle apparaît ici. Touche pour l’ouvrir sur l’onglet Recommandations.",
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {completedAnalyses.map((analysis) => {
              const href = buildAnalysisViewHref(analysis.id, search, "recommendations");
              const { score0to100, rankTitle } = analysisHistoryGlobalScoreSummary(
                analysis.results,
              );
              const dateIso = analysis.completed_at ?? analysis.created_at;
              const dateLabel = formatHistoryDate(dateIso, language);
              const recCount = countUniqueSurfacedRecommendationsForHistoryJob({
                results: analysis.results,
                recommendationsByWorker,
                locale,
              });
              const recLabel =
                recCount === 1
                  ? i18n(language, {
                      en: "1 recommendation offered",
                      fr: "1 recommandation proposée",
                    })
                  : i18n(language, {
                      en: `${recCount} recommendations offered`,
                      fr: `${recCount} recommandations proposées`,
                    });

              return (
                <Link
                  key={analysis.id}
                  href={href}
                  aria-label={i18n(language, {
                    en: `Open analysis from ${dateLabel}: ${rankTitle ?? "Recommendations tab"}`,
                    fr: `Ouvrir l'analyse du ${dateLabel} : ${rankTitle ?? "onglet Recommandations"}`,
                  })}
                  className={cn(
                    "group flex flex-wrap items-center gap-4 rounded-xl border border-white/12 bg-white/[0.055] px-4 py-4 transition",
                    "hover:border-white/22 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                  )}
                >
                  <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-lg border border-white/12 bg-black/25">
                    {analysis.has_thumbnail && userId ? (
                      <AuthenticatedThumbnail
                        src={buildAnalysisThumbnailUrl({
                          userId,
                          jobId: analysis.id,
                        })}
                        alt=""
                        className="h-full w-full object-cover [transform:scaleX(-1)]"
                        fallback={
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                            —
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                        —
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-display text-sm font-semibold leading-snug text-zinc-100 line-clamp-2">
                      {rankTitle ??
                        i18n(language, { en: "Analysis", fr: "Analyse" })}
                    </p>
                    <p className="text-xs tabular-nums text-zinc-300">{dateLabel}</p>
                    <p className="text-base font-semibold leading-snug text-red-500 sm:text-[1.0625rem]">
                      {recLabel}
                    </p>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    {score0to100 !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <MiniRing
                          score={score0to100}
                          scale={100}
                          size={52}
                          fractionDigits={1}
                        />
                        <span className="text-[10px] font-medium tabular-nums text-zinc-500">
                          {score0to100.toFixed(1)}/100
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500 opacity-70 transition group-hover:opacity-100 group-hover:text-zinc-200" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className={educationalDisclaimerWrapperClassName}>
          <p className={educationalDisclaimerNoticeClassName}>
            {i18n(language, educationalDisclaimerI18n)}
          </p>
        </div>
      </div>
    </ProtocolPageShell>
  );
}
