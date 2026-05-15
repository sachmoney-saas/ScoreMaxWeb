import { oneshotAspectRatioSchema } from "@shared/oneshot-image";
import { ApiError } from "./errors";
import { logger } from "./logger";
import {
  completeOneShotUpload,
  createOneShotJob,
  getOneShotJob,
  signOneShotUpload,
  uploadBinaryToOneShot,
} from "./oneshot-client";
import {
  downloadR2Object,
  getDefaultR2Bucket,
  getR2SignedDownloadUrl,
  uploadR2Object,
} from "./r2-storage";
import { supabaseAdmin } from "./supabase-admin";

export const ONBOARDING_POTENTIAL_PROMPT_KEY = "onboarding_potential_6months" as const;

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 90_000;
const DUPLICATE_WINDOW_MS = 120_000;

const activePotentialPollers = new Set<string>();

type PromptRow = {
  key: string;
  prompt: string;
  model: string;
  model_variant: string;
  aspect_ratio: string;
  safety_filters: boolean;
  is_active: boolean;
};

type GenerationRow = {
  id: string;
  user_id: string;
  oneshot_job_id: string | null;
  status: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadActivePrompt(): Promise<PromptRow> {
  const { data, error } = await supabaseAdmin
    .from("scoremax_ai_image_prompts")
    .select("key, prompt, model, model_variant, aspect_ratio, safety_filters, is_active")
    .eq("key", ONBOARDING_POTENTIAL_PROMPT_KEY)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Onboarding potential prompt is not configured",
      details: error,
    });
  }

  return data as PromptRow;
}

async function loadLatestFaceFrontScanAsset(params: {
  userId: string;
  sessionId: string;
}): Promise<{ id: string; r2_bucket: string | null; r2_key: string; mime_type: string }> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("id, r2_bucket, r2_key, mime_type, created_at")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("asset_type_code", "FACE_FRONT")
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Face front scan asset not found for onboarding session",
      details: error,
    });
  }

  return data as { id: string; r2_bucket: string | null; r2_key: string; mime_type: string };
}

async function markGenerationFailed(params: {
  generationId: string;
  code: string;
  message: string;
}): Promise<void> {
  await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .update({
      status: "failed",
      error_code: params.code,
      error_message: params.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.generationId);
}

async function finalizeSuccess(params: {
  generationId: string;
  userId: string;
  imageUrl: string;
  contentType: string | undefined;
}): Promise<void> {
  try {
    const imageRes = await fetch(params.imageUrl);
    if (!imageRes.ok) {
      await markGenerationFailed({
        generationId: params.generationId,
        code: "IMAGE_DOWNLOAD_FAILED",
        message: `Unable to download OneShot result (${imageRes.status})`,
      });
      return;
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const bucket = getDefaultR2Bucket();
    const key = `oneshot/${params.userId}/${params.generationId}.jpg`;
    const ct = params.contentType?.startsWith("image/") ? params.contentType : "image/jpeg";

    await uploadR2Object({
      bucket,
      key,
      body: buffer,
      contentType: ct,
    });

    const { error } = await supabaseAdmin
      .from("scoremax_ai_image_generations")
      .update({
        status: "completed",
        r2_bucket: bucket,
        r2_key: key,
        result_content_type: ct,
        result_size_bytes: buffer.length,
        updated_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", params.generationId);

    if (error) {
      logger.error({ err: error, generationId: params.generationId }, "Failed to persist generation success");
    }
  } catch (error) {
    logger.error({ err: error, generationId: params.generationId }, "finalizeSuccess failed");
    await markGenerationFailed({
      generationId: params.generationId,
      code: "R2_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "Failed to store generated image",
    });
  }
}

async function runPotentialPoll(generationId: string): Promise<void> {
  const { data: row, error: loadError } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select("id, user_id, oneshot_job_id, status")
    .eq("id", generationId)
    .maybeSingle();

  if (loadError || !row) {
    logger.warn({ generationId, loadError }, "Potential image poll: generation row missing");
    return;
  }

  const gen = row as GenerationRow;
  if (gen.status !== "pending" || !gen.oneshot_job_id) {
    return;
  }

  const jobId = gen.oneshot_job_id;
  const start = Date.now();

  while (Date.now() - start < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const job = await getOneShotJob(jobId);
      const statusLower = job.status.toLowerCase();

      if (statusLower === "completed" && job.result?.url) {
        await finalizeSuccess({
          generationId,
          userId: gen.user_id,
          imageUrl: job.result.url,
          contentType: job.result.contentType,
        });
        return;
      }

      if (statusLower === "failed" || job.error) {
        await markGenerationFailed({
          generationId,
          code: job.error?.code ?? "ONESHOT_JOB_FAILED",
          message: job.error?.message ?? "OneShot job failed",
        });
        return;
      }
    } catch (error) {
      logger.error({ err: error, generationId, jobId }, "Potential image poll tick failed");
      await markGenerationFailed({
        generationId,
        code: "POLLING_ERROR",
        message: error instanceof Error ? error.message : "Polling error",
      });
      return;
    }
  }

  await markGenerationFailed({
    generationId,
    code: "POLLING_TIMEOUT",
    message: "OneShot job did not complete within the allowed time",
  });
}

export function dispatchPotentialImagePolling(generationId: string): void {
  if (activePotentialPollers.has(generationId)) {
    return;
  }
  activePotentialPollers.add(generationId);
  void runPotentialPoll(generationId).finally(() => {
    activePotentialPollers.delete(generationId);
  });
}

/**
 * Resume polling for generations left `pending` after a process restart.
 */
export async function recoverPendingPotentialImageGenerations(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select("id")
    .eq("status", "pending")
    .not("oneshot_job_id", "is", null);

  if (error) {
    logger.error({ err: error }, "Unable to load pending potential image generations");
    return;
  }

  for (const row of data ?? []) {
    const id = (row as { id: string }).id;
    dispatchPotentialImagePolling(id);
  }

  if ((data ?? []).length > 0) {
    logger.info({ count: (data ?? []).length }, "Re-dispatched pending OneShot potential image pollers");
  }
}

export async function triggerOnboardingPotentialImage(params: {
  userId: string;
  sessionId: string;
}): Promise<string> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: dup } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select("id")
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dup?.id) {
    dispatchPotentialImagePolling(dup.id as string);
    return dup.id as string;
  }

  const faceAsset = await loadLatestFaceFrontScanAsset(params);
  const bucket = faceAsset.r2_bucket || getDefaultR2Bucket();
  const blob = await downloadR2Object({ bucket, key: faceAsset.r2_key });
  const buf = Buffer.from(await blob.arrayBuffer());

  const sign = await signOneShotUpload({
    filename: "face-front.jpg",
    contentType: faceAsset.mime_type,
    sizeBytes: buf.length,
  });

  await uploadBinaryToOneShot({
    uploadUrl: sign.uploadUrl,
    data: buf,
    contentType: faceAsset.mime_type,
    requiredHeaders: sign.requiredHeaders,
  });

  await completeOneShotUpload({ fileId: sign.fileId });

  const promptRow = await loadActivePrompt();
  const aspectParsed = oneshotAspectRatioSchema.safeParse(promptRow.aspect_ratio);
  const aspectRatio = aspectParsed.success ? aspectParsed.data : "1:1";

  const variant =
    promptRow.model_variant === "default" || promptRow.model_variant === "fast"
      ? promptRow.model_variant
      : "fast";

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .insert({
      user_id: params.userId,
      prompt_key: promptRow.key,
      prompt_snapshot: promptRow.prompt,
      source_scan_asset_id: faceAsset.id,
      status: "pending",
      oneshot_reference_file_id: sign.fileId,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to create potential image generation row",
      details: insertError,
    });
  }

  const generationId = inserted.id as string;

  try {
    const job = await createOneShotJob({
      prompt: promptRow.prompt,
      modelVariant: variant,
      aspectRatio,
      safetyFilters: promptRow.safety_filters,
      referenceFileIds: [sign.fileId],
    });

    const { error: updError } = await supabaseAdmin
      .from("scoremax_ai_image_generations")
      .update({
        oneshot_job_id: job.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    if (updError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to link OneShot job to generation",
        details: updError,
      });
    }

    dispatchPotentialImagePolling(generationId);
    return generationId;
  } catch (error) {
    await markGenerationFailed({
      generationId,
      code: "ONESHOT_JOB_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create OneShot job",
    });
    throw error;
  }
}

export type PotentialImagePayload = {
  id: string;
  status: "pending" | "completed" | "failed";
  signed_url: string | null;
  /** Repère face + masque 3D (`GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY`), sinon photo `FACE_FRONT`. */
  mask_overlay_signed_url: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

async function loadLatestScanAssetSignedUrl(params: {
  userId: string;
  sessionId: string;
  assetTypeCode: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("r2_bucket, r2_key")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("asset_type_code", params.assetTypeCode)
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.r2_key) {
    return null;
  }

  const row = data as { r2_bucket: string | null; r2_key: string };
  return getR2SignedDownloadUrl({
    bucket: row.r2_bucket ?? undefined,
    key: row.r2_key,
    expiresInSeconds: 300,
  });
}

async function resolveMaskOverlaySignedUrl(params: {
  userId: string;
  sourceScanAssetId: string | null;
}): Promise<string | null> {
  if (!params.sourceScanAssetId) {
    return null;
  }

  const { data: src, error: srcErr } = await supabaseAdmin
    .from("scan_assets")
    .select("session_id")
    .eq("id", params.sourceScanAssetId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (srcErr || !src?.session_id) {
    return null;
  }

  const sessionId = src.session_id as string;

  const mask = await loadLatestScanAssetSignedUrl({
    userId: params.userId,
    sessionId,
    assetTypeCode: "GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY",
  });
  if (mask) {
    return mask;
  }

  return loadLatestScanAssetSignedUrl({
    userId: params.userId,
    sessionId,
    assetTypeCode: "FACE_FRONT",
  });
}

export async function getLatestPotentialImageForUser(userId: string): Promise<PotentialImagePayload | null> {
  const { data, error } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select(
      "id, status, r2_bucket, r2_key, error_code, error_message, created_at, source_scan_asset_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    status: string;
    r2_bucket: string | null;
    r2_key: string | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    source_scan_asset_id: string | null;
  };

  const status = row.status as PotentialImagePayload["status"];
  if (status !== "pending" && status !== "completed" && status !== "failed") {
    return null;
  }

  let signedUrl: string | null = null;
  if (status === "completed" && row.r2_key) {
    signedUrl = await getR2SignedDownloadUrl({
      bucket: row.r2_bucket ?? undefined,
      key: row.r2_key,
      expiresInSeconds: 300,
    });
  }

  const maskOverlaySignedUrl = await resolveMaskOverlaySignedUrl({
    userId,
    sourceScanAssetId: row.source_scan_asset_id,
  });

  return {
    id: row.id,
    status,
    signed_url: signedUrl,
    mask_overlay_signed_url: maskOverlaySignedUrl,
    error_code: row.error_code,
    error_message: row.error_message,
    created_at: row.created_at,
  };
}
