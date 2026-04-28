import { analysesRequestSchema } from "@shared/oneshot";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { ApiError } from "./errors";
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
      const bucketName = asset.r2_bucket || "scan-assets";
      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .download(asset.r2_key);

      if (error || !data) {
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
}) {
  return analysesRequestSchema.parse({
    requestId: `${params.userId}-${params.sessionId}-${Date.now()}`,
    images: await buildAnalysisImages(params.assets),
    analyses: Object.entries(workerImageMap).map(([worker, imageId]) => ({
      worker,
      imageId,
      promptVersion: "latest",
      runs: 1,
    })),
    metadata: {
      source: params.source,
      userId: params.userId,
      sessionId: params.sessionId,
    },
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
}): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const version = await getNextAnalysisVersion(params.sessionId);
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .insert({
        user_id: params.userId,
        session_id: params.sessionId,
        trigger_source: params.triggerSource,
        status: "queued",
        version,
        request_payload: params.payload as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (!error && data) {
      return data.id as string;
    }

    if (error?.code !== "23505" || attempt === 1) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: error?.message || "Unable to create analysis job",
        details: error,
      });
    }
  }

  throw new ApiError({
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "Unable to create analysis job",
  });
}

