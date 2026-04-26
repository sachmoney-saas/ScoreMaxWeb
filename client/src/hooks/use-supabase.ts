import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Profile, UpdateProfileRequest, OnboardingScanStatus } from "@shared/schema";
import { useAuth } from "./use-auth";

/**
 * Hook for fetching and managing the current user's profile
 */
export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Profile | null>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateProfileRequest }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["user-growth"] });
    },
  });

  return {
    ...query,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProfile: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook for fetching admin metrics (Admin only)
 */
export function useAdminMetrics() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: todayCount },
        { count: weekCount },
        { count: monthCount }
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thisWeek),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thisMonth),
      ]);

      return {
        today: todayCount || 0,
        week: weekCount || 0,
        month: monthCount || 0,
      };
    },
    enabled: isAdmin,
    refetchInterval: 1000 * 60, // Refresh every minute
  });
}

/**
 * Hook for fetching user growth data (Admin only)
 */
export function useUserGrowth() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["user-growth"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by date
      const counts: Record<string, number> = {};
      data?.forEach(profile => {
        const date = new Date(profile.created_at).toLocaleDateString();
        counts[date] = (counts[date] || 0) + 1;
      });

      // Fill missing days and format for Recharts
      const chartData = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString();
        chartData.push({
          date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          count: counts[dateStr] || 0,
        });
      }

      return chartData;
    },
    enabled: isAdmin,
  });
}

/**
 * Hook for polling onboarding scan completeness status.
 */
export function useOnboardingScanStatus(options?: { enabled?: boolean }) {
  const { user } = useAuth();

  return useQuery<OnboardingScanStatus>({
    queryKey: ["onboarding-scan-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_onboarding_scan_status");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("Onboarding scan status is unavailable");
      }

      const [status] = data;
      return {
        session_id: status.session_id,
        required_asset_count: Number(status.required_asset_count ?? 0),
        completed_asset_count: Number(status.completed_asset_count ?? 0),
        is_ready: Boolean(status.is_ready),
        missing_asset_types: status.missing_asset_types ?? [],
      };
    },
    enabled: !!user && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state) {
        return 2500;
      }

      return state.is_ready ? false : 2500;
    },
    staleTime: 0,
  });
}
