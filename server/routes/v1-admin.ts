import { Router } from "express";
import { z } from "zod";
import { isSignedUploadScanAssetCode } from "@shared/schema";
import { oneshotAspectRatioSchema, oneshotModelVariantSchema } from "@shared/oneshot-image";
import { deleteAnalysisJobAndAssets } from "../lib/analysis-cleanup";
import { summarizeStoredAnalysisRequestPayloadForAdmin } from "../lib/analysis-admin-snapshot";
import { parseGuideTraceMetricsFromStoredRequestPayload } from "../lib/analysis-orchestration";
import {
  applyLocalEyeCanthalTiltToResultRows,
  mergeEyeCanthalTiltIntoCaptureGuideMetrics,
  tryLoadLatestEyeCanthalTiltDeg,
} from "../lib/analysis-local-canthal";
import { requireAdminUser } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { downloadR2Object, getDefaultR2Bucket } from "../lib/r2-storage";
import {
  reconcileDodoSubscriptionById,
  reconcileDodoSubscriptions,
} from "../lib/dodo/reconciliation";
import { kickoffMissingPaidAnalyses } from "../lib/post-payment-analysis-rescue";
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

const adminWebhookFailuresQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  includeProcessed: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

type DodoWebhookFailureRow = {
  webhook_id: string;
  event_type: string;
  error: string | null;
  received_at: string;
  processed_at: string | null;
  payload: unknown;
};

const adminClientErrorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const analysisJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const adminAnalysisJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["all", "failed", "completed", "queued", "running"]).default("all"),
  search: z.string().trim().optional(),
});

const adminJobAssetQuerySchema = z.object({
  assetTypeCode: z.string().refine(
    (code): boolean => isSignedUploadScanAssetCode(code),
    { message: "Invalid asset type code" },
  ),
});

const adminAiImagePromptKeyParamsSchema = z.object({
  key: z.string().min(1),
});

const adminAiImagePromptPatchSchema = z
  .object({
    prompt: z.string().min(1).max(3000).optional(),
    model_variant: oneshotModelVariantSchema.optional(),
    aspect_ratio: oneshotAspectRatioSchema.optional(),
    safety_filters: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

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

type ClientErrorReportRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  source: string;
  message: string;
  error_code: string | null;
  error_detail: string | null;
  error_hint: string | null;
  payload: unknown;
  client_route: string | null;
  user_agent: string | null;
  app_version: string | null;
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

  router.get("/admin/client-errors", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const query = adminClientErrorsQuerySchema.parse(req.query);

      let rowsQuery = supabaseAdmin
        .from("client_error_reports")
        .select(
          "id, created_at, user_id, source, message, error_code, error_detail, error_hint, payload, client_route, user_agent, app_version",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      if (query.source) {
        rowsQuery = rowsQuery.eq("source", query.source);
      }

      if (query.search) {
        const search = query.search.replace(/,/g, " ").trim();
        rowsQuery = rowsQuery.or(
          [
            `message.ilike.%${search}%`,
            `source.ilike.%${search}%`,
            `error_code.ilike.%${search}%`,
            `user_id.ilike.%${search}%`,
            `client_route.ilike.%${search}%`,
          ].join(","),
        );
      }

      rowsQuery = rowsQuery.range(query.offset, query.offset + query.limit - 1);

      const { data: rowsData, error: rowsError, count } = await rowsQuery;
      if (rowsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load client error reports",
          details: rowsError,
        });
      }

      const rows = (rowsData ?? []) as ClientErrorReportRow[];
      const total = count ?? rows.length;
      const userIds = Array.from(
        new Set(rows.map((row) => row.user_id).filter((id): id is string => typeof id === "string")),
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
            message: "Unable to load profiles for client error reports",
            details: profilesError,
          });
        }

        profilesById = new Map(
          ((profiles ?? []) as ProfileLookupRow[]).map((profile) => [profile.id, profile]),
        );
      }

      const enriched = rows.map((row) => ({
        ...row,
        user_email: row.user_id ? (profilesById.get(row.user_id)?.email ?? null) : null,
      }));

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { rows: enriched, total },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/client-errors", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const rawAll = typeof req.query.all === "string" ? req.query.all.toLowerCase() : "";
      const deleteAll = rawAll === "true" || rawAll === "1";

      const { data, error } = await supabaseAdmin.rpc("scoremax_purge_client_error_reports", {
        p_delete_all: deleteAll,
      });

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to purge client error reports",
          details: error,
        });
      }

      const deleted =
        typeof data === "number"
          ? data
          : typeof data === "string"
            ? Number(data)
            : Number(data ?? 0);

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: {
          deleted_count: Number.isFinite(deleted) ? deleted : 0,
          delete_all: deleteAll,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

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

      const { data: jobsData, error: jobsError, count } = await jobsQuery;
      if (jobsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load analysis failures",
          details: jobsError,
        });
      }

      const jobs = (jobsData ?? []) as AnalysisFailureRow[];
      const total = count ?? jobs.length;
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
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      if (query.status !== "all") {
        jobsQuery = jobsQuery.eq("status", query.status);
      }

      if (query.search) {
        const search = query.search.replace(/,/g, " ").trim();
        jobsQuery = jobsQuery.or(
          [
            `id.ilike.%${search}%`,
            `user_id.ilike.%${search}%`,
            `session_id.ilike.%${search}%`,
            `error_code.ilike.%${search}%`,
            `error_message.ilike.%${search}%`,
            `trigger_source.ilike.%${search}%`,
            `status.ilike.%${search}%`,
          ].join(","),
        );
      }

      jobsQuery = jobsQuery.range(query.offset, query.offset + query.limit - 1);

      const { data: jobsData, error: jobsError, count } = await jobsQuery;
      if (jobsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load analysis jobs",
          details: jobsError,
        });
      }

      const jobs = (jobsData ?? []) as AnalysisFailureRow[];
      const total = count ?? jobs.length;
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

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { jobs: enriched, total },
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

      const eyeCanthalTiltDeg = jobRow.session_id
        ? await tryLoadLatestEyeCanthalTiltDeg({
            userId: jobRow.user_id,
            sessionId: jobRow.session_id,
            context: "admin_analysis_detail_response",
          })
        : null;
      const captureGuideMetrics = mergeEyeCanthalTiltIntoCaptureGuideMetrics(
        parseGuideTraceMetricsFromStoredRequestPayload(jobRow.request_payload),
        eyeCanthalTiltDeg,
      );
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
          results: applyLocalEyeCanthalTiltToResultRows(results, eyeCanthalTiltDeg),
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

  /** Dodo webhook deliveries that failed processing (and have not yet been recovered by a retry). */
  router.get("/admin/dodo/webhook-failures", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const query = adminWebhookFailuresQuerySchema.parse(req.query);

      let rowsQuery = supabaseAdmin
        .from("dodo_webhook_events")
        .select("webhook_id, event_type, error, received_at, processed_at, payload")
        .order("received_at", { ascending: false })
        .limit(query.limit);

      if (query.includeProcessed) {
        rowsQuery = rowsQuery.not("error", "is", null);
      } else {
        rowsQuery = rowsQuery.is("processed_at", null).not("error", "is", null);
      }

      const { data, error } = await rowsQuery;
      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load Dodo webhook failures",
          details: error,
        });
      }

      const rows = (data ?? []) as DodoWebhookFailureRow[];
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { failures: rows, total: rows.length },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Walk Dodo subscriptions and re-sync any drift in our DB (recover from webhook outages). */
  router.post("/admin/dodo/reconcile", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const outcome = await reconcileDodoSubscriptions();
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: outcome,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Targeted resync of a single Dodo subscription by id (e.g. after a
   * signature-rejected webhook delivery). Equivalent to replaying the
   * delivery without needing access to the Dodo dashboard.
   */
  router.post(
    "/admin/dodo/reconcile/:subscriptionId",
    async (req, res, next) => {
      try {
        await requireAdminUser(req.headers.authorization);
        const { subscriptionId } = z
          .object({ subscriptionId: z.string().min(1) })
          .parse(req.params);
        const outcome = await reconcileDodoSubscriptionById(subscriptionId);
        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: outcome,
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Long-tail safety net for the post-payment analysis: find every user with
   * an active subscription who has no analysis_job yet and kick one off.
   * Designed for an hourly cron — also safe to call manually after a Dodo
   * webhook outage or a deploy that introduced a regression in the kickoff
   * path.
   */
  router.post("/admin/dodo/kickoff-missing-analyses", async (req, res, next) => {
    try {
      await requireAdminUser(req.headers.authorization);
      const outcome = await kickoffMissingPaidAnalyses();
      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: outcome,
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

  router.get("/admin/ai-image-prompts", async (_req, res, next) => {
    try {
      await requireAdminUser(_req.headers.authorization);
      const { data, error } = await supabaseAdmin
        .from("scoremax_ai_image_prompts")
        .select(
          "key, description, prompt, model, model_variant, aspect_ratio, safety_filters, is_active, updated_by, created_at, updated_at",
        )
        .order("key", { ascending: true });

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load AI image prompts",
          details: error,
        });
      }

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { prompts: data ?? [] },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/ai-image-prompts/:key", async (req, res, next) => {
    try {
      const admin = await requireAdminUser(req.headers.authorization);
      const { key } = adminAiImagePromptKeyParamsSchema.parse(req.params);
      const body = adminAiImagePromptPatchSchema.parse(req.body ?? {});

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      };
      if (body.prompt !== undefined) patch.prompt = body.prompt;
      if (body.model_variant !== undefined) patch.model_variant = body.model_variant;
      if (body.aspect_ratio !== undefined) patch.aspect_ratio = body.aspect_ratio;
      if (body.safety_filters !== undefined) patch.safety_filters = body.safety_filters;
      if (body.is_active !== undefined) patch.is_active = body.is_active;

      const { data, error } = await supabaseAdmin
        .from("scoremax_ai_image_prompts")
        .update(patch)
        .eq("key", key)
        .select(
          "key, description, prompt, model, model_variant, aspect_ratio, safety_filters, is_active, updated_by, created_at, updated_at",
        )
        .maybeSingle();

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to update AI image prompt",
          details: error,
        });
      }

      if (!data) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 404,
          message: "Prompt key not found",
        });
      }

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { prompt: data },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
