import { Router } from "express";
import { z } from "zod";
import { optionalAnalysisLangBodySchema } from "@shared/oneshot";
import { ApiError } from "../lib/errors";
import { validateBody } from "../lib/validate";
import { assertSupportedAnalysisLang } from "../lib/supported-analysis-lang";
import { refreshScanSessionProgress, type ScanSessionRow } from "../lib/analysis-orchestration";
import {
  getLatestPotentialImageForUser,
  getPotentialImageMediaAssetForUser,
  triggerOnboardingPotentialImage,
} from "../lib/onboarding-potential-image";
import { requireUserId } from "../lib/auth";
import { logger } from "../lib/logger";
import { serveR2ImageAssetWithAvifNegotiation } from "../lib/serve-r2-image-asset";
import { supabaseAdmin } from "../lib/supabase-admin";

const landmarkPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

const meshReplayFrameSchema = z.object({
  landmarks: z.array(landmarkPointSchema).min(1).max(600),
  landmarkFrameWidth: z.number().finite().positive(),
  landmarkFrameHeight: z.number().finite().positive(),
});

const meshReplayBodySchema = z.object({
  sessionId: z.string().uuid(),
  frontal: meshReplayFrameSchema,
  eye: meshReplayFrameSchema.nullable().optional(),
});

const onboardingPotentialMediaParamsSchema = z.object({
  kind: z.enum(["generated", "source", "mask"]),
});

const onboardingPotentialMediaQuerySchema = z.object({
  fmt: z.enum(["avif"]).optional(),
});

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

async function assertOnboardingSessionOwner(params: {
  userId: string;
  sessionId: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select("id")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .in("source", ["onboarding", "manual_rescan"])
    .maybeSingle();

  if (error || !data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Scan session not found",
      details: error,
    });
  }
}

async function ensurePotentialImageForCompletedOnboarding(
  userId: string,
  options: { includeSignedUrls?: boolean } = {},
) {
  if (!(await hasCompletedOnboarding(userId))) {
    return null;
  }

  const existing = await getLatestPotentialImageForUser(userId, options);
  if (existing) {
    return existing;
  }

  try {
    const session = await loadReadyOnboardingSession(userId);
    await triggerOnboardingPotentialImage({
      userId,
      sessionId: session.id,
    });
    return getLatestPotentialImageForUser(userId, options);
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

  /**
   * Lance OneShot / nano-banana pour l’aperçu potentiel **avant** POST /complete.
   * Réutilise une génération en cours ou terminée si elle existe (idempotent).
   */
  router.post("/onboarding/start-potential-generation", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const session = await loadReadyOnboardingSession(userId);
      const generation = await triggerOnboardingPotentialImage({
        userId,
        sessionId: session.id,
      }).catch((error) => {
        logger.warn(
          { err: error, userId, sessionId: session.id },
          "Unable to start optional onboarding potential image",
        );
        return null;
      });

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: {
          generation: generation
            ? {
                id: generation.generationId,
                reused: generation.reused,
              }
            : null,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

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

        const generation = await triggerOnboardingPotentialImage({
          userId,
          sessionId: session.id,
        }).catch((error) => {
          logger.warn(
            { err: error, userId, sessionId: session.id },
            "Unable to start optional onboarding potential image",
          );
          return null;
        });

        const latest = generation
          ? await getLatestPotentialImageForUser(userId, {
              includeSignedUrls: false,
            })
          : null;

        res.status(200).json({
          ok: true,
          httpStatus: 200,
          data: {
            generation: generation
              ? {
                  id: generation.generationId,
                  status: latest?.status ?? "pending",
                  reused: generation.reused,
                }
              : null,
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
      const includeSignedUrls = req.query.media_only !== "1";
      const payload =
        (await getLatestPotentialImageForUser(userId, { includeSignedUrls })) ??
        (await ensurePotentialImageForCompletedOnboarding(userId, {
          includeSignedUrls,
        }));

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

  router.get("/onboarding/potential-image/media/:kind", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const { kind } = onboardingPotentialMediaParamsSchema.parse(req.params);
      const { fmt } = onboardingPotentialMediaQuerySchema.parse(req.query);
      const asset = await getPotentialImageMediaAssetForUser({ userId, kind });

      if (!asset) {
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Onboarding potential image not found",
        });
      }

      try {
        await serveR2ImageAssetWithAvifNegotiation({
          res,
          asset,
          fmt,
          notFoundMessage: "Onboarding potential image not found",
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
          code: "IMAGE_NOT_FOUND",
          status: 404,
          message: "Onboarding potential image not found",
          details: error,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  router.get("/onboarding/mesh-replay", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const { data, error } = await supabaseAdmin
        .from("onboarding_mesh_replays")
        .select("session_id, snapshot, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to load onboarding mesh replay",
          details: error,
        });
      }

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { mesh_replay: data?.snapshot ?? null },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/onboarding/mesh-replay", async (req, res, next) => {
    try {
      const userId = await requireUserId(req.headers.authorization);
      const body = meshReplayBodySchema.parse(req.body);
      await assertOnboardingSessionOwner({ userId, sessionId: body.sessionId });

      const now = new Date().toISOString();
      const snapshot = {
        v: 1,
        userId,
        frontal: body.frontal,
        eye: body.eye ?? null,
      };

      const { error } = await supabaseAdmin
        .from("onboarding_mesh_replays")
        .upsert(
          {
            user_id: userId,
            session_id: body.sessionId,
            snapshot,
            updated_at: now,
          },
          { onConflict: "user_id,session_id" },
        );

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to save onboarding mesh replay",
          details: error,
        });
      }

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data: { mesh_replay: snapshot },
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
