import {
  AnalysesRequest,
  AnalysesResponse,
  CreateJobRequest,
  CreateJobResponse,
  GetJobResponse,
  RecentRequestsResponse,
  PublicUiModeResponse,
} from "@shared/oneshot";
import { getOneshotEnv } from "./env";
import { ApiError } from "./errors";

function buildUrl(path: string): string {
  const { baseUrl } = getOneshotEnv();
  const trimmedBase = baseUrl.replace(/\/$/, "");
  return `${trimmedBase}${path}`;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function oneshotFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { upstreamApiKey, timeoutMs } = getOneshotEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": upstreamApiKey,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: response.status >= 400 && response.status < 600 ? response.status : 500,
        message: "Upstream OneShot request failed",
        details: body,
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to reach OneShot API",
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createAnalysis(
  payload: AnalysesRequest,
): Promise<AnalysesResponse> {
  return oneshotFetch<AnalysesResponse>("/v1/analyses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createJob(payload: CreateJobRequest): Promise<CreateJobResponse> {
  return oneshotFetch<CreateJobResponse>("/v1/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getJob(id: string): Promise<GetJobResponse> {
  return oneshotFetch<GetJobResponse>(`/v1/jobs/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function getUiMode(): Promise<PublicUiModeResponse> {
  return oneshotFetch<PublicUiModeResponse>("/v1/public/ui-mode", {
    method: "GET",
  });
}

export async function getRecentRequests(limit?: number): Promise<RecentRequestsResponse> {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  return oneshotFetch<RecentRequestsResponse>(`/v1/public/recent-requests${query}`, {
    method: "GET",
  });
}
