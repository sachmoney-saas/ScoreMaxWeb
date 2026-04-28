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

export async function deleteAdminAnalysisFailure(params: {
  accessToken: string;
  jobId: string;
}): Promise<DeleteAdminAnalysisFailureResponse> {
  const response = await apiRequest(
    "DELETE",
    `/v1/admin/analysis-failures/${params.jobId}`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as DeleteAdminAnalysisFailureEnvelope;
  return json.data;
}
