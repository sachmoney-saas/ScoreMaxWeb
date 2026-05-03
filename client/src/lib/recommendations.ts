import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  sanitizeProtocolSlots,
  type ProtocolSlot,
} from "@/lib/protocol-slots";

/* ============================================================================
 * Types — must mirror the SQL schema in supabase/recommendations_schema.sql
 * ========================================================================= */

export type RecommendationType = "soft" | "hard";

export type RecommendationCategory =
  | "habit"
  | "exercise"
  | "topical"
  | "nutrition"
  | "device"
  | "injectable"
  | "energy"
  | "surgery"
  | "device_clinical"
  | "cosmetic";

export type RecommendationRisk = "none" | "low" | "medium" | "high";

export type RecommendationEvidence = "community" | "studies" | "medical";

export type RecommendationDurationUnit =
  | "days"
  | "weeks"
  | "months"
  | "session"
  | "permanent";

export type RecommendationActionStatus =
  | "saved"
  | "dismissed"
  | "in_progress"
  | "done";

export type LocalisedString = { en: string; fr: string };

/**
 * Conditions DSL — kept intentionally minimal so the editorial team can author
 * matching rules in JSONB without writing JS. Mirrors the seed file syntax.
 */
export type Condition =
  | { all: true }
  | { score_lte: { key: string; value: number } }
  | { score_gte: { key: string; value: number } }
  | { enum_in: { key: string; values: string[] } }
  | { and: Condition[] }
  | { or: Condition[] };

export interface Recommendation {
  id: string;
  worker: string;
  type: RecommendationType;
  category: RecommendationCategory;
  priority: number;

  title_en: string;
  title_fr: string;
  summary_en: string;
  summary_fr: string;
  steps: LocalisedString[];

  duration_value: number | null;
  duration_unit: RecommendationDurationUnit | null;
  cost_min: number | null;
  cost_max: number | null;
  cost_currency: string | null;
  risk: RecommendationRisk;
  evidence: RecommendationEvidence;

  targets: string[];
  conditions: Condition;
  source_url: string | null;

  /**
   * Where this rec lives in the user "Mon protocole" view. Empty array means
   * the recommendation is treated as a one-shot/cure (surfaces under "Active
   * cures" only when the user adds it to their protocol).
   */
  protocol_slots: ProtocolSlot[];
}

export interface RecommendationAction {
  id: string;
  user_id: string;
  recommendation_id: string;
  worker: string;
  status: RecommendationActionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================================================================
 * Matching — pure functions, no React, fully testable
 * ========================================================================= */

function readNumber(
  aggregates: Record<string, unknown>,
  base: string,
): number | null {
  // Tolerates both `{base}.score` and a flat numeric `{base}` value, the same
  // way the worker views read scores via getScore() in workers/_shared.tsx.
  const candidates = [aggregates[`${base}.score`], aggregates[base]];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === "number" && Number.isFinite(first)) return first;
      if (typeof first === "string") {
        const parsed = Number(first.replace(",", "."));
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return null;
}

function readEnum(
  aggregates: Record<string, unknown>,
  key: string,
): string | null {
  const v = aggregates[key];
  if (typeof v === "string") {
    const trimmed = v.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function evaluateCondition(
  condition: Condition,
  aggregates: Record<string, unknown>,
): boolean {
  if ("all" in condition) return true;

  if ("score_lte" in condition) {
    const value = readNumber(aggregates, condition.score_lte.key);
    return value !== null && value <= condition.score_lte.value;
  }

  if ("score_gte" in condition) {
    const value = readNumber(aggregates, condition.score_gte.key);
    return value !== null && value >= condition.score_gte.value;
  }

  if ("enum_in" in condition) {
    const value = readEnum(aggregates, condition.enum_in.key);
    if (value === null) return false;
    return condition.enum_in.values
      .map((v) => v.toLowerCase())
      .includes(value);
  }

  if ("and" in condition) {
    return condition.and.every((c) => evaluateCondition(c, aggregates));
  }

  if ("or" in condition) {
    return condition.or.some((c) => evaluateCondition(c, aggregates));
  }

  return false;
}

/**
 * Bonus relevance for a recommendation given how far the targeted aggregates
 * are from "ideal" (lower scores → higher need for soft work; for hard work we
 * weight them more aggressively because they're decisive interventions).
 */
function relevanceBoost(
  rec: Recommendation,
  aggregates: Record<string, unknown>,
): number {
  if (rec.targets.length === 0) return 0;

  let totalGap = 0;
  let scoredTargets = 0;

  for (const key of rec.targets) {
    const score = readNumber(aggregates, key);
    if (score === null) continue;
    scoredTargets += 1;
    totalGap += Math.max(0, 8 - score); // 8 = "good" floor
  }

  if (scoredTargets === 0) return 0;

  const avgGap = totalGap / scoredTargets;
  return rec.type === "hard" ? avgGap * 6 : avgGap * 4;
}

export interface MatchedRecommendation extends Recommendation {
  relevance: number;
}

export function matchRecommendations(
  recommendations: Recommendation[],
  aggregates: Record<string, unknown>,
): MatchedRecommendation[] {
  return recommendations
    .filter((r) => evaluateCondition(r.conditions, aggregates))
    .map((r) => ({
      ...r,
      relevance: r.priority + relevanceBoost(r, aggregates),
    }))
    .sort((a, b) => b.relevance - a.relevance);
}

/* ============================================================================
 * Reason builder — used to display "why we recommend this for you"
 * ========================================================================= */

export interface ReasonFragment {
  key: string;
  score?: number | null;
  enumValue?: string | null;
  threshold?: number;
  comparator?: "lte" | "gte";
}

export function buildReasonFragments(
  rec: Recommendation,
  aggregates: Record<string, unknown>,
): ReasonFragment[] {
  const fragments: ReasonFragment[] = [];

  function walk(condition: Condition): void {
    if ("score_lte" in condition) {
      fragments.push({
        key: condition.score_lte.key,
        score: readNumber(aggregates, condition.score_lte.key),
        threshold: condition.score_lte.value,
        comparator: "lte",
      });
    } else if ("score_gte" in condition) {
      fragments.push({
        key: condition.score_gte.key,
        score: readNumber(aggregates, condition.score_gte.key),
        threshold: condition.score_gte.value,
        comparator: "gte",
      });
    } else if ("enum_in" in condition) {
      fragments.push({
        key: condition.enum_in.key,
        enumValue: readEnum(aggregates, condition.enum_in.key),
      });
    } else if ("and" in condition) {
      condition.and.forEach(walk);
    } else if ("or" in condition) {
      condition.or.forEach(walk);
    }
  }

  walk(rec.conditions);
  return fragments;
}

/* ============================================================================
 * Hooks — read recommendations + manage user actions
 * ========================================================================= */

/**
 * Normalises a raw recommendation row from Supabase, defending against rows
 * inserted before the `protocol_slots` column existed.
 */
export function normaliseRecommendationRow(row: unknown): Recommendation {
  const r = row as Recommendation & {
    protocol_slots?: unknown;
  };
  return {
    ...r,
    protocol_slots: sanitizeProtocolSlots(r.protocol_slots),
  };
}

export function useWorkerRecommendations(
  worker: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery<Recommendation[]>({
    queryKey: ["recommendations", worker],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("scoremax_recommendations")
        .select("*")
        .eq("worker", worker)
        .eq("enabled", true)
        .order("priority", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(normaliseRecommendationRow);
    },
    enabled: !!worker && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 30, // 30 min — editorial content rarely changes
  });
}

export function useRecommendationActions(worker: string | null) {
  const { user } = useAuth();

  return useQuery<RecommendationAction[]>({
    queryKey: ["recommendation-actions", user?.id, worker],
    queryFn: async () => {
      if (!user?.id || !worker) return [];
      const { data, error } = await supabase
        .from("scoremax_recommendation_actions")
        .select("*")
        .eq("user_id", user.id)
        .eq("worker", worker);

      if (error) throw error;
      return (data ?? []) as RecommendationAction[];
    },
    enabled: !!user?.id && !!worker,
    staleTime: 1000 * 30,
  });
}

export function useUpsertRecommendationAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      recommendationId: string;
      worker: string;
      status: RecommendationActionStatus;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("scoremax_recommendation_actions")
        .upsert(
          {
            user_id: user.id,
            recommendation_id: input.recommendationId,
            worker: input.worker,
            status: input.status,
            notes: input.notes ?? null,
          },
          { onConflict: "user_id,recommendation_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return data as RecommendationAction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["recommendation-actions", user?.id, variables.worker],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-protocol", user?.id],
      });
    },
  });
}

export function useDeleteRecommendationAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { recommendationId: string; worker: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("scoremax_recommendation_actions")
        .delete()
        .eq("user_id", user.id)
        .eq("recommendation_id", input.recommendationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["recommendation-actions", user?.id, variables.worker],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-protocol", user?.id],
      });
    },
  });
}

/* ============================================================================
 * Convenience: combined hook returning matched + grouped recommendations
 * ========================================================================= */

export interface GroupedRecommendations {
  soft: MatchedRecommendation[];
  hard: MatchedRecommendation[];
  /** Total enabled recs in the catalog for this worker (regardless of match). */
  totalAvailable: number;
  isLoading: boolean;
  error: Error | null;
}

export function useMatchedRecommendations(
  worker: string | null,
  aggregates: Record<string, unknown> | null,
): GroupedRecommendations {
  const query = useWorkerRecommendations(worker);

  return useMemo(() => {
    const recs = query.data ?? [];
    const aggs = aggregates ?? {};
    const matched = matchRecommendations(recs, aggs);
    return {
      soft: matched.filter((r) => r.type === "soft"),
      hard: matched.filter((r) => r.type === "hard"),
      totalAvailable: recs.length,
      isLoading: query.isLoading,
      error: (query.error as Error | null) ?? null,
    };
  }, [query.data, query.isLoading, query.error, aggregates]);
}
