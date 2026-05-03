import { Router } from "express";
import { optionalAnalysisLangBodySchema } from "@shared/oneshot";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "../lib/analysis-jobs";
import { ApiError } from "../lib/errors";
import { validateBody } from "../lib/validate";
import { assertSupportedAnalysisLang } from "../lib/supported-analysis-lang";
import {
  buildPayload,
  createAnalysisJob,
  loadRequiredAssets,
  refreshScanSessionProgress,
  type ScanSessionRow,
} from "../lib/analysis-orchestration";
import { requireUserId } from "../lib/auth";
import { supabaseAdmin } from "../lib/supabase-admin";

type ExistingOnboardingJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
};

async function loadReadyOnboardingSession(userId: string): Promise<ScanSessionRow> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, user_id, source, status, required_asset_count, completed_asset_count")
    .eq("user_id", userId)
    .eq("source", "onboarding")
    .in("status", ["collecting", "ready", "processing", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load onboarding scan session",
      details: error,
    });
  }

  let session = data as ScanSessionRow | null;
  if (!session) {
    // Fallback: some users may only have a manual_rescan session while finishing onboarding.
    const { data: fallbackSession, error: fallbackError } = await supabaseAdmin
      .from("scan_sessions")
      .select("id, user_id, source, status, required_asset_count, completed_asset_count")
      .eq("user_id", userId)
      .in("source", ["onboarding", "manual_rescan"])
      .in("status", ["collecting", "ready", "processing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to load fallback scan session",
        details: fallbackError,
      });
    }
    session = (fallbackSession as ScanSessionRow | null) ?? null;
  }

  if (!session) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "No active onboarding scan session found",
    });
  }

  await refreshScanSessionProgress(session.id);

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

async function loadLatestReusableOnboardingJob(params: {
  userId: string;
  sessionId: string;
}): Promise<ExistingOnboardingJob | null> {
  const { data, error } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id, status")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("trigger_source", "onboarding_auto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load existing onboarding analysis job",
      details: error,
    });
  }

  if (!data) {
    return null;
  }

  const job = data as ExistingOnboardingJob;
  if (job.status === "failed") {
    return null;
  }

  return job;
}


export function createV1OnboardingRouter(): Router {
  const router = Router();

  router.post(
    "/onboarding/complete",
    validateBody(optionalAnalysisLangBodySchema),
    async (req, res, next) => {
      try {
        const { lang } = req.body as { lang?: string };
        assertSupportedAnalysisLang(lang);

        const userId = await requireUserId(req.headers.authorization);
        const session = await loadReadyOnboardingSession(userId);
        const existingJob = await loadLatestReusableOnboardingJob({
          userId,
          sessionId: session.id,
        });

        if (existingJob) {
          if (existingJob.status === "queued") {
            dispatchAnalysisJob(existingJob.id);
          }

          res.status(200).json({
            ok: true,
            httpStatus: 200,
            data: {
              job: {
                id: existingJob.id,
                status: existingJob.status,
              },
            },
            error: null,
          });
          return;
        }

        const assets = await loadRequiredAssets({ userId, sessionId: session.id });
        const payload = await buildPayload({
          userId,
          sessionId: session.id,
          assets,
          source: "onboarding",
          ...(lang !== undefined ? { lang } : {}),
        });
        const jobId = await createAnalysisJob({
          userId,
          sessionId: session.id,
          payload,
          triggerSource: "onboarding_auto",
        });
        await persistAnalysisJobAssets({
          jobId,
          userId,
          sessionId: session.id,
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
