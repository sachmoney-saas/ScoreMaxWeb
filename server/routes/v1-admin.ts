import { Router } from "express";
import { z } from "zod";
import { deleteAnalysisJobAndAssets } from "../lib/analysis-cleanup";
import { requireAdminUser } from "../lib/auth";
import { ApiError } from "../lib/errors";
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
