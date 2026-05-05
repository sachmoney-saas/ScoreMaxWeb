import {
  analysesRequestSchema,
  ANALYSIS_TIER_RUNS,
  type AnalysisTier,
} from "@shared/oneshot";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { ApiError } from "./errors";
import { downloadR2Object, getDefaultR2Bucket } from "./r2-storage";
import { supabaseAdmin } from "./supabase-admin";

export const requiredAssetCodes: OnboardingScanAssetCode[] = [
  "FACE_FRONT",
  "PROFILE_LEFT",
  "PROFILE_RIGHT",
  "LOOK_UP",
  "LOOK_DOWN",
  "SMILE",
  "HAIR_BACK",
  "EYE_CLOSEUP",
];

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
        imageId: asset.asset_type_code,
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

  return analysesRequestSchema.parse({
    requestId: `${params.userId}-${params.sessionId}-${Date.now()}`,
    images: await buildAnalysisImages(params.assets),
    analyses: Object.entries(workerImageMap).map(([worker, imageId]) => ({
      worker,
      imageId,
      promptVersion: "latest",
      runs,
    })),
    metadata: {
      source: params.source,
      userId: params.userId,
      sessionId: params.sessionId,
      tier,
    },
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

