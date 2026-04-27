import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { OnboardingScanAssetCode } from "@shared/schema";
import type { AnalysesRequest, AnalysesResponse } from "@shared/oneshot";

export type ScanAssetRecord = {
  id: string;
  session_id: string;
  user_id: string;
  asset_type_code: OnboardingScanAssetCode;
  r2_bucket: string | null;
  r2_key: string;
  mime_type: "image/jpeg" | "image/png";
};

export type FaceAnalysisStatus =
  | { state: "idle" }
  | { state: "loading"; message: string }
  | { state: "success"; result: AnalysisRunResponse }
  | { state: "error"; message: string };

export type AnalysisRunResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
  };
  analysis: AnalysesResponse;
};

export type RawAnalysisRun = {
  analysisId?: string;
  runIndex?: number;
  status?: string;
  providerRequestId?: string;
  latencyMs?: number;
  raw?: unknown;
  createdAt?: string;
};

export type PersistedWorkerAnalysisResult = {
  worker: string;
  promptVersion: string;
  provider: string;
  requestedRuns: number;
  completedRuns: number;
  outputAggregates: Record<string, unknown>;
  rawRuns: RawAnalysisRun[];
};

export type AnalysisHistoryItem = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  version: number;
  created_at: string;
  completed_at: string | null;
  has_thumbnail: boolean;
};

export type LatestAnalysisResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    trigger_source: "onboarding_auto" | "user_rerun" | "admin";
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
  };
  results: Array<{
    worker: string;
    prompt_version: string;
    result: Record<string, unknown>;
    created_at: string;
  }>;
};

const workerImageMap: Record<string, OnboardingScanAssetCode> = {
  age: "FACE_FRONT",
  bodyfat: "FACE_FRONT",
  cheeks: "FACE_FRONT",
  chin: "FACE_FRONT",
  coloring: "FACE_FRONT",
  ear: "PROFILE_LEFT",
  eye_brows: "FACE_FRONT",
  eyes: "FACE_FRONT",
  hair: "HAIR_BACK",
  jaw: "FACE_FRONT",
  lips: "FACE_FRONT",
  neck: "PROFILE_LEFT",
  nose: "PROFILE_LEFT",
  skin: "FACE_FRONT",
  skin_tint: "FACE_FRONT",
  smile: "SMILE",
  symmetry_shape: "FACE_FRONT",
};

export const faceAnalysisWorkers = Object.entries(workerImageMap).map(
  ([worker, imageId]) => ({
    worker,
    imageId,
    promptVersion: "latest" as const,
    runs: 1,
  }),
);

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

export async function fetchOnboardingScanAssets(
  sessionId: string,
): Promise<ScanAssetRecord[]> {
  const { data, error } = await supabase
    .from("scan_assets")
    .select(
      "id, session_id, user_id, asset_type_code, r2_bucket, r2_key, mime_type",
    )
    .eq("session_id", sessionId)
    .order("asset_type_code", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ScanAssetRecord[];
}

export async function buildFaceAnalysisRequest(params: {
  requestId: string;
  sessionId: string;
  userId: string;
}): Promise<AnalysesRequest> {
  const assets = await fetchOnboardingScanAssets(params.sessionId);

  if (assets.length === 0) {
    throw new Error("No scan assets found for the current onboarding session");
  }

  const images = await Promise.all(
    assets.map(async (asset) => {
      const bucketName = asset.r2_bucket || "scan-assets";
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(asset.r2_key);

      if (error || !data) {
        throw (
          error ??
          new Error(`Unable to download asset ${asset.asset_type_code}`)
        );
      }

      return {
        imageId: asset.asset_type_code,
        mimeType: asset.mime_type,
        base64: await blobToBase64(data),
      };
    }),
  );

  return {
    requestId: params.requestId,
    images,
    analyses: faceAnalysisWorkers,
    metadata: {
      source: "onboarding",
      userId: params.userId,
      sessionId: params.sessionId,
    },
  };
}

export async function runFaceAnalysis(params: {
  requestId: string;
  sessionId: string;
  userId: string;
}): Promise<AnalysisRunResponse> {
  const payload = await buildFaceAnalysisRequest(params);
  const response = await apiRequest("POST", "/v1/analyses", payload);
  const json = (await response.json()) as {
    data: AnalysisRunResponse;
  };

  return json.data;
}

export async function fetchAnalysisHistory(
  userId: string,
): Promise<AnalysisHistoryItem[]> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/history?userId=${encodeURIComponent(userId)}`,
  );
  const json = (await response.json()) as {
    data: AnalysisHistoryItem[];
  };

  return json.data ?? [];
}

export async function deleteAnalysisJob(params: {
  userId: string;
  jobId: string;
}): Promise<void> {
  await apiRequest(
    "DELETE",
    `/v1/analyses/${params.jobId}?userId=${encodeURIComponent(params.userId)}`,
  );
}

export function buildAnalysisThumbnailUrl(params: {
  userId: string;
  jobId: string;
}): string {
  return `/v1/analyses/${params.jobId}/thumbnail?userId=${encodeURIComponent(params.userId)}`;
}

export async function fetchLatestFaceAnalysis(
  userId: string,
): Promise<LatestAnalysisResponse | null> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/latest?userId=${encodeURIComponent(userId)}`,
  );
  const json = (await response.json()) as {
    data: LatestAnalysisResponse | null;
  };

  return json.data ?? null;
}
