import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Profile,
  UpdateProfileRequest,
  OnboardingScanStatus,
} from "@shared/schema";
import { useAuth } from "./use-auth";
import {
  deleteAdminAnalysisFailure,
  fetchAdminAnalysisFailures,
  type AdminAnalysisFailure,
  type DeleteAdminAnalysisFailureResponse,
} from "@/lib/admin-analysis";
import {
  createManualAnalysisSession,
  deleteAnalysisJob,
  fetchAnalysisDetail,
  fetchAnalysisHistory,
  fetchAnalysisJobStatus,
  fetchLatestFaceAnalysis,
  fetchManualAnalysisSessionStatus,
  fetchRecentScanStatus,
  launchManualAnalysis,
  type AnalysisDetailResponse,
  type AnalysisHistoryItem,
  type AnalysisJobStatusResponse,
  type LatestAnalysisResponse,
  type ManualAnalysisSessionResponse,
  type ManualAnalysisSessionStatus,
  type RecentScanStatus,
} from "@/lib/face-analysis";
import { useAppLanguage } from "@/lib/i18n";

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
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateProfileRequest;
    }) => {
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
      const { error } = await supabase.from("profiles").delete().eq("id", id);

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
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
      const thisWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      ).toISOString();
      const thisMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();

      const [
        { count: todayCount },
        { count: weekCount },
        { count: monthCount },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", thisWeek),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", thisMonth),
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
      data?.forEach((profile) => {
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
          date: d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          count: counts[dateStr] || 0,
        });
      }

      return chartData;
    },
    enabled: isAdmin,
  });
}

/**
 * Onboarding scan session snapshot (session id, progress). Fetches on demand
 * or when explicitly invalidated — no background polling (web capture replaces
 * the legacy iOS “wait until ready” loop).
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
    staleTime: 0,
  });
}

/**
 * Hook for loading the latest persisted face analysis orchestration result.
 */
export function useAnalysisHistory(options?: { enabled?: boolean }) {
  const { user } = useAuth();

  return useQuery<AnalysisHistoryItem[]>({
    queryKey: ["analysis-history", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      return fetchAnalysisHistory(user.id);
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const history = query.state.data ?? [];
      return history.some((item) => item.status === "queued" || item.status === "running")
        ? 2500
        : false;
    },
    staleTime: 0,
  });
}

export function useDeleteAnalysisJob() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!user?.id) {
        throw new Error("User is required to delete an analysis");
      }

      await deleteAnalysisJob({ userId: user.id, jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["latest-face-analysis", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["analysis-detail", user?.id] });
    },
  });
}

export function useAnalysisDetail(jobId: string | undefined, options?: { enabled?: boolean }) {
  const { user } = useAuth();

  return useQuery<AnalysisDetailResponse | null>({
    queryKey: ["analysis-detail", user?.id, jobId],
    queryFn: async () => {
      if (!user?.id || !jobId) {
        return null;
      }

      return fetchAnalysisDetail({ userId: user.id, jobId });
    },
    enabled: !!user?.id && !!jobId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state?.job) {
        return false;
      }

      return state.job.status === "queued" || state.job.status === "running"
        ? 2500
        : false;
    },
    staleTime: 0,
  });
}

export function useLatestFaceAnalysis(options?: { enabled?: boolean }) {
  const { user } = useAuth();

  return useQuery<LatestAnalysisResponse | null>({
    queryKey: ["latest-face-analysis", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      return fetchLatestFaceAnalysis(user.id);
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state?.job) {
        return false;
      }

      return state.job.status === "queued" || state.job.status === "running"
        ? 2500
        : false;
    },
    staleTime: 0,
  });
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw error ?? new Error("Session Supabase introuvable");
  }

  return data.session.access_token;
}

export function useAdminAnalysisFailures(options?: { enabled?: boolean }) {
  const { isAdmin } = useAuth();

  return useQuery<AdminAnalysisFailure[]>({
    queryKey: ["admin-analysis-failures"],
    queryFn: async () => fetchAdminAnalysisFailures(await getAccessToken()),
    enabled: isAdmin && (options?.enabled ?? true),
    staleTime: 0,
  });
}

export function useDeleteAdminAnalysisFailure() {
  const queryClient = useQueryClient();

  return useMutation<DeleteAdminAnalysisFailureResponse, Error, string>({
    mutationFn: async (jobId: string) =>
      deleteAdminAnalysisFailure({ accessToken: await getAccessToken(), jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-analysis-failures"] });
    },
  });
}

export function useCreateManualAnalysisSession() {
  return useMutation<ManualAnalysisSessionResponse>({
    mutationFn: async () => createManualAnalysisSession(await getAccessToken()),
  });
}

/**
 * Polls assets the iPhone app uploaded for this user within the last
 * `windowMinutes` minutes (default 60). Stops polling once is_ready.
 */
export function useRecentScanStatus(options?: {
  windowMinutes?: number;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const windowMinutes = options?.windowMinutes ?? 60;

  return useQuery<RecentScanStatus | null>({
    queryKey: ["recent-scan-status", user?.id, windowMinutes],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      return fetchRecentScanStatus(windowMinutes);
    },
    enabled: !!user?.id && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (state?.is_ready) {
        return false;
      }
      return 2500;
    },
    staleTime: 0,
  });
}

export function useManualAnalysisSessionStatus(
  sessionId: string | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();

  return useQuery<ManualAnalysisSessionStatus | null>({
    queryKey: ["manual-analysis-session-status", user?.id, sessionId],
    queryFn: async () => {
      if (!sessionId) {
        return null;
      }

      return fetchManualAnalysisSessionStatus({
        accessToken: await getAccessToken(),
        sessionId,
      });
    },
    enabled: !!user?.id && !!sessionId && (options?.enabled ?? true),
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

export function useLaunchManualAnalysis() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const language = useAppLanguage();

  return useMutation<AnalysisJobStatusResponse, Error, string>({
    mutationFn: async (sessionId: string) =>
      launchManualAnalysis({
        accessToken: await getAccessToken(),
        sessionId,
        lang: language,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["latest-face-analysis", user?.id] });
    },
  });
}

export function useAnalysisJobStatus(
  jobId: string | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();

  return useQuery<AnalysisJobStatusResponse | null>({
    queryKey: ["analysis-job-status", user?.id, jobId],
    queryFn: async () => {
      if (!jobId) {
        return null;
      }

      return fetchAnalysisJobStatus({
        accessToken: await getAccessToken(),
        jobId,
      });
    },
    enabled: !!user?.id && !!jobId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state?.job) {
        return false;
      }

      return state.job.status === "queued" || state.job.status === "running"
        ? 1500
        : false;
    },
    staleTime: 0,
  });
}
