import { Router } from "express";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "../lib/analysis-jobs";
import { ApiError } from "../lib/errors";
import {
  buildPayload,
  createAnalysisJob,
  loadRequiredAssets,
  refreshScanSessionProgress,
  type ScanSessionRow,
} from "../lib/analysis-orchestration";
import { requireUserId } from "../lib/auth";
import { supabaseAdmin } from "../lib/supabase-admin";

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


export function createV1OnboardingRouter(): Router {
  const router = Router();

  router.post("/onboarding/complete", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const session = await loadReadyOnboardingSession(userId);
      const assets = await loadRequiredAssets({ userId, sessionId: session.id });
      const payload = await buildPayload({
        userId,
        sessionId: session.id,
        assets,
        source: "onboarding",
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
