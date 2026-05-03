import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
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
  /**
   * Items with no slot at all and a `duration_value` set — surfaced under
   * "Active cures" with their elapsed/remaining time computed.
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
      for (const slot of slots) {
        const bucket = bySlot.get(slot) ?? [];
        bucket.push(item);
        bySlot.set(slot, bucket);
      }
      continue;
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
    cures,
    uncategorised,
    total: items.length,
  };
}

/* ============================================================================
 * Hook: load every saved recommendation for the current user
 * ========================================================================= */

type RawJoinedRow = RecommendationAction & {
  recommendation: unknown;
};

/**
 * Loads ALL items the current user has added to their protocol, regardless of
 * which analysis they came from. The recommendation row is joined in via the
 * FK declared in the schema (`recommendation_id → scoremax_recommendations.id`).
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
        .eq("status", "saved")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as RawJoinedRow[];

      const items: ProtocolItem[] = [];
      for (const row of rows) {
        if (!row.recommendation) continue;
        const { recommendation: rawRec, ...action } = row;
        const recommendation = normaliseRecommendationRow(rawRec);
        items.push({
          recommendation,
          action: action as RecommendationAction,
        });
      }

      return items;
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
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
