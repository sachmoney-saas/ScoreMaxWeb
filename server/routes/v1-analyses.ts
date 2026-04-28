import { Router } from "express";
import { z } from "zod";
import { analysesRequestSchema, type AnalysesRequest } from "@shared/oneshot";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { deleteAnalysisJobAndAssets } from "../lib/analysis-cleanup";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "../lib/analysis-jobs";
import { ApiError } from "../lib/errors";
import { validateBody, validateQuery } from "../lib/validate";
import {
  buildPayload,
  createAnalysisJob,
  loadRequiredAssets,
  refreshScanSessionProgress,
  requiredAssetCodes,
  type ScanSessionRow,
} from "../lib/analysis-orchestration";
import { requireUserId } from "../lib/auth";
import { supabaseAdmin } from "../lib/supabase-admin";

const analysesMetadataSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  source: z.string().optional(),
});

const latestAnalysisQuerySchema = z.object({
  userId: z.string().min(1),
});

const analysisJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const manualSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

type AnalysisJobAssetRow = {
  analysis_job_id: string;
  asset_type_code: string;
  scan_asset_id: string;
};

type ScanAssetThumbnailRow = {
  id: string;
  r2_bucket: string | null;
  r2_key: string;
  mime_type: "image/jpeg" | "image/png";
};

async function loadManualSession(params: {
  sessionId: string;
  userId: string;
}): Promise<ScanSessionRow> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, user_id, source, status, required_asset_count, completed_asset_count")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("source", "manual_rescan")
    .maybeSingle();

  if (error || !data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Manual analysis session not found",
      details: error,
    });
  }

  return data as ScanSessionRow;
}

async function getManualSessionStatus(params: {
  sessionId: string;
  userId: string;
}) {
  const session = await loadManualSession(params);
  await refreshScanSessionProgress(session.id);

  const { data: refreshedSession, error: refreshedSessionError } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, required_asset_count, completed_asset_count")
    .eq("id", session.id)
    .eq("user_id", params.userId)
    .single();

  if (refreshedSessionError || !refreshedSession) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load manual analysis session status",
      details: refreshedSessionError,
    });
  }

  const { data: uploadedAssets, error: uploadedAssetsError } = await supabaseAdmin
    .from("scan_assets")
    .select("asset_type_code")
    .eq("session_id", session.id)
    .eq("user_id", params.userId)
    .in("asset_type_code", requiredAssetCodes)
    .in("upload_status", ["uploaded", "validated"]);

  if (uploadedAssetsError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load uploaded scan assets",
      details: uploadedAssetsError,
    });
  }

  const uploadedAssetCodes = new Set(
    (uploadedAssets ?? [])
      .map((asset) => asset.asset_type_code as OnboardingScanAssetCode | null)
      .filter((code): code is OnboardingScanAssetCode => typeof code === "string"),
  );
  const missingAssetTypes = requiredAssetCodes.filter(
    (code) => !uploadedAssetCodes.has(code),
  );

  return {
    session_id: session.id,
    required_asset_count: Number(refreshedSession.required_asset_count ?? 0),
    completed_asset_count: Number(refreshedSession.completed_asset_count ?? 0),
    is_ready: missingAssetTypes.length === 0,
    missing_asset_types: missingAssetTypes,
  };
}

export function createV1AnalysesRouter(): Router {
  const router = Router();

  router.post("/analyses/manual-session", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const { data: session, error } = await supabaseAdmin
        .from("scan_sessions")
        .insert({
          user_id: userId,
          source: "manual_rescan",
          status: "collecting",
          required_asset_count: requiredAssetCodes.length,
          completed_asset_count: 0,
        })
        .select("id, source, status, required_asset_count, completed_asset_count")
        .single();

      if (error || !session) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to create manual analysis session",
          details: error,
        });
      }

      res.status(201).json({
        ok: true,
        httpStatus: 201,
        data: {
          session,
          required_asset_codes: requiredAssetCodes,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyses/manual-session/:sessionId/status", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const params = manualSessionParamsSchema.parse(req.params);
      const status = await getManualSessionStatus({
        sessionId: params.sessionId,
        userId,
      });

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: status,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/analyses/manual-session/:sessionId/launch", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const params = manualSessionParamsSchema.parse(req.params);
      const session = await loadManualSession({ sessionId: params.sessionId, userId });
      const status = await getManualSessionStatus({ sessionId: session.id, userId });

      if (!status.is_ready) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 400,
          message: "Manual analysis session is incomplete",
          details: { missingAssetCodes: status.missing_asset_types },
        });
      }

      const assets = await loadRequiredAssets({ userId, sessionId: session.id });
      const payload = await buildPayload({
        userId,
        sessionId: session.id,
        assets,
        source: "manual_rescan",
      });
      const jobId = await createAnalysisJob({
        userId,
        sessionId: session.id,
        payload,
        triggerSource: "user_rerun",
      });
      await persistAnalysisJobAssets({
        jobId,
        userId,
        sessionId: session.id,
        payload,
      });

      await supabaseAdmin
        .from("scan_sessions")
        .update({ status: "processing" })
        .eq("id", session.id)
        .eq("user_id", userId);

      dispatchAnalysisJob(jobId);

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

  router.get("/analyses/jobs/:jobId", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const params = analysisJobParamsSchema.parse(req.params);
      const { data: job, error } = await supabaseAdmin
        .from("analysis_jobs")
        .select("id, status, error_code, error_message, started_at, completed_at, failed_at, session_id, version")
        .eq("id", params.jobId)
        .eq("user_id", userId)
        .maybeSingle();

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

  router.post(
    "/analyses",
    validateBody(analysesRequestSchema),
    async (req, res, next) => {
      try {
        const payload = req.body as AnalysesRequest;
        const metadata = analysesMetadataSchema.safeParse(payload.metadata ?? {});
        if (!metadata.success) {
          throw new ApiError({
            code: "VALIDATION_ERROR",
            status: 400,
            message: "metadata.userId and metadata.sessionId are required",
            details: metadata.error.flatten(),
          });
        }

        const { userId, sessionId, source } = metadata.data;
        const jobId = await createAnalysisJob({
          userId,
          sessionId,
          payload,
          triggerSource: source === "onboarding" ? "onboarding_auto" : "user_rerun",
        });
        await persistAnalysisJobAssets({
          jobId,
          userId,
          sessionId,
          payload,
        });

        dispatchAnalysisJob(jobId);

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
    },
  );

  router.get(
    "/analyses/history",
    validateQuery(latestAnalysisQuerySchema),
    async (req, res, next) => {
      try {
        const { userId } = req.query as z.infer<typeof latestAnalysisQuerySchema>;

        const { data: jobs, error: jobsError } = await supabaseAdmin
          .from("analysis_jobs")
          .select("id, status, version, created_at, completed_at")
          .eq("user_id", userId)
          .neq("status", "failed")
          .order("created_at", { ascending: false });

        if (jobsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load analysis history",
            details: jobsError,
          });
        }

        const jobIds = (jobs ?? []).map((job) => job.id as string);
        const thumbnailAssetByJobId = new Map<string, string>();
        const resultsByJobId = new Map<string, Array<{ worker: string; result: Record<string, unknown> }>>();

        if (jobIds.length > 0) {
          const { data: jobAssets, error: jobAssetsError } = await supabaseAdmin
            .from("analysis_job_assets")
            .select("analysis_job_id, asset_type_code, scan_asset_id")
            .in("analysis_job_id", jobIds)
            .eq("user_id", userId)
            .eq("asset_type_code", "FACE_FRONT");

          if (jobAssetsError) {
            throw new ApiError({
              code: "INTERNAL_SERVER_ERROR",
              status: 500,
              message: "Unable to load analysis thumbnails",
              details: jobAssetsError,
            });
          }

          for (const asset of (jobAssets ?? []) as AnalysisJobAssetRow[]) {
            thumbnailAssetByJobId.set(asset.analysis_job_id, asset.scan_asset_id);
          }

          const { data: results, error: resultsError } = await supabaseAdmin
            .from("analysis_results")
            .select("analysis_job_id, worker, result")
            .in("analysis_job_id", jobIds)
            .eq("user_id", userId);

          if (resultsError) {
            throw new ApiError({
              code: "INTERNAL_SERVER_ERROR",
              status: 500,
              message: "Unable to load analysis history results",
              details: resultsError,
            });
          }

          for (const result of results ?? []) {
            const jobId = result.analysis_job_id as string;
            const jobResults = resultsByJobId.get(jobId) ?? [];
            jobResults.push({
              worker: result.worker as string,
              result: result.result as Record<string, unknown>,
            });
            resultsByJobId.set(jobId, jobResults);
          }
        }

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: (jobs ?? []).map((job) => ({
            id: job.id,
            status: job.status,
            version: job.version,
            created_at: job.created_at,
            completed_at: job.completed_at,
            has_thumbnail: thumbnailAssetByJobId.has(job.id as string),
            results: resultsByJobId.get(job.id as string) ?? [],
          })),
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/analyses/:jobId([0-9a-fA-F-]{36})",
    validateQuery(latestAnalysisQuerySchema),
    async (req, res, next) => {
      try {
        const params = analysisJobParamsSchema.parse(req.params);
        const { userId } = req.query as z.infer<typeof latestAnalysisQuerySchema>;

        const { data: job, error: jobError } = await supabaseAdmin
          .from("analysis_jobs")
          .select(
            "id, status, trigger_source, version, started_at, completed_at, failed_at, error_code, error_message, created_at",
          )
          .eq("id", params.jobId)
          .eq("user_id", userId)
          .maybeSingle();

        if (jobError || !job) {
          throw new ApiError({
            code: "VALIDATION_ERROR",
            status: 404,
            message: "Analysis not found",
            details: jobError,
          });
        }

        const { data: results, error: resultsError } = await supabaseAdmin
          .from("analysis_results")
          .select("worker, prompt_version, result, created_at")
          .eq("analysis_job_id", params.jobId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (resultsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load analysis results",
            details: resultsError,
          });
        }

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: {
            job,
            results: results ?? [],
          },
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/analyses/:jobId/thumbnail",
    validateQuery(latestAnalysisQuerySchema),
    async (req, res, next) => {
      try {
        const params = analysisJobParamsSchema.parse(req.params);
        const { userId } = req.query as z.infer<typeof latestAnalysisQuerySchema>;

        const { data: job, error: jobError } = await supabaseAdmin
          .from("analysis_jobs")
          .select("id")
          .eq("id", params.jobId)
          .eq("user_id", userId)
          .maybeSingle();

        if (jobError || !job) {
          throw new ApiError({
            code: "IMAGE_NOT_FOUND",
            status: 404,
            message: "Analysis thumbnail not found",
            details: jobError,
          });
        }

        const { data: jobAsset, error: jobAssetError } = await supabaseAdmin
          .from("analysis_job_assets")
          .select("scan_asset_id")
          .eq("analysis_job_id", params.jobId)
          .eq("user_id", userId)
          .eq("asset_type_code", "FACE_FRONT")
          .maybeSingle();

        if (jobAssetError || !jobAsset) {
          throw new ApiError({
            code: "IMAGE_NOT_FOUND",
            status: 404,
            message: "Analysis thumbnail not found",
            details: jobAssetError,
          });
        }

        const { data: scanAsset, error: scanAssetError } = await supabaseAdmin
          .from("scan_assets")
          .select("id, r2_bucket, r2_key, mime_type")
          .eq("id", jobAsset.scan_asset_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (scanAssetError || !scanAsset) {
          throw new ApiError({
            code: "IMAGE_NOT_FOUND",
            status: 404,
            message: "Analysis thumbnail not found",
            details: scanAssetError,
          });
        }

        const asset = scanAsset as ScanAssetThumbnailRow;
        const { data: image, error: downloadError } = await supabaseAdmin.storage
          .from(asset.r2_bucket || "scan-assets")
          .download(asset.r2_key);

        if (downloadError || !image) {
          throw new ApiError({
            code: "IMAGE_NOT_FOUND",
            status: 404,
            message: "Analysis thumbnail not found",
            details: downloadError,
          });
        }

        const arrayBuffer = await image.arrayBuffer();
        res.setHeader("Content-Type", asset.mime_type);
        res.setHeader("Cache-Control", "private, max-age=120");
        res.status(200).send(Buffer.from(arrayBuffer));
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/analyses/:jobId",
    validateQuery(latestAnalysisQuerySchema),
    async (req, res, next) => {
      try {
        const params = analysisJobParamsSchema.parse(req.params);
        const { userId } = req.query as z.infer<typeof latestAnalysisQuerySchema>;

        const deleted = await deleteAnalysisJobAndAssets({
          jobId: params.jobId,
          userId,
          deleteSessionIfOrphaned: true,
        });

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: deleted,
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/analyses/latest",
    validateQuery(latestAnalysisQuerySchema),
    async (req, res, next) => {
      try {
        const { userId } = req.query as z.infer<
          typeof latestAnalysisQuerySchema
        >;

        const { data: latestJob, error: latestJobError } = await supabaseAdmin
          .from("analysis_jobs")
          .select(
            "id, status, trigger_source, started_at, completed_at, failed_at, error_code, error_message, created_at",
          )
          .eq("user_id", userId)
          .neq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestJobError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load latest analysis job",
            details: latestJobError,
          });
        }

        if (!latestJob) {
          res.status(200).json({
            ok: true,
            httpStatus: 200,
            data: null,
            error: null,
          });
          return;
        }

        const { data: results, error: resultsError } = await supabaseAdmin
          .from("analysis_results")
          .select("worker, prompt_version, result, created_at")
          .eq("analysis_job_id", latestJob.id)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (resultsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load latest analysis results",
            details: resultsError,
          });
        }

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: {
            job: latestJob,
            results: results ?? [],
          },
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
