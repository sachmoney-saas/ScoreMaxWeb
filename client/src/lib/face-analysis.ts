import { apiRequest } from "@/lib/queryClient";
import { clientEnv } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { OnboardingScanAssetCode } from "@shared/schema";
import type { AnalysesRequest } from "@shared/oneshot";

export type ScanAssetRecord = {
  id: string;
  session_id: string;
  user_id: string;
  asset_type_code: OnboardingScanAssetCode;
  r2_bucket: string | null;
  r2_key: string;
  mime_type: "image/jpeg" | "image/png";
};

export const requiredScanAssetCodes: OnboardingScanAssetCode[] = [
  "FACE_FRONT",
  "PROFILE_LEFT",
  "PROFILE_RIGHT",
  "LOOK_UP",
  "LOOK_DOWN",
  "SMILE",
  "HAIR_BACK",
  "EYE_CLOSEUP",
];

export const scanAssetLabels: Record<OnboardingScanAssetCode, string> = {
  FACE_FRONT: "Visage de face",
  PROFILE_LEFT: "Profil gauche",
  PROFILE_RIGHT: "Profil droit",
  LOOK_UP: "Regard vers le haut",
  LOOK_DOWN: "Regard vers le bas",
  SMILE: "Sourire",
  HAIR_BACK: "Cheveux arrière",
  EYE_CLOSEUP: "Gros plan des yeux",
};

export type ManualAnalysisSessionResponse = {
  session: {
    id: string;
    source: "manual_rescan";
    status: "collecting" | "ready" | "processing" | "completed" | "failed" | "abandoned";
    required_asset_count: number;
    completed_asset_count: number;
  };
  required_asset_codes: OnboardingScanAssetCode[];
};

export type ManualAnalysisSessionStatus = {
  session_id: string;
  required_asset_count: number;
  completed_asset_count: number;
  is_ready: boolean;
  missing_asset_types: OnboardingScanAssetCode[];
};

export type AnalysisJobStatusResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    error_code: string | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    session_id: string;
    version: number;
  };
};

export type FaceAnalysisStatus =
  | { state: "idle" }
  | { state: "loading"; message: string }
  | { state: "success"; result: AnalysisJobStatusResponse }
  | { state: "error"; message: string };

export type AnalysisLaunchResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
  };
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
  results: Array<{
    worker: string;
    result: Record<string, unknown>;
  }>;
};

export type PersistedAnalysisDetailResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    trigger_source: "onboarding_auto" | "user_rerun" | "admin";
    version: number;
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

export type LatestAnalysisResponse = PersistedAnalysisDetailResponse;
export type AnalysisDetailResponse = PersistedAnalysisDetailResponse;

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

function buildPublicR2Url(key: string): string {
  const baseUrl = clientEnv.VITE_R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_R2_PUBLIC_BASE_URL est requis pour lire les assets R2.");
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/${key}`;
}

export async function uploadScanAsset(params: {
  userId: string;
  sessionId: string;
  assetTypeCode: OnboardingScanAssetCode;
  file: File;
}): Promise<void> {
  if (!["image/jpeg", "image/png"].includes(params.file.type)) {
    throw new Error("Seuls les fichiers JPG et PNG sont acceptés.");
  }

  const extension = params.file.type === "image/png" ? "png" : "jpg";
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Session Supabase introuvable");
  }

  const signedUploadResponse = await apiRequest(
    "POST",
    "/v1/analyses/scan-assets/signed-upload",
    {
      sessionId: params.sessionId,
      assetTypeCode: params.assetTypeCode,
      mimeType: params.file.type,
    },
    {
      Authorization: `Bearer ${accessToken}`,
    },
  );
  const signedUploadPayload = (await signedUploadResponse.json()) as {
    data?: {
      bucket: string;
      key: string;
      upload_url: string;
    };
  };
  const uploadData = signedUploadPayload.data;
  if (!uploadData) {
    throw new Error("Impossible de préparer l'upload sur R2.");
  }

  const uploadResponse = await fetch(uploadData.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": params.file.type,
    },
    body: params.file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Upload Cloudflare R2 échoué.");
  }

  const { error: insertError } = await supabase.from("scan_assets").insert({
    session_id: params.sessionId,
    user_id: params.userId,
    asset_type_code: params.assetTypeCode,
    r2_bucket: uploadData.bucket,
    r2_key: uploadData.key,
    mime_type: params.file.type,
    byte_size: params.file.size,
    upload_status: "uploaded",
    captured_at: new Date().toISOString(),
  });

  if (insertError) {
    throw insertError;
  }
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
      const response = await fetch(buildPublicR2Url(asset.r2_key));
      if (!response.ok) {
        throw new Error(`Unable to download asset ${asset.asset_type_code}`);
      }
      const data = await response.blob();

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
}): Promise<AnalysisLaunchResponse> {
  const payload = await buildFaceAnalysisRequest(params);
  const response = await apiRequest("POST", "/v1/analyses", payload);
  const json = (await response.json()) as {
    data: AnalysisLaunchResponse;
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

export async function fetchAnalysisDetail(params: {
  userId: string;
  jobId: string;
}): Promise<AnalysisDetailResponse> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/${params.jobId}?userId=${encodeURIComponent(params.userId)}`,
  );
  const json = (await response.json()) as {
    data: AnalysisDetailResponse;
  };

  return json.data;
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

export async function createManualAnalysisSession(
  accessToken: string,
): Promise<ManualAnalysisSessionResponse> {
  const response = await apiRequest("POST", "/v1/analyses/manual-session", undefined, {
    Authorization: `Bearer ${accessToken}`,
  });
  const json = (await response.json()) as {
    data: ManualAnalysisSessionResponse;
  };

  return json.data;
}

export async function fetchManualAnalysisSessionStatus(params: {
  accessToken: string;
  sessionId: string;
}): Promise<ManualAnalysisSessionStatus> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/manual-session/${params.sessionId}/status`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as {
    data: ManualAnalysisSessionStatus;
  };

  return json.data;
}

export async function launchManualAnalysis(params: {
  accessToken: string;
  sessionId: string;
}): Promise<AnalysisJobStatusResponse> {
  const response = await apiRequest(
    "POST",
    `/v1/analyses/manual-session/${params.sessionId}/launch`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as {
    data: AnalysisJobStatusResponse;
  };

  return json.data;
}

export async function fetchAnalysisJobStatus(params: {
  accessToken: string;
  jobId: string;
}): Promise<AnalysisJobStatusResponse> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/jobs/${params.jobId}`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as {
    data: AnalysisJobStatusResponse;
  };

  return json.data;
}
