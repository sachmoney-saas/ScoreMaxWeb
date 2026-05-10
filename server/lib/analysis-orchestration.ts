import {
  analysesRequestSchema,
  ANALYSIS_TIER_RUNS,
  type AnalysisTier,
} from "@shared/oneshot";
import {
  ANALYSIS_METADATA_GUIDE_TRACE_METRICS,
  CAPTURE_META_FRONT_JAW_ANGLE_DEG,
  CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO,
  CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO,
  FRONTAL_GUIDE_TRACE_METRIC_ASSET_CODES,
  REQUIRED_ONBOARDING_SCAN_ASSET_CODES,
  SCAN_ASSET_TO_CANONICAL_SLOT,
  type GuideTraceMetricsForAnalysis,
  type OnboardingScanAssetCode,
} from "@shared/schema";
import { ApiError } from "./errors";
import { downloadR2Object, getDefaultR2Bucket } from "./r2-storage";
import { supabaseAdmin } from "./supabase-admin";

export const requiredAssetCodes: OnboardingScanAssetCode[] =
  Array.from(REQUIRED_ONBOARDING_SCAN_ASSET_CODES);

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

export type ScanSessionRow = {
  id: string;
  user_id: string;
  source: string;
  status: string;
  required_asset_count: number;
  completed_asset_count: number;
};

export type ScanAssetRow = {
  id: string;
  session_id: string;
  user_id: string;
  asset_type_code: OnboardingScanAssetCode;
  r2_bucket: string | null;
  r2_key: string;
  mime_type: "image/jpeg" | "image/png";
  upload_status: string;
  created_at: string;
};

export async function refreshScanSessionProgress(sessionId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("scoremax_refresh_scan_session_progress", {
    target_session: sessionId,
  });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to refresh scan progress",
      details: error,
    });
  }
}

export async function loadRequiredAssets(params: {
  userId: string;
  sessionId: string;
}): Promise<ScanAssetRow[]> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select(
      "id, session_id, user_id, asset_type_code, r2_bucket, r2_key, mime_type, upload_status, created_at",
    )
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .in("asset_type_code", requiredAssetCodes)
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load scan assets",
      details: error,
    });
  }

  const latestAssets = new Map<OnboardingScanAssetCode, ScanAssetRow>();
  for (const asset of (data ?? []) as ScanAssetRow[]) {
    if (!latestAssets.has(asset.asset_type_code) && asset.r2_key.trim()) {
      latestAssets.set(asset.asset_type_code, asset);
    }
  }

  const missingCodes = requiredAssetCodes.filter((code) => !latestAssets.has(code));
  if (missingCodes.length > 0) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Missing required scan assets",
      details: { missingAssetCodes: missingCodes },
    });
  }

  return requiredAssetCodes.map((code) => latestAssets.get(code)!);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function pickFiniteMetric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

/**
 * Dernières métriques repères face (par type d’asset), lues en base pour enrichir
 * `AnalysesRequest.metadata` — uniquement des nombres réellement stockés à l’upload.
 */
export async function loadLatestFrontalGuideTraceMetrics(params: {
  userId: string;
  sessionId: string;
}): Promise<GuideTraceMetricsForAnalysis> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("asset_type_code, capture_metadata, created_at")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .in("asset_type_code", [...FRONTAL_GUIDE_TRACE_METRIC_ASSET_CODES])
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load guide trace capture metadata",
      details: error,
    });
  }

  const metrics: GuideTraceMetricsForAnalysis = {};

  /** Plus récent d’abord ; on prend la première valeur finie trouvée par type (ré-upload / métadonnée manquante). */
  const metasByAsset = new Map<string, Record<string, unknown>[]>();
  for (const raw of data ?? []) {
    const row = raw as {
      asset_type_code: string;
      capture_metadata: Record<string, unknown> | null;
    };
    const list = metasByAsset.get(row.asset_type_code) ?? [];
    list.push(row.capture_metadata ?? {});
    metasByAsset.set(row.asset_type_code, list);
  }

  const mergeFromKeylists = (
    assetCode: (typeof FRONTAL_GUIDE_TRACE_METRIC_ASSET_CODES)[number],
    metaKey:
      | typeof CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO
      | typeof CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO
      | typeof CAPTURE_META_FRONT_JAW_ANGLE_DEG,
  ): void => {
    const list = metasByAsset.get(assetCode);
    if (!list) return;
    for (const meta of list) {
      const v = pickFiniteMetric(meta[metaKey]);
      if (v !== undefined) {
        metrics[metaKey] = v;
        return;
      }
    }
  };

  mergeFromKeylists(
    "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
    CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO,
  );
  mergeFromKeylists(
    "GUIDE_TRACE_FACE_FRONT_OVAL",
    CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO,
  );
  mergeFromKeylists(
    "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
    CAPTURE_META_FRONT_JAW_ANGLE_DEG,
  );

  return metrics;
}

export function parseGuideTraceMetricsFromStoredRequestPayload(
  requestPayload: unknown,
): GuideTraceMetricsForAnalysis | null {
  if (!requestPayload || typeof requestPayload !== "object" || Array.isArray(requestPayload)) {
    return null;
  }
  const root = requestPayload as Record<string, unknown>;
  const block = root[ANALYSIS_METADATA_GUIDE_TRACE_METRICS];
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return null;
  }
  const m = block as Record<string, unknown>;
  const metrics: GuideTraceMetricsForAnalysis = {};
  const rn = pickFiniteMetric(m[CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO]);
  if (rn !== undefined) metrics[CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO] = rn;
  const ro = pickFiniteMetric(m[CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO]);
  if (ro !== undefined) metrics[CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO] = ro;
  const ra = pickFiniteMetric(m[CAPTURE_META_FRONT_JAW_ANGLE_DEG]);
  if (ra !== undefined) metrics[CAPTURE_META_FRONT_JAW_ANGLE_DEG] = ra;
  return Object.keys(metrics).length > 0 ? metrics : null;
}

async function buildAnalysisImages(assets: ScanAssetRow[]) {
  return Promise.all(
    assets.map(async (asset) => {
      const bucketName = asset.r2_bucket || getDefaultR2Bucket();
      let data: Blob;
      try {
        data = await downloadR2Object({
          bucket: bucketName,
          key: asset.r2_key,
        });
      } catch (error) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 400,
          message: `Unable to download scan asset ${asset.asset_type_code}`,
          details: error,
        });
      }

      return {
        imageId: SCAN_ASSET_TO_CANONICAL_SLOT[asset.asset_type_code],
        mimeType: asset.mime_type,
        base64: await blobToBase64(data),
      };
    }),
  );
}

export async function buildPayload(params: {
  userId: string;
  sessionId: string;
  assets: ScanAssetRow[];
  source: "onboarding" | "manual_rescan";
  /** Defaults to "standard" (5 runs/worker). Onboarding uses "freemium" (1 run). */
  tier?: AnalysisTier;
  lang?: string;
}) {
  const tier: AnalysisTier = params.tier ?? "standard";
  const runs = ANALYSIS_TIER_RUNS[tier];

  const guideTraceMetrics = await loadLatestFrontalGuideTraceMetrics({
    userId: params.userId,
    sessionId: params.sessionId,
  });

  const metadata: Record<string, unknown> = {
    source: params.source,
    userId: params.userId,
    sessionId: params.sessionId,
    tier,
  };
  if (Object.keys(guideTraceMetrics).length > 0) {
    metadata[ANALYSIS_METADATA_GUIDE_TRACE_METRICS] = guideTraceMetrics;
  }

  return analysesRequestSchema.parse({
    requestId: `${params.userId}-${params.sessionId}-${Date.now()}`,
    images: await buildAnalysisImages(params.assets),
    /**
     * No `imageId` per worker: ScanFace pulls the slots its prompt
     * declares from `images[]`. We just hand it the workers + run count.
     */
    analyses: SCANFACE_WORKERS.map((worker) => ({
      worker,
      promptVersion: "latest" as const,
      runs,
    })),
    metadata,
    ...(params.lang !== undefined ? { lang: params.lang } : {}),
  });
}

export async function getNextAnalysisVersion(sessionId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("analysis_jobs")
    .select("version")
    .eq("session_id", sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: error.message || "Unable to read latest analysis version",
      details: error,
    });
  }

  return Number(data?.version ?? 0) + 1;
}

export async function createAnalysisJob(params: {
  userId: string;
  sessionId: string;
  payload: unknown;
  triggerSource: "onboarding_auto" | "user_rerun" | "admin";
  /** Pricing tier the request was built at; persisted on the job row. */
  tier: AnalysisTier;
}): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const version = await getNextAnalysisVersion(params.sessionId);
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .insert({
        user_id: params.userId,
        session_id: params.sessionId,
        trigger_source: params.triggerSource,
        tier: params.tier,
        status: "queued",
        version,
        request_payload: params.payload as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (!error && data) {
      return data.id as string;
    }

    // 23505 = unique_violation. The (session_id, version) race resolves on retry,
    // but the freemium-per-user partial unique index is intentional and must
    // surface as a structured 409 to the caller.
    if (error?.code === "23505") {
      const message = error.message ?? "";
      if (message.includes("scoremax_analysis_jobs_user_freemium_active_uidx")) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 409,
          message: "Freemium analysis quota already used",
          details: { quota: "freemium_one_per_account" },
        });
      }

      if (attempt < 1) {
        continue;
      }
    }

    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: error?.message || "Unable to create analysis job",
      details: error,
    });
  }

  throw new ApiError({
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "Unable to create analysis job",
  });
}

export type ActiveFreemiumJob = {
  id: string;
  status: "queued" | "running" | "completed";
  session_id: string;
  created_at: string;
};

/**
 * Returns the user's existing **non-failed** freemium analysis job, if any.
 *
 * "Non-failed" matches the partial unique index
 * `scoremax_analysis_jobs_user_freemium_active_uidx`, so a single freemium row
 * is guaranteed by the database when one is found.
 */
export async function loadActiveFreemiumJobForUser(
  userId: string,
): Promise<ActiveFreemiumJob | null> {
  const { data, error } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id, status, session_id, created_at")
    .eq("user_id", userId)
    .eq("tier", "freemium")
    .in("status", ["queued", "running", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to check freemium analysis quota",
      details: error,
    });
  }

  return (data as ActiveFreemiumJob | null) ?? null;
}

/**
 * Throws a 409 if the user already has an active freemium analysis.
 * Use this at the request edge before creating a new freemium job; the partial
 * unique index in the DB is the second line of defence.
 */
export async function assertFreemiumQuotaAvailable(userId: string): Promise<void> {
  const existing = await loadActiveFreemiumJobForUser(userId);
  if (existing) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Freemium analysis already used for this account",
      details: {
        quota: "freemium_one_per_account",
        existingJobId: existing.id,
        existingJobStatus: existing.status,
      },
    });
  }
}

