import { oneshotAspectRatioSchema } from "@shared/oneshot-image";
import {
  ONBOARDING_POTENTIAL_JOB_RETRY_LIMIT,
  ONBOARDING_POTENTIAL_MAX_CONSECUTIVE_POLL_ERRORS,
  ONBOARDING_POTENTIAL_MAX_WAIT_MS,
  ONBOARDING_POTENTIAL_POLL_INTERVAL_MS,
} from "@shared/onboarding-potential";
import { ONBOARDING_PORTRAIT_ASPECT_RATIO } from "@shared/onboarding-portrait-media";
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
  r2ObjectExists,
  uploadR2Object,
} from "./r2-storage";
import {
  avifKeyFor,
  ensureAvifVariant,
  ensureAvifVariantInBackground,
} from "./avif-variant";
import { supabaseAdmin } from "./supabase-admin";
import {
  pickPreferredPotentialGeneration,
  shouldStartNewPotentialImageGeneration,
  type PotentialGenerationStatus,
} from "./onboarding-potential-image-policy";

export const ONBOARDING_POTENTIAL_PROMPT_KEY = "onboarding_potential_6months" as const;

const activePotentialPollers = new Set<string>();

const GENERATION_SELECT =
  "id, status, r2_bucket, r2_key, result_content_type, error_code, error_message, created_at, source_scan_asset_id, oneshot_job_id, oneshot_reference_file_id, prompt_snapshot";
const ONBOARDING_POTENTIAL_MEDIA_BASE_PATH =
  "/v1/onboarding/potential-image/media";
const ONBOARDING_POTENTIAL_JOB_RETRY_DELAY_MS = 5_000;
const ONESHOT_JOB_CREATE_ATTEMPTS =
  ONBOARDING_POTENTIAL_JOB_RETRY_LIMIT + 1;

export type TriggerPotentialImageResult = {
  generationId: string;
  reused: boolean;
};

export type PotentialImagePayload = {
  id: string;
  status: "pending" | "completed" | "failed";
  display_state: "loading" | "ready" | "unavailable";
  generated_media_url: string | null;
  source_face_media_url: string | null;
  mask_overlay_media_url: string | null;
  /** @deprecated Prefer `generated_media_url`; retained during rollout. */
  signed_url: string | null;
  /**
   * AVIF variant of `signed_url` (display-only derivative). `null` when the
   * variant has not been generated yet — clients should fall back to
   * `signed_url`.
   */
  signed_url_avif: string | null;
  /**
   * Photo source du scan utilisée pour la génération potentiel (ex. FACE_FRONT) —
   * même binaire qu’envoyé à OneShot / nano-banana, sans masque ni overlay.
   */
  source_face_signed_url: string | null;
  source_face_signed_url_avif: string | null;
  /** Repère face + masque 3D (`GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY`), sinon photo `FACE_FRONT`. */
  mask_overlay_signed_url: string | null;
  mask_overlay_signed_url_avif: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

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
  prompt_snapshot: string;
  r2_bucket: string | null;
  r2_key: string | null;
  result_content_type: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  source_scan_asset_id: string | null;
  oneshot_reference_file_id: string | null;
};

export type PotentialImageMediaKind = "generated" | "source" | "mask";

export type PotentialImageMediaAsset = {
  bucket: string | null;
  key: string;
  mimeType: string;
};

type PotentialImagePayloadOptions = {
  includeSignedUrls?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function toGenerationSnapshot(row: GenerationRow) {
  return {
    status: row.status as PotentialGenerationStatus,
    hasOneshotJob: Boolean(row.oneshot_job_id),
    hasStoredResult: Boolean(row.r2_key),
  };
}

async function loadPotentialGenerationsForUser(userId: string): Promise<GenerationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select(GENERATION_SELECT)
    .eq("user_id", userId)
    .eq("prompt_key", ONBOARDING_POTENTIAL_PROMPT_KEY)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    logger.error({ err: error, userId }, "Unable to load potential image generations");
    return [];
  }

  return (data ?? []) as GenerationRow[];
}

function pickPreferredGenerationRow(rows: GenerationRow[]): GenerationRow | null {
  const preferred = pickPreferredPotentialGeneration(
    rows.map((row) => ({
      status: row.status as PotentialGenerationStatus,
      createdAtMs: new Date(row.created_at).getTime(),
    })),
  );
  if (!preferred) {
    return null;
  }

  return (
    rows.find(
      (row) =>
        row.status === preferred.status &&
        new Date(row.created_at).getTime() === preferred.createdAtMs,
    ) ?? null
  );
}

/**
 * Génération réutilisable : image terminée conservée, ou job encore en cours.
 */
async function findReusablePotentialGeneration(
  userId: string,
): Promise<GenerationRow | null> {
  const rows = await loadPotentialGenerationsForUser(userId);
  if (rows.length === 0) {
    return null;
  }

  const match = pickPreferredGenerationRow(rows);
  if (!match) {
    return null;
  }

  if (!shouldStartNewPotentialImageGeneration(toGenerationSnapshot(match))) {
    return match;
  }

  return null;
}

function onboardingPotentialMediaUrl(kind: PotentialImageMediaKind): string {
  return `${ONBOARDING_POTENTIAL_MEDIA_BASE_PATH}/${kind}`;
}

async function signMediaAssetWithAvifFallback(
  asset: PotentialImageMediaAsset | null,
): Promise<{ url: string | null; avifUrl: string | null }> {
  if (!asset) {
    return { url: null, avifUrl: null };
  }

  const bucket = asset.bucket ?? undefined;
  const [url, avifExists] = await Promise.all([
    getR2SignedDownloadUrl({
      bucket,
      key: asset.key,
      expiresInSeconds: 300,
    }),
    r2ObjectExists({
      bucket,
      key: avifKeyFor(asset.key),
    }).catch(() => false),
  ]);

  if (avifExists) {
    const avifUrl = await getR2SignedDownloadUrl({
      bucket,
      key: avifKeyFor(asset.key),
      expiresInSeconds: 300,
    });
    return { url, avifUrl };
  }

  ensureAvifVariantInBackground({
    bucket,
    sourceKey: asset.key,
    sourceContentType: asset.mimeType,
  });
  return { url, avifUrl: null };
}

function potentialDisplayState(
  row: GenerationRow,
): PotentialImagePayload["display_state"] {
  if (row.status === "completed" && row.r2_key) {
    return "ready";
  }
  if (row.status === "pending" && row.oneshot_job_id) {
    return "loading";
  }
  return "unavailable";
}

async function generationRowToPayload(
  row: GenerationRow,
  userId: string,
  options: PotentialImagePayloadOptions = {},
): Promise<PotentialImagePayload | null> {
  const status = row.status as PotentialGenerationStatus;
  if (status !== "pending" && status !== "completed" && status !== "failed") {
    return null;
  }

  if (status === "pending" && !row.oneshot_job_id) {
    await markGenerationFailed({
      generationId: row.id,
      code: "ONESHOT_JOB_MISSING",
      message: "Pending OneShot generation has no job id",
    });
    return null;
  }

  if (status === "pending" && row.oneshot_job_id) {
    dispatchPotentialImagePolling(row.id);
  }

  const generatedAsset =
    status === "completed" && row.r2_key
      ? {
          bucket: row.r2_bucket,
          key: row.r2_key,
          mimeType: row.result_content_type ?? "image/jpeg",
        }
      : null;

  const [maskOverlay, sourceFace] = await Promise.all([
    resolveMaskOverlayMedia({
      userId,
      sourceScanAssetId: row.source_scan_asset_id,
    }),
    resolveSourceFaceMedia({
      userId,
      sourceScanAssetId: row.source_scan_asset_id,
    }),
  ]);
  const includeSignedUrls = options.includeSignedUrls ?? true;
  const [generatedSigned, sourceSigned, maskSigned] = includeSignedUrls
    ? await Promise.all([
        signMediaAssetWithAvifFallback(generatedAsset),
        signMediaAssetWithAvifFallback(sourceFace),
        signMediaAssetWithAvifFallback(maskOverlay),
      ])
    : [
        { url: null, avifUrl: null },
        { url: null, avifUrl: null },
        { url: null, avifUrl: null },
      ];

  return {
    id: row.id,
    status,
    display_state: potentialDisplayState(row),
    generated_media_url:
      generatedAsset ? onboardingPotentialMediaUrl("generated") : null,
    source_face_media_url: sourceFace
      ? onboardingPotentialMediaUrl("source")
      : null,
    mask_overlay_media_url: maskOverlay
      ? onboardingPotentialMediaUrl("mask")
      : null,
    signed_url: generatedSigned.url,
    signed_url_avif: generatedSigned.avifUrl,
    source_face_signed_url: sourceSigned.url,
    source_face_signed_url_avif: sourceSigned.avifUrl,
    mask_overlay_signed_url: maskSigned.url,
    mask_overlay_signed_url_avif: maskSigned.avifUrl,
    error_code: row.error_code,
    error_message: row.error_message,
    created_at: row.created_at,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPotentialJobRequest(
  promptRow: PromptRow,
  referenceFileId: string,
  prompt = promptRow.prompt,
): Parameters<typeof createOneShotJob>[0] {
  const aspectParsed = oneshotAspectRatioSchema.safeParse(promptRow.aspect_ratio);
  const aspectRatio = aspectParsed.success
    ? aspectParsed.data
    : ONBOARDING_PORTRAIT_ASPECT_RATIO;

  const modelVariant =
    promptRow.model_variant === "default" || promptRow.model_variant === "fast"
      ? promptRow.model_variant
      : "fast";

  return {
    prompt,
    modelVariant,
    aspectRatio,
    safetyFilters: promptRow.safety_filters,
    referenceFileIds: [referenceFileId],
  };
}

async function createPotentialOneShotJobWithRetry(
  params: Parameters<typeof createOneShotJob>[0] & {
    generationId?: string;
    reason: string;
  },
): Promise<Awaited<ReturnType<typeof createOneShotJob>>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ONESHOT_JOB_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await createOneShotJob(params);
    } catch (error) {
      lastError = error;
      if (attempt >= ONESHOT_JOB_CREATE_ATTEMPTS) {
        break;
      }

      logger.warn(
        {
          err: error,
          generationId: params.generationId,
          attempt,
          reason: params.reason,
        },
        "OneShot job creation failed; retrying",
      );
      await sleep(ONBOARDING_POTENTIAL_JOB_RETRY_DELAY_MS);
    }
  }

  throw lastError;
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

    /**
     * Generate the AVIF variant *now* while the source buffer is still hot:
     * the OneShot result is freshly downloaded, ML pipelines no longer need
     * it for ~ minutes, and clients will hit `/onboarding/potential-image`
     * within seconds. Saving ~40 % bandwidth on this single asset is the
     * highest-impact win in the whole AVIF pipeline.
     *
     * We still call `ensureAvifVariant` rather than encoding inline so the
     * helper's in-flight dedupe + R2 head-check stay the single source of
     * truth for the variant lifecycle.
     */
    await ensureAvifVariant({ bucket, sourceKey: key }).catch(() => {
      // already logged inside ensureAvifVariant
    });
  } catch (error) {
    logger.error({ err: error, generationId: params.generationId }, "finalizeSuccess failed");
    await markGenerationFailed({
      generationId: params.generationId,
      code: "R2_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "Failed to store generated image",
    });
  }
}

async function retryPotentialJobAfterTerminalFailure(params: {
  generation: GenerationRow;
  previousJobId: string;
}): Promise<string | null> {
  if (!params.generation.oneshot_reference_file_id) {
    return null;
  }

  try {
    const promptRow = await loadActivePrompt();
    const job = await createPotentialOneShotJobWithRetry({
      ...buildPotentialJobRequest(
        promptRow,
        params.generation.oneshot_reference_file_id,
        params.generation.prompt_snapshot,
      ),
      generationId: params.generation.id,
      reason: "terminal-status",
    });

    const { error } = await supabaseAdmin
      .from("scoremax_ai_image_generations")
      .update({
        oneshot_job_id: job.id,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.generation.id)
      .eq("oneshot_job_id", params.previousJobId)
      .eq("status", "pending");

    if (error) {
      logger.warn(
        { err: error, generationId: params.generation.id },
        "Unable to persist retry OneShot job",
      );
      return null;
    }

    logger.info(
      {
        generationId: params.generation.id,
        previousJobId: params.previousJobId,
        retryJobId: job.id,
      },
      "Retrying onboarding potential image with a new OneShot job",
    );
    return job.id;
  } catch (error) {
    logger.warn(
      { err: error, generationId: params.generation.id },
      "Unable to create retry OneShot job",
    );
    return null;
  }
}

async function runPotentialPoll(generationId: string): Promise<void> {
  const { data: row, error: loadError } = await supabaseAdmin
    .from("scoremax_ai_image_generations")
    .select(
      "id, user_id, oneshot_job_id, status, prompt_snapshot, oneshot_reference_file_id",
    )
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

  let jobId = gen.oneshot_job_id;
  let remainingJobRetries = ONBOARDING_POTENTIAL_JOB_RETRY_LIMIT;
  const start = Date.now();
  let consecutivePollErrors = 0;

  while (Date.now() - start < ONBOARDING_POTENTIAL_MAX_WAIT_MS) {
    await sleep(ONBOARDING_POTENTIAL_POLL_INTERVAL_MS);

    try {
      const job = await getOneShotJob(jobId);
      consecutivePollErrors = 0;
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
        if (remainingJobRetries > 0) {
          remainingJobRetries -= 1;
          const retryJobId = await retryPotentialJobAfterTerminalFailure({
            generation: gen,
            previousJobId: jobId,
          });
          if (retryJobId) {
            jobId = retryJobId;
            consecutivePollErrors = 0;
            continue;
          }
        }

        await markGenerationFailed({
          generationId,
          code: job.error?.code ?? "ONESHOT_JOB_FAILED",
          message: job.error?.message ?? "OneShot job failed",
        });
        return;
      }
    } catch (error) {
      consecutivePollErrors += 1;
      const pollErrorMessage =
        error instanceof Error ? error.message : "Polling error";
      logger.warn(
        {
          err: error,
          generationId,
          jobId,
          consecutivePollErrors,
        },
        "Potential image poll tick failed; retrying",
      );

      if (
        consecutivePollErrors >=
        ONBOARDING_POTENTIAL_MAX_CONSECUTIVE_POLL_ERRORS
      ) {
        await markGenerationFailed({
          generationId,
          code: "POLLING_ERROR",
          message: pollErrorMessage,
        });
        return;
      }
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
}): Promise<TriggerPotentialImageResult> {
  const reusable = await findReusablePotentialGeneration(params.userId);
  if (reusable) {
    if (reusable.status === "pending" && reusable.oneshot_job_id) {
      dispatchPotentialImagePolling(reusable.id);
    }
    logger.info(
      { userId: params.userId, generationId: reusable.id, status: reusable.status },
      "Reusing existing onboarding potential image generation",
    );
    return { generationId: reusable.id, reused: true };
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
    if (isUniqueViolation(insertError)) {
      const raced = await findReusablePotentialGeneration(params.userId);
      if (raced) {
        if (raced.status === "pending" && raced.oneshot_job_id) {
          dispatchPotentialImagePolling(raced.id);
        }
        return { generationId: raced.id, reused: true };
      }
    }
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to create potential image generation row",
      details: insertError,
    });
  }

  const generationId = inserted.id as string;

  try {
    const job = await createPotentialOneShotJobWithRetry({
      ...buildPotentialJobRequest(promptRow, sign.fileId),
      generationId,
      reason: "initial",
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
    return { generationId, reused: false };
  } catch (error) {
    await markGenerationFailed({
      generationId,
      code: "ONESHOT_JOB_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create OneShot job",
    });
    throw error;
  }
}

function scanAssetRowToMediaAsset(row: {
  r2_bucket: string | null;
  r2_key: string;
  mime_type: string;
}): PotentialImageMediaAsset {
  return {
    bucket: row.r2_bucket,
    key: row.r2_key,
    mimeType: row.mime_type,
  };
}

async function loadLatestScanAssetMedia(params: {
  userId: string;
  sessionId: string;
  assetTypeCode: string;
}): Promise<PotentialImageMediaAsset | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("r2_bucket, r2_key, mime_type")
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

  return scanAssetRowToMediaAsset(
    data as { r2_bucket: string | null; r2_key: string; mime_type: string },
  );
}

async function loadLatestFaceFrontMediaForUser(
  userId: string,
): Promise<PotentialImageMediaAsset | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("r2_bucket, r2_key, mime_type, scan_sessions!inner(source)")
    .eq("user_id", userId)
    .eq("asset_type_code", "FACE_FRONT")
    .in("upload_status", ["uploaded", "validated"])
    .in("scan_sessions.source", ["onboarding", "manual_rescan"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.r2_key) {
    return null;
  }

  return scanAssetRowToMediaAsset(
    data as { r2_bucket: string | null; r2_key: string; mime_type: string },
  );
}

async function resolveSourceFaceMedia(params: {
  userId: string;
  sourceScanAssetId: string | null;
}): Promise<PotentialImageMediaAsset | null> {
  if (!params.sourceScanAssetId) {
    return loadLatestFaceFrontMediaForUser(params.userId);
  }

  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("r2_bucket, r2_key, mime_type")
    .eq("id", params.sourceScanAssetId)
    .eq("user_id", params.userId)
    .in("upload_status", ["uploaded", "validated"])
    .maybeSingle();

  if (error || !data?.r2_key) {
    return loadLatestFaceFrontMediaForUser(params.userId);
  }

  return scanAssetRowToMediaAsset(
    data as { r2_bucket: string | null; r2_key: string; mime_type: string },
  );
}

async function resolveMaskOverlayMedia(params: {
  userId: string;
  sourceScanAssetId: string | null;
}): Promise<PotentialImageMediaAsset | null> {
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
  const mask = await loadLatestScanAssetMedia({
    userId: params.userId,
    sessionId,
    assetTypeCode: "GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY",
  });

  if (mask) {
    return mask;
  }

  return loadLatestScanAssetMedia({
    userId: params.userId,
    sessionId,
    assetTypeCode: "FACE_FRONT",
  });
}

export async function getLatestPotentialImageForUser(
  userId: string,
  options: PotentialImagePayloadOptions = {},
): Promise<PotentialImagePayload | null> {
  const rows = await loadPotentialGenerationsForUser(userId);
  if (rows.length === 0) {
    return null;
  }

  const row = pickPreferredGenerationRow(rows);
  if (!row) {
    return null;
  }

  return generationRowToPayload(row, userId, options);
}

export async function getPotentialImageMediaAssetForUser(params: {
  userId: string;
  kind: PotentialImageMediaKind;
}): Promise<PotentialImageMediaAsset | null> {
  const rows = await loadPotentialGenerationsForUser(params.userId);
  const row = pickPreferredGenerationRow(rows);

  if (params.kind === "generated") {
    if (row?.status !== "completed" || !row.r2_key) {
      return null;
    }

    return {
      bucket: row.r2_bucket,
      key: row.r2_key,
      mimeType: row.result_content_type ?? "image/jpeg",
    };
  }

  if (params.kind === "source") {
    return resolveSourceFaceMedia({
      userId: params.userId,
      sourceScanAssetId: row?.source_scan_asset_id ?? null,
    });
  }

  return resolveMaskOverlayMedia({
    userId: params.userId,
    sourceScanAssetId: row?.source_scan_asset_id ?? null,
  });
}
