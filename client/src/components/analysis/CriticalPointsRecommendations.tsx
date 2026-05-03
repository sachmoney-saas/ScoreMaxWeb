import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Syringe,
  TrendingDown,
} from "lucide-react";

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
import { analysisSurfaceCardClassName } from "@/components/analysis/workers/_shared";
import { cn } from "@/lib/utils";
import { RecommendationCard } from "@/components/analysis/recommendations/RecommendationCard";

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

function scoreBadgeClasses(score: number): string {
  if (score < 3.5)
    return "bg-rose-500/15 text-rose-200 ring-rose-300/30";
  if (score < 5.5)
    return "bg-orange-500/15 text-orange-200 ring-orange-300/30";
  return "bg-amber-400/15 text-amber-200 ring-amber-300/25";
}

function scoreSeverityLabel(
  score: number,
  language: AppLanguage,
): string {
  if (score < 3.5)
    return i18n(language, { en: "Critical", fr: "Critique" });
  if (score < 5.5)
    return i18n(language, { en: "Important", fr: "Important" });
  return i18n(language, { en: "To improve", fr: "À améliorer" });
}

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

function scoreHeroAccentBorder(score: number): string {
  if (score < 3.5) return "border-l-rose-400/75";
  if (score < 5.5) return "border-l-orange-400/70";
  return "border-l-amber-300/60";
}

/* ============================================================================
 * Section: a single critical point + its recommendations
 * ========================================================================= */

function CriticalPointSection({
  index,
  point,
  language,
  actionByRec,
  buildWorkerHref,
  suppressWorkerEyebrow = false,
}: {
  index: number;
  point: CriticalPoint;
  language: AppLanguage;
  actionByRec: Map<string, RecommendationAction>;
  buildWorkerHref: (worker: string) => string;
  /** When the parent tab is already scoped to this worker, hide the duplicate worker link chip. */
  suppressWorkerEyebrow?: boolean;
}) {
  const aggregates = React.useMemo<Record<string, unknown>>(() => ({}), []);
  // ^ Aggregates here are only used by RecommendationCard for the "why" copy.
  // We feed empty so the card renders the soft fallback ("Reinforces this area
  // of your face."), which is fine because the parent header already pins the
  // exact aggregate label and score in much bigger type.

  const soft = point.matchedRecommendations.filter((r) => r.type === "soft");
  const hard = point.matchedRecommendations.filter((r) => r.type === "hard");

  const recCount = point.matchedRecommendations.length;

  return (
    <section className="space-y-6">
      {/* Priority: diagnostic (score + argument), then how-to below */}
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "rounded-2xl border-white/15 border-l-[4px] pl-4 pr-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:pl-5 sm:pr-5 sm:py-6 md:pl-6 md:pr-6",
          scoreHeroAccentBorder(point.score),
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_100%_0%,rgba(255,255,255,0.07),transparent_55%)]"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-display text-xs font-bold tabular-nums text-zinc-200 ring-1 ring-white/10">
                {index + 1}
              </span>
              {suppressWorkerEyebrow ? null : (
                <Link
                  href={buildWorkerHref(point.worker)}
                  className="group inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-white"
                >
                  {getWorkerDisplayLabel(
                    point.worker,
                    language === "fr" ? "fr" : "en",
                  )}
                  <ArrowUpRight className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                </Link>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {i18n(language, {
                  en: "Focus on this measure",
                  fr: "Axe à travailler",
                })}
              </p>
              <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.65rem] sm:leading-[1.15]">
                {point.aggregateLabel}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">
                {scoreSeverityBlurb(point.score, language)}
              </p>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:max-w-[13.5rem]">
            <div
              className={`rounded-xl px-4 py-4 ring-1 ring-inset sm:px-5 sm:py-5 ${scoreBadgeClasses(point.score)}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                {i18n(language, { en: "Your score", fr: "Ta note" })}
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-1 font-display tabular-nums">
                <span className="text-4xl font-bold tracking-tight text-white sm:text-[2.65rem]">
                  {point.score.toFixed(1)}
                </span>
                <span className="text-lg font-medium text-white/50">/10</span>
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <TrendingDown className="h-3.5 w-3.5 shrink-0 opacity-90" />
                <span>{scoreSeverityLabel(point.score, language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/5 pt-4">
          <h4 className="font-display text-sm font-semibold tracking-tight text-white">
            {i18n(language, {
              en: "How to improve",
              fr: "Comment progresser",
            })}
          </h4>
          <span className="text-xs text-zinc-500">
            {recCount}{" "}
            {i18n(language, {
              en:
                recCount > 1
                  ? "actionable recommendations"
                  : "actionable recommendation",
              fr:
                recCount > 1
                  ? "recommandations actionnables"
                  : "recommandation actionnable",
            })}
          </span>
        </div>

      {soft.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
              <Sparkles className="h-3 w-3" />
              {i18n(language, { en: "Softmaxxing", fr: "Softmaxxing" })}
            </span>
            <span className="text-[11px] text-zinc-500">
              {soft.length}{" "}
              {i18n(language, { en: "actions", fr: "actions" })}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {soft.map((rec) => (
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

      {hard.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200 ring-1 ring-inset ring-rose-300/20">
              <Syringe className="h-3 w-3" />
              {i18n(language, { en: "Hardmaxxing", fr: "Hardmaxxing" })}
            </span>
            <span className="text-[11px] text-zinc-500">
              {hard.length}{" "}
              {i18n(language, { en: "interventions", fr: "interventions" })}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {hard.map((rec) => (
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
}: {
  worker: string;
  orphans: OrphanRecommendations[];
  language: AppLanguage;
  actionByRec: Map<string, RecommendationAction>;
  resultsByWorker: Map<string, Record<string, unknown>>;
}) {
  const group = orphans.find((o) => o.worker === worker);
  if (!group?.recommendations.length) return null;

  return (
    <section className="mt-8 space-y-3 border-t border-white/5 pt-8">
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {i18n(language, { en: "Also matches you", fr: "Autres pistes" })}
        </p>
        <p className="text-xs text-zinc-400">
          {i18n(language, {
            en: "Suggestions linked to your profile but not pinned to one measure above.",
            fr: "Suggestions liées à ton profil, sans lien avec une mesure ci-dessus.",
          })}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {group.recommendations.map((rec: MatchedRecommendation) => (
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

function WorkerDetailLink({
  worker,
  language,
  buildWorkerHref,
}: {
  worker: string;
  language: AppLanguage;
  buildWorkerHref: (w: string) => string;
}) {
  const label = getWorkerDisplayLabel(
    worker,
    language === "fr" ? "fr" : "en",
  );
  return (
    <div className="mb-6">
      <Link
        href={buildWorkerHref(worker)}
        className="group inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
      >
        {i18n(language, {
          en: `See full · ${label} analysis`,
          fr: `Voir l'analyse complète · ${label}`,
        })}
        <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
    </div>
  );
}

/* ============================================================================
 * Section: orphans — recos that matched but don't tie to a critical point
 * ========================================================================= */

/* ============================================================================
 * Section: workers awaiting editorial content
 * ========================================================================= */

function ComingSoonSection({
  workers,
  language,
}: {
  workers: string[];
  language: AppLanguage;
}) {
  if (workers.length === 0) return null;

  return (
    <section
      className={cn(
        analysisSurfaceCardClassName,
        "rounded-2xl border border-dashed border-white/15 p-4",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {i18n(language, { en: "Coming soon", fr: "Bientôt disponible" })}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        {i18n(language, {
          en: "Editorial recommendations are being written for: ",
          fr: "Les recommandations éditoriales arrivent pour : ",
        })}
        <span className="text-zinc-300">
          {workers
            .map((w) =>
              getWorkerDisplayLabel(w, language === "fr" ? "fr" : "en"),
            )
            .join(", ")}
        </span>
        .
      </p>
    </section>
  );
}

/* ============================================================================
 * Public component
 * ========================================================================= */

export function CriticalPointsRecommendations({
  analysisJobId,
  results,
  language,
  scoreThreshold,
  maxPoints,
}: CriticalPointsRecommendationsProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

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

  const buildWorkerHref = React.useCallback(
    (worker: string) =>
      `/app/analyses/${analysisJobId}/workers/${encodeURIComponent(worker)}`,
    [analysisJobId],
  );

  // `dataUpdatedAt` changes any time react-query refreshes a query, giving us
  // a cheap, stable string signature to gate the memoized computations below.
  const recDataSignature = recQueries
    .map((q) => q.dataUpdatedAt ?? 0)
    .join("|");
  const actionDataSignature = actionQueries
    .map((q) => q.dataUpdatedAt ?? 0)
    .join("|");

  const { workerGroupsOrdered, orphans, workersAwaitingContent } =
    React.useMemo(() => {
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
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "flex items-center justify-center gap-2 rounded-2xl p-12 text-sm text-zinc-300",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {i18n(language, {
          en: "Loading recommendations…",
          fr: "Chargement des recommandations…",
        })}
      </div>
    );
  }

  if (firstError) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "flex items-start gap-3 rounded-2xl p-6 text-sm text-rose-200",
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">
            {i18n(language, {
              en: "Couldn't load recommendations.",
              fr: "Impossible de charger les recommandations.",
            })}
          </p>
          <p className="mt-1 text-xs text-rose-200/85">{firstError.message}</p>
        </div>
      </div>
    );
  }

  // No critical points and no orphans → encourage state, but only if at least
  // one worker has editorial content (otherwise the "coming soon" card carries
  // the message on its own).
  const hasAnyContent = hasAnyCritical || orphanTotal > 0;
  const hasContentInDb =
    workers.length - workersAwaitingContent.length > 0;

  if (!hasAnyContent && hasContentInDb) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "space-y-2 rounded-2xl p-6 text-sm",
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
            en: "Your scores are healthy across the board — keep your routine consistent.",
            fr: "Tes scores sont sains dans l'ensemble — garde ta routine régulière.",
          })}
        </p>
        <ComingSoonSection
          workers={workersAwaitingContent}
          language={language}
        />
      </div>
    );
  }

  if (!hasAnyContent && !hasContentInDb) {
    return (
      <div
        className={cn(
          analysisSurfaceCardClassName,
          "space-y-3 rounded-2xl p-6 text-sm",
        )}
      >
        <p className="font-display text-lg font-semibold text-white">
          {i18n(language, {
            en: "Recommendations coming soon",
            fr: "Recommandations bientôt disponibles",
          })}
        </p>
        <p className="text-zinc-400">
          {i18n(language, {
            en: "We're writing personalised recommendations for every ScoreMax worker. The eyes module is already live; the rest is on its way.",
            fr: "Nous rédigeons des recommandations personnalisées pour chaque worker ScoreMax. Le module yeux est déjà en ligne ; le reste arrive.",
          })}
        </p>
        <ComingSoonSection
          workers={workersAwaitingContent}
          language={language}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */

  return (
    <div className="relative space-y-10">
        {visibleWorkerGroups.length > 0 ? (
          <Tabs
            defaultValue={visibleWorkerGroups[0]?.worker}
            key={`${analysisJobId}:${visibleWorkerGroups.map((g) => g.worker).join("|")}`}
            className="space-y-6"
          >
            <TabsList
              className={cn(
                analysisSurfaceCardClassName,
                "inline-flex h-auto max-h-[none] min-h-[2.75rem] w-full flex-wrap justify-start gap-1.5 rounded-2xl p-1.5 sm:flex-nowrap",
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
                    className="rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-400 shadow-none hover:text-zinc-200 data-[state=active]:bg-slate-950 data-[state=active]:text-white sm:px-4 sm:text-sm"
                  >
                    <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
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

            {visibleWorkerGroups.map((group) => (
              <TabsContent
                key={group.worker}
                value={group.worker}
                className="mt-0 space-y-10"
              >
                <WorkerDetailLink
                  worker={group.worker}
                  language={language}
                  buildWorkerHref={buildWorkerHref}
                />
                {group.criticalPoints.length === 0 ? (
                  <p
                    className={cn(
                      analysisSurfaceCardClassName,
                      "rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-zinc-400",
                    )}
                  >
                    {i18n(language, {
                      en: "No single measure surfaced as critical here — see matching suggestions below if any.",
                      fr: "Aucune mesure ressort comme critique dans cette zone — voir les suggestions ci-dessous le cas échéant.",
                    })}
                  </p>
                ) : null}
                {group.criticalPoints.map((point, idx) => (
                  <CriticalPointSection
                    key={`${point.worker}:${point.aggregateKey}`}
                    index={idx}
                    point={point}
                    language={language}
                    actionByRec={actionByRec}
                    buildWorkerHref={buildWorkerHref}
                    suppressWorkerEyebrow
                  />
                ))}
                <WorkerOrphansUnderTab
                  worker={group.worker}
                  orphans={orphans}
                  language={language}
                  actionByRec={actionByRec}
                  resultsByWorker={resultsByWorker}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : null}

        <ComingSoonSection
          workers={workersAwaitingContent}
          language={language}
        />

      <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-zinc-400">
        {i18n(language, {
          en: "Educational content only — not medical advice. Hard interventions require a qualified professional.",
          fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Les interventions hard nécessitent un professionnel qualifié.",
        })}
      </p>
    </div>
  );
}
