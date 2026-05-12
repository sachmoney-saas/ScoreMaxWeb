import { apiRequest } from "@/lib/queryClient";

export type AdminClientErrorRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  source: string;
  message: string;
  error_code: string | null;
  error_detail: string | null;
  error_hint: string | null;
  payload: unknown;
  client_route: string | null;
  user_agent: string | null;
  app_version: string | null;
};

export type AdminClientErrorsFilters = {
  limit: number;
  offset: number;
  source?: string;
  search?: string;
};

export async function fetchAdminClientErrors(
  accessToken: string,
  filters: AdminClientErrorsFilters,
): Promise<{ rows: AdminClientErrorRow[]; total: number }> {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));
  const source = filters.source?.trim();
  const search = filters.search?.trim();
  if (source) {
    params.set("source", source);
  }
  if (search) {
    params.set("search", search);
  }
  const qs = params.toString();
  const url = qs ? `/v1/admin/client-errors?${qs}` : "/v1/admin/client-errors";
  const response = await apiRequest("GET", url, undefined, {
    Authorization: `Bearer ${accessToken}`,
  });
  const json = (await response.json()) as {
    data: { rows: AdminClientErrorRow[]; total: number };
  };
  return json.data;
}

export async function purgeAdminClientErrorReports(params: {
  accessToken: string;
  /** true = tout supprimer ; false = même logique que le cron (&gt; 90 jours). */
  deleteAll: boolean;
}): Promise<{ deleted_count: number; delete_all: boolean }> {
  const search = params.deleteAll ? "?all=true" : "?all=false";
  const response = await apiRequest(
    "DELETE",
    `/v1/admin/client-errors${search}`,
    undefined,
    {
      Authorization: `Bearer ${params.accessToken}`,
    },
  );
  const json = (await response.json()) as {
    data: { deleted_count: number; delete_all: boolean };
  };
  return json.data;
}
