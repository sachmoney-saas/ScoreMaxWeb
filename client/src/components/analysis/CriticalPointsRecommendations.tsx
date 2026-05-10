import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Sparkles, Syringe } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { getWorkerDisplayLabel } from "@/lib/face-analysis-display";
import {
  buildCriticalPoints,
  type CriticalPoint,
  type OrphanRecommendations,
} from "@/lib/critical-points";
import {
  normaliseRecommendationRow,
  type MatchedRecommendation,
  type Recommendation,
  type RecommendationAction,
} from "@/lib/recommendations";
import { cn } from "@/lib/utils";
import { RecommendationCard } from "@/components/analysis/recommendations/RecommendationCard";
import {
  RecommendationDocumentProvider,
} from "@/components/analysis/recommendations/RecommendationDocumentContext";
import {
  recommendationsReportShellClassName,
  recommendationsReportHorizontalInsetClassName,
} from "@/components/analysis/recommendations/recommendations-report-theme";
import { MiniRing } from "@/components/analysis/WorkerPreviewContent";
import {
  analysisTabActiveMetallicTriggerClassName,
  analysisTabBarGlassClassName,
  hardmaxxingGradientPillClassName,
  scoreRingMatchMetallicPillClassName,
  softmaxxingGradientPillClassName,
} from "@/components/analysis/workers/_shared";

const RECOMMENDATIONS_TYPE_TOGGLE_BTN_BASE = cn(
  "relative rounded-xl border border-transparent px-4 py-2.5 text-left text-sm font-medium transition-colors sm:px-5",
  "data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:bg-white/[0.07] data-[state=inactive]:hover:text-zinc-300",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(14,20,26,0.96)]",
  "data-[state=active]:hover:brightness-[1.02]",
);

function RecommendationsTypeFilterBar({
  showSoft,
  showHard,
  onSoftChange,
  onHardChange,
  language,
}: {
  showSoft: boolean;
  showHard: boolean;
  onSoftChange: (next: boolean) => void;
  onHardChange: (next: boolean) => void;
  language: AppLanguage;
}) {
  const toggleSoft = () => {
    if (showSoft && !showHard) return;
    onSoftChange(!showSoft);
  };
  const toggleHard = () => {
    if (showHard && !showSoft) return;
    onHardChange(!showHard);
  };

  return (
    <div className="flex w-full justify-center px-2">
      <div
        className={cn(
          analysisTabBarGlassClassName,
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
            RECOMMENDATIONS_TYPE_TOGGLE_BTN_BASE,
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
            RECOMMENDATIONS_TYPE_TOGGLE_BTN_BASE,
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

const RECOMMENDATIONS_WORKER_TAB_TRIGGER_CLASS = cn(
  "relative z-0 rounded-xl border border-transparent px-4 py-2.5 text-left text-sm font-medium text-zinc-400 transition-all sm:px-5",
  "hover:text-zinc-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(14,20,26,0.96)]",
  analysisTabActiveMetallicTriggerClassName,
  "data-[state=active]:hover:text-zinc-950",
  "data-[state=active]:[&_span.font-display]:text-zinc-700 data-[state=active]:[&_span.font-display]:opacity-100",
);

/* ============================================================================
 * Types
 * ========================================================================= */

export interface CriticalPointsRecommendationsProps {
  analysisJobId: string;
  results: Array<{
    worker: string;
    outputAggregates: Record<string, unknown>;
  }>;
  language: AppLanguage;
  /** Score (0–10) above which an aggregate is no longer flagged. Default: 7. */
  scoreThreshold?: number;
  /** Hard cap on critical points displayed. Default: 8. */
  maxPoints?: number;
}

/* ============================================================================
 * Visual helpers
 * ========================================================================= */

/** One-line explanation paired with the score band (the “argument” under the note). */
function scoreSeverityBlurb(
  score: number,
  language: AppLanguage,
): string {
  if (score < 3.5) {
    return i18n(language, {
      en: "This criterion is a high-impact priority for your overall balance.",
      fr: "Ce critère est une priorité à fort impact pour ton équilibre global.",
    });
  }
  if (score < 5.5) {
    return i18n(language, {
      en: "There is substantial room to progress on this measure.",
      fr: "Il y a une marge de progression substantielle sur cette mesure.",
    });
  }
  return i18n(language, {
    en: "Refinements here still meaningfully polish your result.",
    fr: "Des affinements ici peaufinent encore ton résultat de façon notable.",
  });
}

/* ============================================================================
 * Section: a single critical point + its recommendations
 * ========================================================================= */

function CriticalPointSection({
  point,
  language,
  actionByRec,
  showSoftmaxxing,
  showHardmaxxing,
}: {
  point: CriticalPoint;
  language: AppLanguage;
  actionByRec: Map<string, RecommendationAction>;
  showSoftmaxxing: boolean;
  showHardmaxxing: boolean;
}) {
  const aggregates = React.useMemo<Record<string, unknown>>(() => ({}), []);

  const soft = point.matchedRecommendations.filter((r) => r.type === "soft");
  const hard = point.matchedRecommendations.filter((r) => r.type === "hard");

  const visibleSoft = showSoftmaxxing ? soft : [];
  const visibleHard = showHardmaxxing ? hard : [];

  return (
    <section className="space-y-6 border-b border-white/10 pb-10 last:border-b-0 last:pb-0">
      <div
        className={cn(
          scoreRingMatchMetallicPillClassName,
          "w-full rounded-xl px-5 py-5 sm:px-8 sm:py-7",
        )}
      >
        <div className="relative z-[1] flex w-full flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0 w-full flex-1 space-y-3 lg:max-w-none">
            <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-950 sm:text-[1.65rem] sm:leading-[1.15]">
              {point.aggregateLabel}
            </h3>
            <p className="w-full max-w-none text-sm leading-relaxed text-zinc-800">
              {scoreSeverityBlurb(point.score, language)}
            </p>
          </div>

          <div className="flex w-full shrink-0 items-center justify-center sm:justify-start lg:w-auto lg:justify-end">
            <MiniRing
              score={point.score}
              scale={10}
              size={80}
              fractionDigits={1}
              highlight="weakness"
              trackStroke="rgba(39,39,42,0.22)"
              centerFill="#09090b"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {(!showSoftmaxxing &&
          soft.length > 0 &&
          showHardmaxxing &&
          hard.length > 0) ||
        (!showHardmaxxing &&
          hard.length > 0 &&
          showSoftmaxxing &&
          soft.length > 0) ? (
          <p className="text-xs text-zinc-500">
            {i18n(language, {
              en: "Turn on the other mode above to see the hidden recommendations.",
              fr: "Active l’autre mode ci-dessus pour voir les recommandations masquées.",
            })}
          </p>
        ) : null}

      {visibleSoft.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-900 ring-1 ring-inset ring-emerald-200">
              <Sparkles className="h-3 w-3" />
              {i18n(language, { en: "Softmaxxing", fr: "Softmaxxing" })}
            </span>
            <span className="text-[11px] text-zinc-400">
              {visibleSoft.length}{" "}
              {i18n(language, { en: "actions", fr: "actions" })}
            </span>
          </div>
          <div className="grid w-full gap-4 md:grid-cols-2">
            {visibleSoft.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                worker={point.worker}
                aggregates={aggregates}
                language={language}
                action={actionByRec.get(rec.id)}
                hideReason
              />
            ))}
          </div>
        </div>
      ) : null}

      {visibleHard.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-950 ring-1 ring-inset ring-rose-200">
              <Syringe className="h-3 w-3" />
              {i18n(language, { en: "Hardmaxxing", fr: "Hardmaxxing" })}
            </span>
            <span className="text-[11px] text-zinc-400">
              {visibleHard.length}{" "}
              {i18n(language, { en: "interventions", fr: "interventions" })}
            </span>
          </div>
          <div className="grid w-full gap-4 md:grid-cols-2">
            {visibleHard.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                worker={point.worker}
                aggregates={aggregates}
                language={language}
                action={actionByRec.get(rec.id)}
                hideReason
              />
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </section>
  );
}

/** Orphan reco block shown under each worker tab (not a global footer). */
function WorkerOrphansUnderTab({
  worker,
  orphans,
  language,
  actionByRec,
  resultsByWorker,
  showSoftmaxxing,
  showHardmaxxing,
}: {
  worker: string;
  orphans: OrphanRecommendations[];
  language: AppLanguage;
  actionByRec: Map<string, RecommendationAction>;
  resultsByWorker: Map<string, Record<string, unknown>>;
  showSoftmaxxing: boolean;
  showHardmaxxing: boolean;
}) {
  const group = orphans.find((o) => o.worker === worker);
  if (!group?.recommendations.length) return null;

  const filtered = group.recommendations.filter(
    (rec: MatchedRecommendation) =>
      (showSoftmaxxing && rec.type === "soft") ||
      (showHardmaxxing && rec.type === "hard"),
  );
  if (filtered.length === 0) return null;

  return (
    <section
      className={cn(
        "mt-8 space-y-3 border-t border-white/10 pt-8",
        recommendationsReportHorizontalInsetClassName,
      )}
    >
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {i18n(language, { en: "Also matches you", fr: "Autres pistes" })}
        </p>
        <p className="text-xs text-zinc-300">
          {i18n(language, {
            en: "Suggestions linked to your profile but not pinned to one measure above.",
            fr: "Suggestions liées à ton profil, sans lien avec une mesure ci-dessus.",
          })}
        </p>
      </header>
      <div className="grid w-full gap-4 md:grid-cols-2">
        {filtered.map((rec: MatchedRecommendation) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            worker={group.worker}
            aggregates={resultsByWorker.get(group.worker) ?? {}}
            language={language}
            action={actionByRec.get(rec.id)}
          />
        ))}
      </div>
    </section>
  );
}


/* ============================================================================
 * Public component
 * ========================================================================= */

export function CriticalPointsRecommendations(
  props: CriticalPointsRecommendationsProps,
) {
  return (
    <RecommendationDocumentProvider>
      <CriticalPointsRecommendationsImpl {...props} />
    </RecommendationDocumentProvider>
  );
}

function CriticalPointsRecommendationsImpl({
  analysisJobId,
  results,
  language,
  scoreThreshold,
  maxPoints,
}: CriticalPointsRecommendationsProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [showSoftmaxxing, setShowSoftmaxxing] = React.useState(true);
  const [showHardmaxxing, setShowHardmaxxing] = React.useState(true);

  const workers = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of results) {
      if (!seen.has(r.worker)) {
        seen.add(r.worker);
        out.push(r.worker);
      }
    }
    return out;
  }, [results]);

  // Same query keys as `useWorkerRecommendations` / `useRecommendationActions`,
  // so the cache is shared with `<RecommendationsSection>` on the worker page.
  const recQueries = useQueries({
    queries: workers.map((worker) => ({
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

  const actionQueries = useQueries({
    queries: workers.map((worker) => ({
      queryKey: ["recommendation-actions", userId, worker],
      queryFn: async (): Promise<RecommendationAction[]> => {
        if (!userId) return [];
        const { data, error } = await supabase
          .from("scoremax_recommendation_actions")
          .select("*")
          .eq("user_id", userId)
          .eq("worker", worker);
        if (error) throw error;
        return (data ?? []) as RecommendationAction[];
      },
      enabled: !!userId,
      staleTime: 1000 * 30,
    })),
  });

  const isLoading = recQueries.some((q) => q.isLoading);
  const firstError = recQueries.find((q) => q.error)?.error as
    | Error
    | undefined;

  // a cheap, stable string signature to gate the memoized computations below.
  const recDataSignature = recQueries
    .map((q) => q.dataUpdatedAt ?? 0)
    .join("|");
  const actionDataSignature = actionQueries
    .map((q) => q.dataUpdatedAt ?? 0)
    .join("|");

  const { workerGroupsOrdered, orphans } = React.useMemo(() => {
    const inputs = workers.map((worker, idx) => ({
      worker,
      aggregates:
        results.find((r) => r.worker === worker)?.outputAggregates ?? {},
      recommendations: recQueries[idx]?.data ?? [],
    }));
    return buildCriticalPoints(inputs, {
      scoreThreshold,
      maxPoints,
      locale: language === "fr" ? "fr" : "en",
    });
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workers, results, recDataSignature, scoreThreshold, maxPoints, language],
  );

  const visibleWorkerGroups = React.useMemo(() => {
    return workerGroupsOrdered.filter((g) => {
      const n =
        orphans.find((o) => o.worker === g.worker)?.recommendations.length ?? 0;
      return g.criticalPoints.length > 0 || n > 0;
    });
  }, [workerGroupsOrdered, orphans]);

  const orphanTotal = orphans.reduce(
    (acc, o) => acc + o.recommendations.length,
    0,
  );
  const hasAnyCritical = workerGroupsOrdered.some(
    (g) => g.criticalPoints.length > 0,
  );

  const actionByRec = React.useMemo(() => {
    const map = new Map<string, RecommendationAction>();
    for (const q of actionQueries) {
      for (const a of q.data ?? []) map.set(a.recommendation_id, a);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionDataSignature]);

  const resultsByWorker = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of results) map.set(r.worker, r.outputAggregates);
    return map;
  }, [results]);

  /* ------------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className={recommendationsReportShellClassName}>
        <div
          className={cn(
            recommendationsReportHorizontalInsetClassName,
            "flex items-center justify-center gap-2 py-16 pt-8 text-sm text-zinc-300 sm:pt-10",
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          {i18n(language, {
            en: "Loading recommendations…",
            fr: "Chargement des recommandations…",
          })}
        </div>
      </div>
    );
  }

  if (firstError) {
    return (
      <div className={recommendationsReportShellClassName}>
        <div
          className={cn(
            recommendationsReportHorizontalInsetClassName,
            "flex items-start gap-3 py-6 pt-8 text-sm text-rose-200 sm:pt-10",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold text-rose-100">
              {i18n(language, {
                en: "Couldn't load recommendations.",
                fr: "Impossible de charger les recommandations.",
              })}
            </p>
            <p className="mt-1 text-xs text-rose-200/90">{firstError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyContent = hasAnyCritical || orphanTotal > 0;
  // At least one worker has recommendation rows in DB (vs all workers empty).
  const hasContentInDb = recQueries.some((q) => (q.data?.length ?? 0) > 0);

  if (!hasAnyContent && hasContentInDb) {
    return (
      <div className={recommendationsReportShellClassName}>
        <div
          className={cn(
            recommendationsReportHorizontalInsetClassName,
            "space-y-4 py-2 pt-8 text-sm sm:pt-10",
          )}
        >
          <p className="font-display text-lg font-semibold text-zinc-50">
            {i18n(language, {
              en: "Nothing critical to address",
              fr: "Rien de critique à adresser",
            })}
          </p>
          <p className="text-zinc-300">
            {i18n(language, {
              en: "Your scores are healthy across the board — keep your routine consistent.",
              fr: "Tes scores sont sains dans l'ensemble — garde ta routine régulière.",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAnyContent && !hasContentInDb) {
    return (
      <div className={recommendationsReportShellClassName}>
        <div
          className={cn(
            recommendationsReportHorizontalInsetClassName,
            "space-y-4 py-2 pt-8 text-sm sm:pt-10",
          )}
        >
          <p className="font-display text-lg font-semibold text-zinc-50">
            {i18n(language, {
              en: "Recommendations coming soon",
              fr: "Recommandations bientôt disponibles",
            })}
          </p>
          <p className="text-zinc-300">
            {i18n(language, {
              en: "We're writing personalised recommendations for every ScoreMax worker. The eyes module is already live; the rest is on its way.",
              fr: "Nous rédigeons des recommandations personnalisées pour chaque worker ScoreMax. Le module yeux est déjà en ligne ; le reste arrive.",
            })}
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */

  return (
    <div className="relative space-y-10">
      {visibleWorkerGroups.length > 0 ? (
        <div className="space-y-5">
          <RecommendationsTypeFilterBar
            showSoft={showSoftmaxxing}
            showHard={showHardmaxxing}
            onSoftChange={setShowSoftmaxxing}
            onHardChange={setShowHardmaxxing}
            language={language}
          />
          <Tabs
            defaultValue={visibleWorkerGroups[0]?.worker}
            key={`${analysisJobId}:${visibleWorkerGroups.map((g) => g.worker).join("|")}`}
            className="space-y-5"
          >
          <div className="flex w-full justify-center">
            <TabsList
              className={cn(
                analysisTabBarGlassClassName,
                "inline-flex h-auto max-h-none min-h-[2.75rem] w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl p-1.5 text-zinc-300 sm:flex-nowrap",
              )}
            >
              {visibleWorkerGroups.map((group) => {
                const label = getWorkerDisplayLabel(
                  group.worker,
                  language === "fr" ? "fr" : "en",
                );
                const worst =
                  group.criticalPoints.length > 0
                    ? Math.min(...group.criticalPoints.map((p) => p.score))
                    : null;
                return (
                  <TabsTrigger
                    key={group.worker}
                    value={group.worker}
                    title={
                      worst !== null ? `${worst.toFixed(1)}/10` : undefined
                    }
                    className={RECOMMENDATIONS_WORKER_TAB_TRIGGER_CLASS}
                  >
                    <span className="relative z-10 flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="block max-w-[10rem] truncate sm:max-w-none">
                        {label}
                      </span>
                      {worst !== null ? (
                        <span className="font-display text-[10px] tabular-nums tracking-tight text-zinc-400 opacity-90">
                          {worst.toFixed(1)}
                        </span>
                      ) : null}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {visibleWorkerGroups.map((group) => (
            <TabsContent
              key={group.worker}
              value={group.worker}
              className="mt-0 focus-visible:outline-none"
            >
              <div className={recommendationsReportShellClassName}>
                <div className="w-full space-y-10">
                  {group.criticalPoints.length === 0 ? (
                    <p
                      className={cn(
                        recommendationsReportHorizontalInsetClassName,
                        "rounded-lg border border-dashed border-white/25 bg-white/[0.06] py-3 text-sm text-zinc-300",
                      )}
                    >
                      {i18n(language, {
                        en: "No single measure surfaced as critical here — see matching suggestions below if any.",
                        fr: "Aucune mesure ressort comme critique dans cette zone — voir les suggestions ci-dessous le cas échéant.",
                      })}
                    </p>
                  ) : null}
                  {group.criticalPoints.map((point) => (
                    <CriticalPointSection
                      key={`${point.worker}:${point.aggregateKey}`}
                      point={point}
                      language={language}
                      actionByRec={actionByRec}
                      showSoftmaxxing={showSoftmaxxing}
                      showHardmaxxing={showHardmaxxing}
                    />
                  ))}
                  <WorkerOrphansUnderTab
                    worker={group.worker}
                    orphans={orphans}
                    language={language}
                    actionByRec={actionByRec}
                    resultsByWorker={resultsByWorker}
                    showSoftmaxxing={showSoftmaxxing}
                    showHardmaxxing={showHardmaxxing}
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        </div>
      ) : null}

      <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-zinc-400">
        {i18n(language, {
          en: "Educational content only — not medical advice. Hard interventions require a qualified professional.",
          fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Les interventions hard nécessitent un professionnel qualifié.",
        })}
      </p>
    </div>
  );
}
