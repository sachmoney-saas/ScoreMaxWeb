import { apiRequest } from "@/lib/queryClient";

export type AdminAnalysisFailure = {
  id: string;
  user_id: string;
  user_email: string | null;
  session_id: string | null;
  status: string;
  trigger_source: string | null;
  version: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  failed_at: string | null;
  completed_at: string | null;
  asset_count: number;
  scan_asset_count: number;
};

export type DeleteAdminAnalysisFailureResponse = {
  id: string;
  user_id: string;
  session_id: string | null;
  deleted_scan_asset_count: number;
  deleted_storage_object_count: number;
  retained_shared_scan_asset_count: number;
  deleted_scan_session: boolean;
  cleanup_warning?: string;
};

type AdminAnalysisFailuresEnvelope = {
  data: {
    failures: AdminAnalysisFailure[];
  };
};

type DeleteAdminAnalysisFailureEnvelope = {
  data: DeleteAdminAnalysisFailureResponse;
};

export async function fetchAdminAnalysisFailures(accessToken: string): Promise<AdminAnalysisFailure[]> {
  const response = await apiRequest("GET", "/v1/admin/analysis-failures", undefined, {
    Authorization: `Bearer ${accessToken}`,
  });
  const json = (await response.json()) as AdminAnalysisFailuresEnvelope;
  return json.data.failures;
}

export async function deleteAdminAnalysisJob(params: {
  accessToken: string;
  jobId: string;
}): Promise<DeleteAdminAnalysisFailureResponse> {
  const response = await apiRequest(
    "DELETE",
    `/v1/admin/analysis-jobs/${params.jobId}`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as DeleteAdminAnalysisFailureEnvelope;
  return json.data;
}

export async function deleteAdminAnalysisFailure(params: {
  accessToken: string;
  jobId: string;
}): Promise<DeleteAdminAnalysisFailureResponse> {
  return deleteAdminAnalysisJob(params);
}

/** Ligne liste jobs admin — même shape que les échecs enrichis (email, counts). */
export type AdminAnalysisJobRow = AdminAnalysisFailure;

export type AdminLinkedAsset = {
  asset_type_code: string;
  scan_asset_id: string;
};

/** Détail enrichi pour le panneau admin (sans base64 dans le payload). */
export type AdminAnalysisJobDetail = {
  job: {
    id: string;
    user_id: string;
    session_id: string | null;
    status: string;
    trigger_source: string | null;
    version: number | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    started_at: string | null;
    failed_at: string | null;
    completed_at: string | null;
  };
  user_email: string | null;
  /** Même forme que l’API analyse utilisateur. */
  results: Array<{
    worker: string;
    prompt_version: string;
    result: Record<string, unknown>;
    created_at: string;
  }>;
  capture_guide_metrics: unknown;
  request_payload: unknown;
  request_payload_summary: unknown;
  linked_assets: AdminLinkedAsset[];
  oneshot_images: Array<{
    imageId: string;
    mimeType: string;
    base64: string;
  }>;
};

type AdminAnalysisJobsEnvelope = {
  data: {
    jobs: AdminAnalysisJobRow[];
  };
};

type AdminAnalysisJobDetailEnvelope = {
  data: AdminAnalysisJobDetail;
};

export type AdminAnalysisJobsFilters = {
  /** défaut serveur : all */
  status?: "all" | "failed" | "completed" | "queued" | "running";
  limit?: number;
  search?: string;
};

export async function fetchAdminAnalysisJobs(
  accessToken: string,
  filters?: AdminAnalysisJobsFilters,
): Promise<AdminAnalysisJobRow[]> {
  const q = new URLSearchParams();
  if (filters?.status) q.set("status", filters.status);
  if (filters?.limit != null) q.set("limit", String(filters.limit));
  if (filters?.search?.trim()) q.set("search", filters.search.trim());
  const qs = q.toString();
  const url = qs ? `/v1/admin/analysis-jobs?${qs}` : "/v1/admin/analysis-jobs";

  const response = await apiRequest("GET", url, undefined, {
    Authorization: `Bearer ${accessToken}`,
  });
  const json = (await response.json()) as AdminAnalysisJobsEnvelope;
  return json.data.jobs;
}

export async function fetchAdminAnalysisJobDetail(params: {
  accessToken: string;
  jobId: string;
}): Promise<AdminAnalysisJobDetail> {
  const response = await apiRequest(
    "GET",
    `/v1/admin/analysis-jobs/${encodeURIComponent(params.jobId)}`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as AdminAnalysisJobDetailEnvelope;
  return json.data;
}

export function buildAdminAnalysisJobAssetUrl(jobId: string, assetTypeCode: string): string {
  const q = new URLSearchParams({ assetTypeCode });
  return `/v1/admin/analysis-jobs/${encodeURIComponent(jobId)}/asset?${q.toString()}`;
}
