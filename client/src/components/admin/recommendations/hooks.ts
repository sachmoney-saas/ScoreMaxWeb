/**
 * Hooks for the admin recommendations area.
 *
 * Kept separate from the public client hook (`useWorkerRecommendations`)
 * because admin reads bypass the `enabled = TRUE` filter, paginate
 * differently and trigger separate cache invalidation.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  evaluateCondition,
  type Condition,
  type Recommendation,
} from "@/lib/recommendations";

const ADMIN_KEY = ["admin-recommendations"] as const;

/* ------------------------------------------------------------------ Reads */

export function useAllAdminRecommendations() {
  const { isAdmin } = useAuth();
  return useQuery<Recommendation[]>({
    queryKey: [...ADMIN_KEY, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scoremax_recommendations")
        .select("*")
        .order("worker", { ascending: true })
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Recommendation[];
    },
    enabled: isAdmin,
    staleTime: 1000 * 30,
  });
}

export function useAdminWorkerRecommendations(worker: string | null) {
  const { isAdmin } = useAuth();
  return useQuery<Recommendation[]>({
    queryKey: [...ADMIN_KEY, "worker", worker],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("scoremax_recommendations")
        .select("*")
        .eq("worker", worker)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Recommendation[];
    },
    enabled: isAdmin && !!worker,
    staleTime: 1000 * 30,
  });
}

/* --------------------------------------------------- Recent analyses sample */

/**
 * Pulls a sample of recent analyses for one worker — used by the admin's
 * condition preview to show how many users would match a draft rule.
 *
 * We deliberately use the admin row itself; RLS already restricts to admins
 * via the `scoremax_is_admin` policy on `analysis_results`.
 */
export function useRecentWorkerAnalyses(
  worker: string | null,
  limit = 100,
) {
  const { isAdmin } = useAuth();
  return useQuery<Record<string, unknown>[]>({
    queryKey: [...ADMIN_KEY, "recent-analyses", worker, limit],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("analysis_results")
        .select("result")
        .eq("worker", worker)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as { result: unknown }[])
        .map((row) => extractAggregates(row.result))
        .filter((a): a is Record<string, unknown> => a !== null);
    },
    enabled: isAdmin && !!worker,
    staleTime: 1000 * 60 * 5,
  });
}

function extractAggregates(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const out = r.outputAggregates;
  return out && typeof out === "object" && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : null;
}

/**
 * Live preview: returns how many of the recent analyses match a given
 * condition. Pure client-side evaluation against the cached sample.
 */
export function useConditionPreview(
  worker: string | null,
  condition: Condition,
) {
  const { data: analyses = [], isLoading } = useRecentWorkerAnalyses(worker);
  return useMemo(() => {
    if (analyses.length === 0) {
      return { matched: 0, total: 0, percent: 0, isLoading };
    }
    let matched = 0;
    for (const aggs of analyses) {
      if (evaluateCondition(condition, aggs)) matched += 1;
    }
    return {
      matched,
      total: analyses.length,
      percent: Math.round((matched / analyses.length) * 100),
      isLoading,
    };
  }, [analyses, condition, isLoading]);
}

/* ----------------------------------------------------------- Mutations */

export function useUpsertRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rec: Recommendation & { enabled: boolean }) => {
      const { data, error } = await supabase
        .from("scoremax_recommendations")
        .upsert(rec, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as Recommendation;
    },
    onSuccess: (_, rec) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: ["recommendations", rec.worker] });
    },
  });
}

export function useDeleteRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; worker: string }) => {
      const { error } = await supabase
        .from("scoremax_recommendations")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: ["recommendations", input.worker] });
    },
  });
}

export function useToggleRecommendationEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      worker: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("scoremax_recommendations")
        .update({ enabled: input.enabled })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: ["recommendations", input.worker] });
    },
  });
}
