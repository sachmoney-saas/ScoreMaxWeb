import { Router } from "express";
import { optionalAnalysisLangBodySchema } from "@shared/oneshot";
import { ApiError } from "../lib/errors";
import { validateBody } from "../lib/validate";
import { assertSupportedAnalysisLang } from "../lib/supported-analysis-lang";
import { refreshScanSessionProgress, type ScanSessionRow } from "../lib/analysis-orchestration";
import {
  getLatestPotentialImageForUser,
  triggerOnboardingPotentialImage,
} from "../lib/onboarding-potential-image";
import { requireUserId } from "../lib/auth";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";

async function markOnboardingCompleted(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ has_completed_onboarding: true })
    .eq("id", userId);

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to mark onboarding as completed",
      details: error,
    });
  }
}

async function markScanSessionReady(sessionId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("scan_sessions")
    .update({
      status: "ready",
      ready_at: now,
      updated_at: now,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to mark scan session as ready",
      details: error,
    });
  }
}

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

async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("has_completed_onboarding")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.has_completed_onboarding === true;
}

async function ensurePotentialImageForCompletedOnboarding(userId: string) {
  if (!(await hasCompletedOnboarding(userId))) {
    return null;
  }

  try {
    const session = await loadReadyOnboardingSession(userId);
    await triggerOnboardingPotentialImage({
      userId,
      sessionId: session.id,
    });
    return getLatestPotentialImageForUser(userId);
  } catch (error) {
    logger.warn(
      { err: error, userId },
      "Unable to auto-start onboarding potential image",
    );
    return null;
  }
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

        await markScanSessionReady(session.id, userId);
        await markOnboardingCompleted(userId);

        const generationId = await triggerOnboardingPotentialImage({
          userId,
          sessionId: session.id,
        });

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: {
            generation: {
              id: generationId,
              status: "pending",
            },
          },
          error: null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/onboarding/potential-image", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const payload =
        (await getLatestPotentialImageForUser(userId)) ??
        (await ensurePotentialImageForCompletedOnboarding(userId));

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { potential_image: payload },
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
