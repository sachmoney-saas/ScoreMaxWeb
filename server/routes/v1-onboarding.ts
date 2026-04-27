import { Router } from "express";
import { analysesRequestSchema, type AnalysesResponse } from "@shared/oneshot";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { ApiError, mapUnknownError } from "../lib/errors";
import { runScoreMaxAnalyses } from "../lib/scoremax-client";
import { supabaseAdmin } from "../lib/supabase-admin";

const requiredAssetCodes: OnboardingScanAssetCode[] = [
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

type ScanSessionRow = {
  id: string;
  user_id: string;
  source: string;
  status: string;
  required_asset_count: number;
  completed_asset_count: number;
};

type ScanAssetRow = {
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

function getBearerToken(authorizationHeader: string | undefined): string {
  const [scheme, token] = authorizationHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new ApiError({
      code: "API_KEY_MISSING",
      status: 401,
      message: "Missing Supabase access token",
    });
  }

  return token;
}

async function requireUserId(authorizationHeader: string | undefined): Promise<string> {
  const token = getBearerToken(authorizationHeader);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Invalid Supabase access token",
    });
  }

  return data.user.id;
}

async function loadReadyOnboardingSession(userId: string): Promise<ScanSessionRow> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, user_id, source, status, required_asset_count, completed_asset_count")
    .eq("user_id", userId)
    .eq("source", "onboarding")
    .in("status", ["collecting", "ready", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "No active onboarding scan session found",
      details: error,
    });
  }

  const session = data as ScanSessionRow;
  const { error: refreshError } = await supabaseAdmin.rpc(
    "scoremax_refresh_scan_session_progress",
    { target_session: session.id },
  );

  if (refreshError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to refresh scan progress",
      details: refreshError,
    });
  }

  const { data: refreshedSession, error: refreshedError } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, user_id, source, status, required_asset_count, completed_asset_count")
    .eq("id", session.id)
    .single();

  if (refreshedError || !refreshedSession) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load refreshed scan session",
      details: refreshedError,
    });
  }

  const refreshed = refreshedSession as ScanSessionRow;
  if (refreshed.completed_asset_count < refreshed.required_asset_count) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Onboarding scan is incomplete",
    });
  }

  return refreshed;
}

async function loadRequiredAssets(params: {
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

async function buildPayload(params: {
  userId: string;
  sessionId: string;
  assets: ScanAssetRow[];
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
      source: "onboarding",
      userId: params.userId,
      sessionId: params.sessionId,
    },
  });
}

async function getNextAnalysisVersion(sessionId: string): Promise<number> {
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

async function createAnalysisJob(params: {
  userId: string;
  sessionId: string;
  payload: unknown;
}): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const version = await getNextAnalysisVersion(params.sessionId);
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .insert({
        user_id: params.userId,
        session_id: params.sessionId,
        trigger_source: "onboarding_auto",
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

async function processAnalysisJob(params: {
  jobId: string;
  userId: string;
  sessionId: string;
  assets: ScanAssetRow[];
  payload: ReturnType<typeof analysesRequestSchema.parse>;
}): Promise<void> {
  try {
    await supabaseAdmin
      .from("analysis_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", params.jobId);

    await supabaseAdmin.from("analysis_job_assets").upsert(
      params.assets.map((asset) => ({
        analysis_job_id: params.jobId,
        asset_type_code: asset.asset_type_code,
        scan_asset_id: asset.id,
        user_id: params.userId,
      })),
      { onConflict: "analysis_job_id,asset_type_code" },
    );

    const analysis: AnalysesResponse = await runScoreMaxAnalyses(params.payload);

    if (analysis.resultsByWorker.length > 0) {
      const { error: insertResultsError } = await supabaseAdmin
        .from("analysis_results")
        .insert(
          analysis.resultsByWorker.map((workerResult) => ({
            analysis_job_id: params.jobId,
            user_id: params.userId,
            worker: workerResult.worker,
            prompt_version: workerResult.promptVersion,
            provider: workerResult.provider,
            result: workerResult as unknown as Record<string, unknown>,
          })),
        );

      if (insertResultsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: insertResultsError.message || "Unable to persist analysis results",
          details: insertResultsError,
        });
      }
    }

    await supabaseAdmin
      .from("profiles")
      .update({ has_completed_onboarding: true })
      .eq("id", params.userId);

    await supabaseAdmin
      .from("scan_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", params.sessionId);

    await supabaseAdmin
      .from("analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", params.jobId);
  } catch (error) {
    const mapped = mapUnknownError(error);
    await supabaseAdmin
      .from("analysis_jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_code: mapped.code,
        error_message: mapped.message,
      })
      .eq("id", params.jobId);
  }
}

export function createV1OnboardingRouter(): Router {
  const router = Router();

  router.post("/onboarding/complete", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const session = await loadReadyOnboardingSession(userId);
      const assets = await loadRequiredAssets({ userId, sessionId: session.id });
      const payload = await buildPayload({ userId, sessionId: session.id, assets });
      const jobId = await createAnalysisJob({
        userId,
        sessionId: session.id,
        payload,
      });

      void processAnalysisJob({ jobId, userId, sessionId: session.id, assets, payload });

      res.status(202).json({
        ok: true,
        httpStatus: 202,
        data: {
          job: {
            id: jobId,
            status: "queued",
          },
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/onboarding/analysis/:jobId", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const { data: job, error } = await supabaseAdmin
        .from("analysis_jobs")
        .select("id, status, error_code, error_message, started_at, completed_at, failed_at")
        .eq("id", req.params.jobId)
        .eq("user_id", userId)
        .single();

      if (error || !job) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 404,
          message: "Analysis job not found",
          details: error,
        });
      }

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { job },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
