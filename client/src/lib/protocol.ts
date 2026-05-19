import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchAnalysisHistory,
  type AnalysisHistoryItem,
} from "@/lib/face-analysis";
import {
  matchRecommendations,
  normaliseRecommendationRow,
  type Recommendation,
  type RecommendationAction,
} from "@/lib/recommendations";
import {
  DAILY_SLOTS,
  PROTOCOL_SLOTS,
  type ProtocolSlot,
} from "@/lib/protocol-slots";

/* ============================================================================
 * Types
 * ========================================================================= */

/**
 * A single item the user has placed in their protocol — the recommendation
 * itself plus the engagement metadata that lets us order/surface it.
 */
export interface ProtocolItem {
  recommendation: Recommendation;
  action: RecommendationAction;
}

export interface ProtocolBreakdown {
  /** Items grouped per slot (only slots with at least 1 item are present). */
  bySlot: Map<ProtocolSlot, ProtocolItem[]>;
  /** Items explicitly meant to be removed/avoided. */
  avoid: ProtocolItem[];
  /**
   * Items with no slot at all and a `duration_value` set — rendered in the
   * Routine daily block with elapsed / remaining progress (formerly a separate cures section).
   */
  cures: ProtocolCure[];
  /**
   * Items the user added that have neither slots nor a duration. These are
   * surfaced as "uncategorised" so nothing the user saved ever silently
   * disappears from their plan.
   */
  uncategorised: ProtocolItem[];
  total: number;
}

export interface ProtocolCure extends ProtocolItem {
  /** Days since the user added the rec to their protocol. */
  elapsedDays: number;
  /**
   * Total length of the cure in days, derived from duration_value/unit. Null
   * when the unit is `permanent` or `session` (intrinsically open-ended).
   */
  totalDays: number | null;
  /** 0..1 progress ratio. Null when totalDays is null. */
  progress: number | null;
}

/* ============================================================================
 * Pure builders
 * ========================================================================= */

const DAYS_PER_UNIT: Partial<
  Record<NonNullable<Recommendation["duration_unit"]>, number>
> = {
  days: 1,
  weeks: 7,
  months: 30,
};

function durationToDays(rec: Recommendation): number | null {
  if (rec.duration_value === null || rec.duration_unit === null) return null;
  const factor = DAYS_PER_UNIT[rec.duration_unit];
  if (!factor) return null;
  return rec.duration_value * factor;
}

function daysBetween(fromIso: string, nowMs: number): number {
  const fromMs = new Date(fromIso).getTime();
  if (!Number.isFinite(fromMs)) return 0;
  const diff = nowMs - fromMs;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/**
 * Pure: takes the joined rows and produces the structured breakdown the
 * Protocol page renders. No React, no I/O — easy to unit test.
 */
export function buildProtocolBreakdown(
  items: ProtocolItem[],
  now: Date = new Date(),
): ProtocolBreakdown {
  const bySlot = new Map<ProtocolSlot, ProtocolItem[]>();
  const avoid: ProtocolItem[] = [];
  const cures: ProtocolCure[] = [];
  const uncategorised: ProtocolItem[] = [];
  const nowMs = now.getTime();

  // Sort items by recency (most recently added first) for stable display
  // inside each slot bucket.
  const sorted = [...items].sort((a, b) => {
    const ta = new Date(a.action.updated_at).getTime();
    const tb = new Date(b.action.updated_at).getTime();
    return tb - ta;
  });

  for (const item of sorted) {
    const slots = item.recommendation.protocol_slots;

    if (slots.length > 0) {
      let routed = false;
      if (slots.includes("avoid")) {
        avoid.push(item);
        routed = true;
      }

      for (const slot of slots) {
        if (slot === "avoid") continue;
        const bucket = bySlot.get(slot) ?? [];
        bucket.push(item);
        bySlot.set(slot, bucket);
        routed = true;
      }
      if (routed) continue;
    }

    const totalDays = durationToDays(item.recommendation);
    const hasDuration =
      item.recommendation.duration_value !== null &&
      item.recommendation.duration_unit !== null;

    if (hasDuration) {
      const elapsedDays = daysBetween(item.action.created_at, nowMs);
      const progress =
        totalDays !== null && totalDays > 0
          ? Math.min(1, elapsedDays / totalDays)
          : null;
      cures.push({
        ...item,
        elapsedDays,
        totalDays,
        progress,
      });
    } else {
      uncategorised.push(item);
    }
  }

  return {
    bySlot,
    avoid,
    cures,
    uncategorised,
    total: items.length,
  };
}

/* ============================================================================
 * Hook: load active protocol recommendations for the current user
 * ========================================================================= */

type RawJoinedRow = RecommendationAction & {
  recommendation: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function latestCompletedAnalysis(
  history: AnalysisHistoryItem[],
): AnalysisHistoryItem | null {
  const completed = history
    .filter((a) => a.status === "completed" && a.results.length > 0)
    .sort((a, b) => {
      const ta = new Date(a.completed_at ?? a.created_at).getTime();
      const tb = new Date(b.completed_at ?? b.created_at).getTime();
      return tb - ta;
    });
  return completed[0] ?? null;
}

function outputAggregatesFromHistoryResult(
  result: Record<string, unknown>,
): Record<string, unknown> {
  return isRecord(result.outputAggregates) ? result.outputAggregates : {};
}

function activeActionStatus(status: RecommendationAction["status"]): boolean {
  return status !== "dismissed";
}

function defaultRecommendationAction(
  userId: string,
  recommendation: Recommendation,
  timestamp: string,
): RecommendationAction {
  return {
    id: `default:${recommendation.id}`,
    user_id: userId,
    recommendation_id: recommendation.id,
    worker: recommendation.worker,
    status: "saved",
    notes: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

async function fetchHistoryForProtocol(userId: string): Promise<AnalysisHistoryItem[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return [];

  return fetchAnalysisHistory(userId, {
    Authorization: `Bearer ${token}`,
  });
}

async function fetchDefaultProtocolItems(params: {
  userId: string;
  actionsByRecommendationId: Map<string, ProtocolItem>;
  dismissedRecommendationIds: ReadonlySet<string>;
}): Promise<ProtocolItem[]> {
  const history = await fetchHistoryForProtocol(params.userId);
  const latest = latestCompletedAnalysis(history);
  if (!latest) return [];

  const workers = Array.from(new Set(latest.results.map((row) => row.worker)));
  if (workers.length === 0) return [];

  const { data, error } = await supabase
    .from("scoremax_recommendations")
    .select("*")
    .in("worker", workers)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (error) throw error;

  const recommendationsByWorker = new Map<string, Recommendation[]>();
  for (const raw of data ?? []) {
    const rec = normaliseRecommendationRow(raw);
    const bucket = recommendationsByWorker.get(rec.worker) ?? [];
    bucket.push(rec);
    recommendationsByWorker.set(rec.worker, bucket);
  }

  const timestamp = latest.completed_at ?? latest.created_at;
  const defaults: ProtocolItem[] = [];
  for (const row of latest.results) {
    const aggregates = outputAggregatesFromHistoryResult(row.result);
    const recommendations = recommendationsByWorker.get(row.worker) ?? [];
    const matched = matchRecommendations(recommendations, aggregates);

    for (const recommendation of matched) {
      if (params.dismissedRecommendationIds.has(recommendation.id)) continue;
      const explicit = params.actionsByRecommendationId.get(recommendation.id);
      if (explicit) continue;

      defaults.push({
        recommendation,
        action: defaultRecommendationAction(
          params.userId,
          recommendation,
          timestamp,
        ),
      });
    }
  }

  return defaults;
}

/**
 * Loads the protocol as an opt-out model:
 * - matched latest-analysis recommendations are active by default;
 * - explicit `saved`/`done`/`in_progress` actions remain active;
 * - explicit `dismissed` actions hide the recommendation.
 */
export function useUserProtocol() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ProtocolItem[]>({
    queryKey: ["user-protocol", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("scoremax_recommendation_actions")
        .select(
          `
            *,
            recommendation:scoremax_recommendations!inner(*)
          `,
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as RawJoinedRow[];

      const itemsByRecommendationId = new Map<string, ProtocolItem>();
      const dismissedRecommendationIds = new Set<string>();
      for (const row of rows) {
        if (!row.recommendation) continue;
        const { recommendation: rawRec, ...action } = row;
        const typedAction = action as RecommendationAction;
        const recommendation = normaliseRecommendationRow(rawRec);
        if (!activeActionStatus(typedAction.status)) {
          dismissedRecommendationIds.add(recommendation.id);
          continue;
        }
        itemsByRecommendationId.set(recommendation.id, {
          recommendation,
          action: typedAction,
        });
      }

      const defaults = await fetchDefaultProtocolItems({
        userId,
        actionsByRecommendationId: itemsByRecommendationId,
        dismissedRecommendationIds,
      }).catch(() => []);

      for (const item of defaults) {
        itemsByRecommendationId.set(item.recommendation.id, item);
      }

      return Array.from(itemsByRecommendationId.values());
    },
    enabled: !!userId,
    refetchOnMount: true,
    staleTime: 1000 * 10,
  });
}

/* ============================================================================
 * Convenience wrapper: loaded items + breakdown in one shot
 * ========================================================================= */

export interface UseProtocolBreakdownResult extends ProtocolBreakdown {
  items: ProtocolItem[];
  isLoading: boolean;
  error: Error | null;
}

export function useProtocolBreakdown(): UseProtocolBreakdownResult {
  const query = useUserProtocol();

  return useMemo(() => {
    const items = query.data ?? [];
    const breakdown = buildProtocolBreakdown(items);
    return {
      ...breakdown,
      items,
      isLoading: query.isLoading,
      error: (query.error as Error | null) ?? null,
    };
  }, [query.data, query.isLoading, query.error]);
}

/* ============================================================================
 * Tiny helpers used by the UI
 * ========================================================================= */

/** Returns the slot codes that should appear under the "Today" header. */
export function dailyTimelineSlots(): readonly ProtocolSlot[] {
  return DAILY_SLOTS;
}

/** Returns every slot code in canonical order. */
export function allProtocolSlots(): readonly ProtocolSlot[] {
  return PROTOCOL_SLOTS;
}
