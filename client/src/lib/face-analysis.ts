import { reportClientError } from "@/lib/report-client-error";
import { apiRequest } from "@/lib/queryClient";
import { clientEnv } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import {
  REQUIRED_ONBOARDING_SCAN_ASSET_CODES,
  SCAN_ASSET_TO_CANONICAL_SLOT,
  type GuideTraceMetricsForAnalysis,
  type OnboardingScanAssetCode,
  type SignedUploadScanAssetCode,
} from "@shared/schema";
import {
  ANALYSIS_TIER_RUNS,
  type AnalysesRequest,
  type AnalysisTier,
} from "@shared/oneshot";
import { type AppLanguage, getPreferredLanguage, i18n } from "@/lib/i18n";
import { faceAnalysisMessage } from "@/lib/face-analysis-messages";

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
  ...REQUIRED_ONBOARDING_SCAN_ASSET_CODES,
];

export function getScanAssetLabels(
  lang: AppLanguage,
): Record<OnboardingScanAssetCode, string> {
  return {
    FACE_FRONT: i18n(lang, { en: "Front face", fr: "Visage de face" }),
    PROFILE_LEFT: i18n(lang, { en: "Left profile", fr: "Profil gauche" }),
    PROFILE_RIGHT: i18n(lang, { en: "Right profile", fr: "Profil droit" }),
    LOOK_UP: i18n(lang, {
      en: "Looking up",
      fr: "Regard vers le haut",
    }),
    LOOK_DOWN: i18n(lang, {
      en: "Looking down",
      fr: "Regard vers le bas",
    }),
    SMILE: i18n(lang, { en: "Smile", fr: "Sourire" }),
    EYE_CLOSEUP: i18n(lang, {
      en: "Eye close-up",
      fr: "Gros plan des yeux",
    }),
  };
}

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

export type RecentScanStatus = {
  window_minutes: number;
  required_count: number;
  received_count: number;
  missing_asset_types: OnboardingScanAssetCode[];
  received_asset_types: OnboardingScanAssetCode[];
  latest_session_id: string | null;
  latest_captured_at: string | null;
  is_ready: boolean;
};

export type AnalysisJobStatusResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    error_code: string | null;
    error_message: string | null;
    /** Présent sur GET `/jobs/:id` et données agrégées ; peut manquer sur la réponse 202 launch. */
    created_at?: string;
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
    /** Propriétaire du job ; nécessaire pour les miniatures d’assets (admin impersonation). */
    user_id?: string;
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
  /** Repères géométriques mesurés à la capture ; relus depuis le job (pas agrégateur LLM). */
  capture_guide_metrics?: GuideTraceMetricsForAnalysis | null;
};

export type LatestAnalysisResponse = PersistedAnalysisDetailResponse;
export type AnalysisDetailResponse = PersistedAnalysisDetailResponse;

/**
 * Workers we request on every full analysis. ScanFace decides which slot
 * images each worker actually receives via the prompt's
 * `requiredImageSlots`, so we don't bind a worker to a single image here.
 */
const SCANFACE_WORKERS = [
  "age",
  "bodyfat",
  "cheeks",
  "chin",
  "coloring",
  "eye_brows",
  "eyes",
  "hair",
  "jaw",
  "lips",
  "neck",
  "nose",
  "skin",
  "skin_tint",
  "smile",
  "symmetry_shape",
] as const;

/**
 * Build the per-worker analyses array sent to the API.
 *
 * `tier` controls the number of runs requested per worker:
 *   - "freemium" → 2 runs (used during onboarding, ~2.5× cheaper than standard)
 *   - "standard" → 5 runs (default for paid re-analyses)
 *
 * `imageId` is intentionally omitted — ScanFace resolves images from
 * `images[]` using the prompt's `requiredImageSlots`.
 */
export function buildFaceAnalysisWorkers(tier: AnalysisTier = "standard") {
  const runs = ANALYSIS_TIER_RUNS[tier];
  return SCANFACE_WORKERS.map((worker) => ({
    worker,
    promptVersion: "latest" as const,
    runs,
  }));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function buildPublicR2Url(key: string, lang: AppLanguage): string {
  const baseUrl = clientEnv.VITE_R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error(faceAnalysisMessage(lang, "r2BaseUrlMissing"));
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/${key}`;
}

/** Prépare l’URL signée (appel court). */
const SCAN_ASSET_SIGNED_UPLOAD_TIMEOUT_MS = 45_000;
/** Envoi binaire vers R2 (réseau / gros fichier). */
const SCAN_ASSET_R2_PUT_TIMEOUT_MS = 120_000;

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

/** Erreurs PostgREST / réseau souvent transitoires entre R2 et la persistance. */
function isRetriableScanAssetPersistError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "57014") return true;
  if (code === "40001" || code === "40P01") return true;
  if (code === "08006" || code === "08003") return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("fetch")) return true;
  if (msg.includes("network")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("etimedout")) return true;
  return false;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Remplace l’entrée locale `scan_assets` pour ce couple `(session_id, asset_type_code)`.
 *
 * **Pourquoi delete + insert (et pas `upsert` PostgREST) :** sur la prod vérifiée
 * via MCP, la contrainte unique est `UNIQUE (session_id, asset_type_code, r2_key)`.
 * Chaque upload reçoit un **nouveau** `r2_key` → un simple `upsert` sur `(session,type)`
 * n’est pas un `ON CONFLICT` valide et ne dédoublonne pas les réessais. On supprime
 * d’abord toutes les lignes pour ce slot, puis on insère la nouvelle (idempotent,
 * compatible RLS DELETE/INSERT utilisateur).
 */
async function persistScanAssetRow(params: {
  lang: AppLanguage;
  row: {
    session_id: string;
    user_id: string;
    asset_type_code: string;
    r2_bucket: string;
    r2_key: string;
    mime_type: string;
    byte_size: number;
    upload_status: "uploaded";
    captured_at: string;
    capture_metadata: Record<string, unknown>;
  };
  assetTypeCode: string;
  sessionId: string;
  mimeType: string;
  byteSize: number;
}): Promise<void> {
  const { lang, row, assetTypeCode, sessionId, mimeType, byteSize } = params;
  const maxAttempts = 3;
  let lastError: { code?: string; message?: string; details?: unknown; hint?: string } | null =
    null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { error: deleteError } = await supabase
      .from("scan_assets")
      .delete()
      .eq("session_id", sessionId)
      .eq("asset_type_code", assetTypeCode);

    if (deleteError) {
      lastError = deleteError;
      if (!isRetriableScanAssetPersistError(deleteError) || attempt === maxAttempts - 1) break;
      await sleepMs(400 * 2 ** attempt);
      continue;
    }

    const { error: insertError } = await supabase.from("scan_assets").insert(row);
    if (!insertError) return;

    lastError = insertError;
    if (!isRetriableScanAssetPersistError(insertError) || attempt === maxAttempts - 1) break;
    await sleepMs(400 * 2 ** attempt);
  }

  if (!lastError) {
    throw new Error(faceAnalysisMessage(lang, "scanAssetsSaveFailed"));
  }

  console.warn("[ScoreMax] scan_assets persist (delete + insert) failed", {
    code: lastError.code,
    message: lastError.message,
    details: lastError.details,
    hint: lastError.hint,
    assetTypeCode,
    ...(import.meta.env.DEV ? { sessionId } : {}),
  });
  reportClientError({
    source: "scan_assets.persist_replace",
    message: lastError.message || faceAnalysisMessage(lang, "scanAssetsSaveFailed"),
    errorCode: lastError.code,
    errorDetail:
      typeof lastError.details === "string"
        ? lastError.details
        : JSON.stringify(lastError.details ?? null),
    errorHint: lastError.hint ?? undefined,
    payload: {
      assetTypeCode,
      sessionId,
      mimeType,
      byteSize,
    },
  });
  throw new Error(faceAnalysisMessage(lang, "scanAssetsSaveFailed"), {
    cause: lastError,
  });
}

export async function uploadScanAsset(params: {
  userId: string;
  sessionId: string;
  assetTypeCode: SignedUploadScanAssetCode;
  file: File;
  lang?: AppLanguage;
  captureMetadata?: Record<string, unknown>;
}): Promise<void> {
  const lang = params.lang ?? getPreferredLanguage();
  if (!["image/jpeg", "image/png"].includes(params.file.type)) {
    throw new Error(faceAnalysisMessage(lang, "mimeTypeInvalid"));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error(faceAnalysisMessage(lang, "supabaseSessionMissing"));
  }

  let signedUploadResponse: Response;
  try {
    signedUploadResponse = await apiRequest(
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
      AbortSignal.timeout(SCAN_ASSET_SIGNED_UPLOAD_TIMEOUT_MS),
    );
  } catch (error) {
    if (isAbortError(error)) {
      reportClientError({
        source: "scan_assets.signed_upload_abort",
        message: faceAnalysisMessage(lang, "uploadTimedOut"),
        payload: { assetTypeCode: params.assetTypeCode, phase: "signed_url" },
      });
      throw new Error(faceAnalysisMessage(lang, "uploadTimedOut"));
    }
    throw error;
  }
  const signedUploadPayload = (await signedUploadResponse.json()) as {
    data?: {
      bucket: string;
      key: string;
      upload_url: string;
    };
  };
  const uploadData = signedUploadPayload.data;
  if (!uploadData) {
    reportClientError({
      source: "scan_assets.signed_upload_empty_payload",
      message: faceAnalysisMessage(lang, "signedUploadFailed"),
      payload: { assetTypeCode: params.assetTypeCode },
    });
    throw new Error(faceAnalysisMessage(lang, "signedUploadFailed"));
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(uploadData.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": params.file.type,
      },
      body: params.file,
      signal: AbortSignal.timeout(SCAN_ASSET_R2_PUT_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      reportClientError({
        source: "scan_assets.r2_put_abort",
        message: faceAnalysisMessage(lang, "uploadTimedOut"),
        payload: { assetTypeCode: params.assetTypeCode, phase: "r2_put" },
      });
      throw new Error(faceAnalysisMessage(lang, "uploadTimedOut"));
    }
    throw error;
  }

  if (!uploadResponse.ok) {
    reportClientError({
      source: "scan_assets.r2_put_failed",
      message: faceAnalysisMessage(lang, "r2UploadFailed"),
      payload: {
        assetTypeCode: params.assetTypeCode,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
      },
    });
    throw new Error(faceAnalysisMessage(lang, "r2UploadFailed"));
  }

  const captureMetadata: Record<string, unknown> =
    params.captureMetadata &&
    typeof params.captureMetadata === "object" &&
    Object.keys(params.captureMetadata).length > 0
      ? (params.captureMetadata as Record<string, unknown>)
      : {};

  const row = {
    session_id: params.sessionId,
    user_id: params.userId,
    asset_type_code: params.assetTypeCode,
    r2_bucket: uploadData.bucket,
    r2_key: uploadData.key,
    mime_type: params.file.type,
    byte_size: params.file.size,
    upload_status: "uploaded" as const,
    captured_at: new Date().toISOString(),
    capture_metadata: captureMetadata,
  };

  await persistScanAssetRow({
    lang,
    row,
    assetTypeCode: params.assetTypeCode,
    sessionId: params.sessionId,
    mimeType: params.file.type,
    byteSize: params.file.size,
  });
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
    .in(
      "asset_type_code",
      REQUIRED_ONBOARDING_SCAN_ASSET_CODES as unknown as string[],
    )
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false });

  if (error) {
    reportClientError({
      source: "scan_assets.fetch_session_assets",
      message: error.message,
      errorCode: error.code,
      errorDetail:
        typeof error.details === "string"
          ? error.details
          : JSON.stringify(error.details ?? null),
      errorHint: error.hint ?? undefined,
      payload: { sessionId },
    });
    throw error;
  }

  const latestByType = new Map<OnboardingScanAssetCode, ScanAssetRecord>();
  for (const raw of data ?? []) {
    const row = raw as ScanAssetRecord;
    if (!latestByType.has(row.asset_type_code)) {
      latestByType.set(row.asset_type_code, row);
    }
  }

  return requiredScanAssetCodes
    .map((code) => latestByType.get(code))
    .filter((asset): asset is ScanAssetRecord => asset !== undefined);
}

export async function buildFaceAnalysisRequest(params: {
  requestId: string;
  sessionId: string;
  userId: string;
  /** Defaults to "freemium" since this builder is only used by onboarding flows. */
  tier?: AnalysisTier;
  lang?: AppLanguage;
}): Promise<AnalysesRequest> {
  const lang = params.lang ?? getPreferredLanguage();
  const tier: AnalysisTier = params.tier ?? "freemium";
  const assets = await fetchOnboardingScanAssets(params.sessionId);

  if (assets.length < requiredScanAssetCodes.length) {
    throw new Error(faceAnalysisMessage(lang, "noScanAssets"));
  }

  const images = await Promise.all(
    assets.map(async (asset) => {
      const response = await fetch(buildPublicR2Url(asset.r2_key, lang));
      if (!response.ok) {
        reportClientError({
          source: "scan_assets.download_for_analysis",
          message: faceAnalysisMessage(lang, "downloadAssetFailed", asset.asset_type_code),
          payload: {
            assetTypeCode: asset.asset_type_code,
            status: response.status,
          },
        });
        throw new Error(
          faceAnalysisMessage(lang, "downloadAssetFailed", asset.asset_type_code),
        );
      }
      const data = await response.blob();

      return {
        imageId: SCAN_ASSET_TO_CANONICAL_SLOT[asset.asset_type_code],
        mimeType: asset.mime_type,
        base64: await blobToBase64(data),
      };
    }),
  );

  return {
    requestId: params.requestId,
    images,
    analyses: buildFaceAnalysisWorkers(tier),
    metadata: {
      source: "onboarding",
      userId: params.userId,
      sessionId: params.sessionId,
      tier,
    },
    ...(params.lang !== undefined ? { lang: params.lang } : {}),
  };
}

export async function runFaceAnalysis(params: {
  requestId: string;
  sessionId: string;
  userId: string;
  tier?: AnalysisTier;
  lang?: AppLanguage;
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
  headers?: HeadersInit,
): Promise<AnalysisHistoryItem[]> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/history?userId=${encodeURIComponent(userId)}`,
    undefined,
    headers,
  );
  const json = (await response.json()) as {
    data: AnalysisHistoryItem[];
  };

  return json.data ?? [];
}

export async function fetchAnalysisDetail(params: {
  userId: string;
  jobId: string;
  /** Auth explicite (recommandé : session Supabase) pour l’accès admin / impersonation. */
  headers?: HeadersInit;
}): Promise<AnalysisDetailResponse> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/${params.jobId}?userId=${encodeURIComponent(params.userId)}`,
    undefined,
    params.headers,
  );
  const json = (await response.json()) as {
    data: AnalysisDetailResponse;
  };

  return json.data;
}

export async function deleteAnalysisJob(params: {
  userId: string;
  jobId: string;
  headers?: HeadersInit;
}): Promise<void> {
  await apiRequest(
    "DELETE",
    `/v1/analyses/${params.jobId}?userId=${encodeURIComponent(params.userId)}`,
    undefined,
    params.headers,
  );
}

export function buildAnalysisThumbnailUrl(params: {
  userId: string;
  jobId: string;
}): string {
  return `/v1/analyses/${params.jobId}/thumbnail?userId=${encodeURIComponent(params.userId)}`;
}

export type AnalysisJobAssetPreviewCode =
  | "EYE_CLOSEUP"
  | "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS"
  | "GUIDE_TRACE_EYE_CANTHAL_TILT"
  | "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS"
  | "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR"
  | "GUIDE_TRACE_FACE_FRONT_CHEEKS"
  | "GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY"
  | "GUIDE_TRACE_SMILE_LIPS"
  | "GUIDE_TRACE_SMILE_TEETH"
  | "GUIDE_TRACE_FACE_FRONT_LIPS"
  | "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH"
  | "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE"
  | "GUIDE_TRACE_FACE_FRONT_OVAL"
  | "GUIDE_TRACE_PROFILE_LEFT_JAW"
  | "GUIDE_TRACE_LOOK_UP_JAW_ARC";

export function buildAnalysisJobAssetPreviewUrl(params: {
  userId: string;
  jobId: string;
  assetTypeCode: AnalysisJobAssetPreviewCode;
}): string {
  const q = new URLSearchParams({
    userId: params.userId,
    assetTypeCode: params.assetTypeCode,
  });
  return `/v1/analyses/${params.jobId}/asset?${q.toString()}`;
}

export async function fetchLatestFaceAnalysis(
  userId: string,
  headers?: HeadersInit,
): Promise<LatestAnalysisResponse | null> {
  const response = await apiRequest(
    "GET",
    `/v1/analyses/latest?userId=${encodeURIComponent(userId)}`,
    undefined,
    headers,
  );
  const json = (await response.json()) as {
    data: LatestAnalysisResponse | null;
  };

  return json.data ?? null;
}

/**
 * Polls the rolling-window scan status to detect assets the iPhone app
 * uploaded recently (default 60 minutes). Used by the "Nouvelle analyse"
 * page to surface a "Lancer" CTA without requiring a session id.
 */
export async function fetchRecentScanStatus(
  windowMinutes: number = 60,
): Promise<RecentScanStatus> {
  const { data, error } = await supabase.rpc("get_recent_scan_status", {
    p_window_minutes: windowMinutes,
  });

  if (error) {
    reportClientError({
      source: "rpc.get_recent_scan_status",
      message: error.message,
      errorCode: error.code,
      errorDetail:
        typeof error.details === "string"
          ? error.details
          : JSON.stringify(error.details ?? null),
      errorHint: error.hint ?? undefined,
      payload: { windowMinutes },
    });
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      window_minutes: windowMinutes,
      required_count: 0,
      received_count: 0,
      missing_asset_types: [],
      received_asset_types: [],
      latest_session_id: null,
      latest_captured_at: null,
      is_ready: false,
    };
  }

  return {
    window_minutes: Number(row.window_minutes ?? windowMinutes),
    required_count: Number(row.required_count ?? 0),
    received_count: Number(row.received_count ?? 0),
    missing_asset_types: (row.missing_asset_types ?? []) as OnboardingScanAssetCode[],
    received_asset_types: (row.received_asset_types ?? []) as OnboardingScanAssetCode[],
    latest_session_id: row.latest_session_id ?? null,
    latest_captured_at: row.latest_captured_at ?? null,
    is_ready: Boolean(row.is_ready),
  };
}

export type SubscriberStandardQuotaWire = {
  weekly_limit_applies: boolean;
  can_launch_standard_now: boolean;
  next_available_at: string | null;
  has_standard_in_flight: boolean;
  requires_active_subscription_to_launch: boolean;
  has_prior_completed_analysis: boolean;
};

export async function fetchSubscriberStandardQuota(
  accessToken: string,
): Promise<SubscriberStandardQuotaWire> {
  const response = await apiRequest(
    "GET",
    "/v1/analyses/subscriber-standard-quota",
    undefined,
    { Authorization: `Bearer ${accessToken}` },
  );
  const json = (await response.json()) as {
    data: SubscriberStandardQuotaWire;
  };

  return json.data;
}

export type ResetScanSessionAssetsResult = {
  deleted_asset_count: number;
  deleted_storage_object_count: number;
  failed_storage_object_count: number;
};

/** Supprime les photos déjà enregistrées pour la session (sans toucher aux lignes liées à un job). */
export async function resetScanSessionAssets(params: {
  accessToken: string;
  sessionId: string;
}): Promise<ResetScanSessionAssetsResult> {
  const response = await apiRequest(
    "POST",
    `/v1/analyses/scan-sessions/${params.sessionId}/reset-assets`,
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const json = (await response.json()) as {
    data: ResetScanSessionAssetsResult;
  };

  if (json.data.failed_storage_object_count > 0 && import.meta.env.DEV) {
    console.warn(
      "[ScoreMax] reset-scan-session : certains objets R2 n'ont pas pu être supprimés",
      json.data.failed_storage_object_count,
    );
  }

  return json.data;
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
  lang?: AppLanguage;
}): Promise<AnalysisJobStatusResponse> {
  const response = await apiRequest(
    "POST",
    `/v1/analyses/manual-session/${params.sessionId}/launch`,
    params.lang !== undefined ? { lang: params.lang } : undefined,
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
