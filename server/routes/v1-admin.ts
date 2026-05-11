import { Router } from "express";
import { z } from "zod";
import { isSignedUploadScanAssetCode } from "@shared/schema";
import { deleteAnalysisJobAndAssets } from "../lib/analysis-cleanup";
import { summarizeStoredAnalysisRequestPayloadForAdmin } from "../lib/analysis-admin-snapshot";
import { parseGuideTraceMetricsFromStoredRequestPayload } from "../lib/analysis-orchestration";
import { requireAdminUser } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { downloadR2Object, getDefaultR2Bucket } from "../lib/r2-storage";
import {
  getPremiumAccessState,
  grantManualSubscription,
  revokeSubscription,
} from "../lib/subscriptions";
import { supabaseAdmin } from "../lib/supabase-admin";

const adminFailuresQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  errorCode: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const analysisJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const adminAnalysisJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  status: z.enum(["all", "failed", "completed", "queued", "running"]).default("all"),
  search: z.string().trim().optional(),
});

const adminJobAssetQuerySchema = z.object({
  assetTypeCode: z.string().refine(
    (code): boolean => isSignedUploadScanAssetCode(code),
    { message: "Invalid asset type code" },
  ),
});

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

const grantSubscriptionBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
    /** Optional ISO 8601 datetime. Omit (or null) for perpetual manual access. */
    endsAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
  })
  .strict();

const revokeSubscriptionBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

type AnalysisFailureRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  status: string;
  trigger_source: string | null;
  version: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  failed_at: string | null;
  completed_at: string | null;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
};

type AssetCountRow = {
  analysis_job_id?: string | null;
  session_id?: string | null;
};

function countByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string") {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

export function createV1AdminRouter(): Router {
  const router = Router();

  router.get("/admin/analysis-failures", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const query = adminFailuresQuerySchema.parse(req.query);

      let jobsQuery = supabaseAdmin
        .from("analysis_jobs")
        .select(
          "id, user_id, session_id, status, trigger_source, version, error_code, error_message, created_at, started_at, failed_at, completed_at",
        )
        .eq("status", "failed")
        .order("failed_at", { ascending: false, nullsFirst: false })
        .limit(query.limit);

      if (query.errorCode) {
        jobsQuery = jobsQuery.eq("error_code", query.errorCode);
      }

      if (query.userId) {
        jobsQuery = jobsQuery.eq("user_id", query.userId);
      }

      const { data: jobsData, error: jobsError } = await jobsQuery;
      if (jobsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load analysis failures",
          details: jobsError,
        });
      }

      const jobs = (jobsData ?? []) as AnalysisFailureRow[];
      const userIds = Array.from(new Set(jobs.map((job) => job.user_id)));
      const jobIds = jobs.map((job) => job.id);
      const sessionIds = Array.from(
        new Set(jobs.map((job) => job.session_id).filter((id): id is string => typeof id === "string")),
      );

      let profilesById = new Map<string, ProfileLookupRow>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        if (profilesError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load failure profiles",
            details: profilesError,
          });
        }

        profilesById = new Map(
          ((profiles ?? []) as ProfileLookupRow[]).map((profile) => [profile.id, profile]),
        );
      }

      let assetCountsByJob = new Map<string, number>();
      if (jobIds.length > 0) {
        const { data: jobAssets, error: jobAssetsError } = await supabaseAdmin
          .from("analysis_job_assets")
          .select("analysis_job_id")
          .in("analysis_job_id", jobIds);

        if (jobAssetsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load failure asset counts",
            details: jobAssetsError,
          });
        }

        assetCountsByJob = countByKey((jobAssets ?? []) as AssetCountRow[], "analysis_job_id");
      }

      let scanAssetCountsBySession = new Map<string, number>();
      if (sessionIds.length > 0) {
        const { data: scanAssets, error: scanAssetsError } = await supabaseAdmin
          .from("scan_assets")
          .select("session_id")
          .in("session_id", sessionIds);

        if (scanAssetsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load failure scan asset counts",
            details: scanAssetsError,
          });
        }

        scanAssetCountsBySession = countByKey((scanAssets ?? []) as AssetCountRow[], "session_id");
      }

      const failures = jobs
        .map((job) => ({
          ...job,
          user_email: profilesById.get(job.user_id)?.email ?? null,
          asset_count: assetCountsByJob.get(job.id) ?? 0,
          scan_asset_count: job.session_id ? (scanAssetCountsBySession.get(job.session_id) ?? 0) : 0,
        }))
        .filter((job) => {
          if (!query.search) {
            return true;
          }

          const search = query.search.toLowerCase();
          return [
            job.id,
            job.user_id,
            job.user_email,
            job.session_id,
            job.error_code,
            job.error_message,
          ].some((value) => value?.toLowerCase().includes(search));
        });

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { failures },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/analysis-jobs", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const query = adminAnalysisJobsQuerySchema.parse(req.query);

      let jobsQuery = supabaseAdmin
        .from("analysis_jobs")
        .select(
          "id, user_id, session_id, status, trigger_source, version, error_code, error_message, created_at, started_at, failed_at, completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(query.limit);

      if (query.status !== "all") {
        jobsQuery = jobsQuery.eq("status", query.status);
      }

      const { data: jobsData, error: jobsError } = await jobsQuery;
      if (jobsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load analysis jobs",
          details: jobsError,
        });
      }

      const jobs = (jobsData ?? []) as AnalysisFailureRow[];
      const userIds = Array.from(new Set(jobs.map((j) => j.user_id)));
      const jobIds = jobs.map((j) => j.id);
      const sessionIds = Array.from(
        new Set(jobs.map((j) => j.session_id).filter((id): id is string => typeof id === "string")),
      );

      let profilesById = new Map<string, ProfileLookupRow>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        if (profilesError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load job profiles",
            details: profilesError,
          });
        }

        profilesById = new Map(
          ((profiles ?? []) as ProfileLookupRow[]).map((profile) => [profile.id, profile]),
        );
      }

      let assetCountsByJob = new Map<string, number>();
      if (jobIds.length > 0) {
        const { data: jobAssets, error: jobAssetsError } = await supabaseAdmin
          .from("analysis_job_assets")
          .select("analysis_job_id")
          .in("analysis_job_id", jobIds);

        if (jobAssetsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load asset counts",
            details: jobAssetsError,
          });
        }

        assetCountsByJob = countByKey((jobAssets ?? []) as AssetCountRow[], "analysis_job_id");
      }

      let scanAssetCountsBySession = new Map<string, number>();
      if (sessionIds.length > 0) {
        const { data: scanAssets, error: scanAssetsError } = await supabaseAdmin
          .from("scan_assets")
          .select("session_id")
          .in("session_id", sessionIds);

        if (scanAssetsError) {
          throw new ApiError({
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            message: "Unable to load scan asset counts",
            details: scanAssetsError,
          });
        }

        scanAssetCountsBySession = countByKey((scanAssets ?? []) as AssetCountRow[], "session_id");
      }

      const enriched = jobs.map((job) => ({
        ...job,
        user_email: profilesById.get(job.user_id)?.email ?? null,
        asset_count: assetCountsByJob.get(job.id) ?? 0,
        scan_asset_count: job.session_id ? (scanAssetCountsBySession.get(job.session_id) ?? 0) : 0,
      }));

      const jobsOut =
        query.search?.trim().length
          ? enriched.filter((job) => {
              const s = query.search!.toLowerCase();
              return [
                job.id,
                job.user_id,
                job.user_email,
                job.session_id,
                job.error_code,
                job.error_message,
                job.status,
              ].some((value) => value?.toLowerCase().includes(s));
            })
          : enriched;

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { jobs: jobsOut },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/analysis-jobs/:jobId", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const params = analysisJobParamsSchema.parse(req.params);

      const { data: jobRaw, error: jobError } = await supabaseAdmin
        .from("analysis_jobs")
        .select(
          "id, user_id, session_id, status, trigger_source, version, error_code, error_message, created_at, started_at, failed_at, completed_at, request_payload",
        )
        .eq("id", params.jobId)
        .maybeSingle();

      if (jobError || !jobRaw) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 404,
          message: "Analysis job not found",
          details: jobError,
        });
      }

      const jobRow = jobRaw as AnalysisFailureRow & { request_payload?: unknown };

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .eq("id", jobRow.user_id)
        .maybeSingle();

      const { data: results, error: resultsError } = await supabaseAdmin
        .from("analysis_results")
        .select("worker, prompt_version, result, created_at")
        .eq("analysis_job_id", params.jobId)
        .eq("user_id", jobRow.user_id)
        .order("created_at", { ascending: true });

      if (resultsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load analysis results",
          details: resultsError,
        });
      }

      const { data: jobAssets } = await supabaseAdmin
        .from("analysis_job_assets")
        .select("asset_type_code, scan_asset_id")
        .eq("analysis_job_id", params.jobId);

      const captureGuideMetrics = parseGuideTraceMetricsFromStoredRequestPayload(jobRow.request_payload);
      const requestPayloadSummary = summarizeStoredAnalysisRequestPayloadForAdmin(jobRow.request_payload);

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: {
          job: {
            id: jobRow.id,
            user_id: jobRow.user_id,
            session_id: jobRow.session_id,
            status: jobRow.status,
            trigger_source: jobRow.trigger_source,
            version: jobRow.version,
            error_code: jobRow.error_code,
            error_message: jobRow.error_message,
            created_at: jobRow.created_at,
            started_at: jobRow.started_at,
            failed_at: jobRow.failed_at,
            completed_at: jobRow.completed_at,
          },
          user_email: (profile as ProfileLookupRow | null)?.email ?? null,
          results: results ?? [],
          capture_guide_metrics: captureGuideMetrics,
          request_payload: jobRow.request_payload ?? null,
          request_payload_summary: requestPayloadSummary,
          linked_assets: (jobAssets ?? []).map((a) => ({
            asset_type_code: a.asset_type_code as string,
            scan_asset_id: a.scan_asset_id as string,
          })),
          oneshot_images: Array.isArray((jobRow.request_payload as { images?: unknown } | null)?.images)
            ? ((jobRow.request_payload as { images: Array<{ imageId?: string; mimeType?: string; base64?: string }> }).images ?? []).map((image) => ({
                imageId: image.imageId ?? "",
                mimeType: image.mimeType ?? "",
                base64: image.base64 ?? "",
              }))
            : [],
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/analysis-jobs/:jobId/asset", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const params = analysisJobParamsSchema.parse(req.params);
      const { assetTypeCode } = adminJobAssetQuerySchema.parse(req.query);

      const { data: job, error: jobError } = await supabaseAdmin
        .from("analysis_jobs")
        .select("id, user_id")
        .eq("id", params.jobId)
        .maybeSingle();

      if (jobError || !job) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Analysis job not found",
          details: jobError,
        });
      }

      const ownerId = job.user_id as string;

      const { data: jobAsset, error: jobAssetError } = await supabaseAdmin
        .from("analysis_job_assets")
        .select("scan_asset_id")
        .eq("analysis_job_id", params.jobId)
        .eq("user_id", ownerId)
        .eq("asset_type_code", assetTypeCode)
        .maybeSingle();

      if (jobAssetError || !jobAsset) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Analysis asset not found",
          details: jobAssetError,
        });
      }

      const { data: scanAsset, error: scanAssetError } = await supabaseAdmin
        .from("scan_assets")
        .select("id, r2_bucket, r2_key, mime_type")
        .eq("id", jobAsset.scan_asset_id)
        .eq("user_id", ownerId)
        .maybeSingle();

      if (scanAssetError || !scanAsset) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Scan asset not found",
          details: scanAssetError,
        });
      }

      type ThumbRow = { r2_bucket: string | null; r2_key: string; mime_type: string };
      const asset = scanAsset as ThumbRow;
      let image: Blob;
      try {
        image = await downloadR2Object({
          bucket: asset.r2_bucket || getDefaultR2Bucket(),
          key: asset.r2_key,
        });
      } catch (downloadError) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Unable to download asset",
          details: downloadError,
        });
      }

      const arrayBuffer = await image.arrayBuffer();
      res.setHeader("Content-Type", asset.mime_type);
      res.setHeader("Cache-Control", "private, max-age=60");
      res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/users/:userId/subscription", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const params = userIdParamsSchema.parse(req.params);
      const state = await getPremiumAccessState(params.userId);
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: state,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:userId/subscription/grant", async (req, res, next) => {
    try {
      const admin = await requireAdminUser(req.headers.authorization);
      const params = userIdParamsSchema.parse(req.params);
      const body = grantSubscriptionBodySchema.parse(req.body ?? {});
      const state = await grantManualSubscription({
        userId: params.userId,
        actorUserId: admin.id,
        reason: body.reason ?? null,
        endsAt: body.endsAt ?? null,
      });
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: state,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:userId/subscription/revoke", async (req, res, next) => {
    try {
      const admin = await requireAdminUser(req.headers.authorization);
      const params = userIdParamsSchema.parse(req.params);
      const body = revokeSubscriptionBodySchema.parse(req.body ?? {});
      const state = await revokeSubscription({
        userId: params.userId,
        actorUserId: admin.id,
        reason: body.reason ?? null,
      });
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: state,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/analysis-jobs/:jobId", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const params = analysisJobParamsSchema.parse(req.params);
      const deleted = await deleteAnalysisJobAndAssets({
        jobId: params.jobId,
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
  });

  router.delete("/admin/analysis-failures/:jobId", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const params = analysisJobParamsSchema.parse(req.params);
      const deleted = await deleteAnalysisJobAndAssets({
        jobId: params.jobId,
        failedOnly: true,
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
  });

  return router;
}
