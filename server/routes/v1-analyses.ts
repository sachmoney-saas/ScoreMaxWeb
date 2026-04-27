import { Router } from "express";
import { z } from "zod";
import { analysesRequestSchema, type AnalysesRequest } from "@shared/oneshot";
import { runScoreMaxAnalyses } from "../lib/scoremax-client";
import { ApiError, mapUnknownError } from "../lib/errors";
import { validateBody, validateQuery } from "../lib/validate";
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

export function createV1AnalysesRouter(): Router {
  const router = Router();

  router.post(
    "/analyses",
    validateBody(analysesRequestSchema),
    async (req, res, next) => {
      let analysisJobId: string | null = null;

      try {
        const payload = req.body as AnalysesRequest;
        const metadata = analysesMetadataSchema.safeParse(
          payload.metadata ?? {},
        );
        if (!metadata.success) {
          throw new ApiError({
            code: "VALIDATION_ERROR",
            status: 400,
            message: "metadata.userId and metadata.sessionId are required",
            details: metadata.error.flatten(),
          });
        }

        const { userId, sessionId, source } = metadata.data;

        const { data: createdJob, error: createJobError } = await supabaseAdmin
          .from("analysis_jobs")
          .insert({
            user_id: userId,
            session_id: sessionId,
            trigger_source:
              source === "onboarding" ? "onboarding_auto" : "user_rerun",
            status: "queued",
            request_payload: payload as unknown as Record<string, unknown>,
          })
          .select("id, status, created_at")
          .single();

        if (createJobError || !createdJob) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to create analysis job",
            details: createJobError,
          });
        }

        analysisJobId = createdJob.id;

        await supabaseAdmin
          .from("analysis_jobs")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
          })
          .eq("id", analysisJobId);

        const referencedAssetCodes = Array.from(
          new Set(payload.analyses.map((analysis) => analysis.imageId)),
        );

        const { data: scanAssets } = await supabaseAdmin
          .from("scan_assets")
          .select("id, asset_type_code")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .in("asset_type_code", referencedAssetCodes);

        if (scanAssets && scanAssets.length > 0) {
          const jobAssetRows = scanAssets.map((asset) => ({
            analysis_job_id: analysisJobId,
            asset_type_code: asset.asset_type_code,
            scan_asset_id: asset.id,
            user_id: userId,
          }));

          await supabaseAdmin.from("analysis_job_assets").upsert(jobAssetRows, {
            onConflict: "analysis_job_id,asset_type_code",
          });
        }

        const data = await runScoreMaxAnalyses(payload);

        const resultRows = data.resultsByWorker.map((workerResult) => ({
          analysis_job_id: analysisJobId,
          user_id: userId,
          worker: workerResult.worker,
          prompt_version: workerResult.promptVersion,
          provider: workerResult.provider,
          result: workerResult as unknown as Record<string, unknown>,
        }));

        if (resultRows.length > 0) {
          const { error: insertResultError } = await supabaseAdmin
            .from("analysis_results")
            .insert(resultRows);

          if (insertResultError) {
            throw new ApiError({
              code: "INTERNAL_SERVER_ERROR",
              status: 500,
              message: "Unable to persist analysis results",
              details: insertResultError,
            });
          }
        }

        await supabaseAdmin
          .from("analysis_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            error_code: null,
            error_message: null,
          })
          .eq("id", analysisJobId);

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: {
            job: {
              id: analysisJobId,
              status: "completed",
            },
            analysis: data,
          },
          error: null,
        });
      } catch (error) {
        if (analysisJobId) {
          const mapped = mapUnknownError(error);
          await supabaseAdmin
            .from("analysis_jobs")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_code: mapped.code,
              error_message: mapped.message,
            })
            .eq("id", analysisJobId);
        }

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
          })),
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

        const { data: job, error: jobError } = await supabaseAdmin
          .from("analysis_jobs")
          .select("id")
          .eq("id", params.jobId)
          .eq("user_id", userId)
          .maybeSingle();

        if (jobError || !job) {
          throw new ApiError({
            code: "VALIDATION_ERROR",
            status: 404,
            message: "Analysis job not found",
            details: jobError,
          });
        }

        const { error: resultsError } = await supabaseAdmin
          .from("analysis_results")
          .delete()
          .eq("analysis_job_id", params.jobId)
          .eq("user_id", userId);

        if (resultsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to delete analysis results",
            details: resultsError,
          });
        }

        const { error: assetsError } = await supabaseAdmin
          .from("analysis_job_assets")
          .delete()
          .eq("analysis_job_id", params.jobId)
          .eq("user_id", userId);

        if (assetsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to delete analysis assets",
            details: assetsError,
          });
        }

        const { error: deleteJobError } = await supabaseAdmin
          .from("analysis_jobs")
          .delete()
          .eq("id", params.jobId)
          .eq("user_id", userId);

        if (deleteJobError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to delete analysis job",
            details: deleteJobError,
          });
        }

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: { id: params.jobId },
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
