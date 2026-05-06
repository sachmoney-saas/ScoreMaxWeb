import { Router } from "express";
import { optionalAnalysisLangBodySchema } from "@shared/oneshot";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "../lib/analysis-jobs";
import { ApiError } from "../lib/errors";
import { validateBody } from "../lib/validate";
import { assertSupportedAnalysisLang } from "../lib/supported-analysis-lang";
import {
  assertFreemiumQuotaAvailable,
  buildPayload,
  createAnalysisJob,
  loadActiveFreemiumJobForUser,
  loadRequiredAssets,
  refreshScanSessionProgress,
  type ScanSessionRow,
} from "../lib/analysis-orchestration";
import { requireUserId } from "../lib/auth";
import { supabaseAdmin } from "../lib/supabase-admin";

/**
 * Marque l'utilisateur comme "onboardé" dès qu'un job d'analyse a été créé /
 * réutilisé depuis la séance d'onboarding. On ne peut PAS attendre la
 * complétion du worker ScanFace : si l'API tombe, si le process est tué, ou
 * si l'utilisateur recharge la page pendant le run, on enverrait sinon
 * l'utilisateur revoir l'intro (perte d'état React local + flag profil
 * encore false). L'acte « j'ai capturé mes photos + j'ai cliqué lancer »
 * est l'événement qui clôt l'onboarding, indépendamment du résultat.
 *
 * Idempotent : un UPDATE sur un profil déjà flaggé ne change rien.
 */
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

        // Freemium quota: each account is entitled to a single non-failed
        // freemium analysis. If one already exists (any session), reuse it
        // instead of creating a duplicate. This also covers the case of users
        // who started a fresh onboarding session after abandoning a previous
        // one whose analysis already ran.
        const existingFreemium = await loadActiveFreemiumJobForUser(userId);
        if (existingFreemium) {
          if (existingFreemium.status === "queued") {
            dispatchAnalysisJob(existingFreemium.id);
          }

          // Un job freemium existe déjà → l'utilisateur a forcément déjà
          // franchi la capture. On garantit que le flag profil reflète
          // cet état même si un précédent run a échoué et n'a jamais flippé
          // le flag (ancien comportement de markSessionCompleted).
          await markOnboardingCompleted(userId);

          res.status(200).json({
            ok: true,
            httpStatus: 200,
            data: {
              job: {
                id: existingFreemium.id,
                status: existingFreemium.status,
              },
            },
            error: null,
          });
          return;
        }

        const session = await loadReadyOnboardingSession(userId);
        // Defence in depth: the DB partial unique index also enforces this,
        // but checking up-front yields a clean 409 instead of a 23505 surprise.
        await assertFreemiumQuotaAvailable(userId);

        const assets = await loadRequiredAssets({ userId, sessionId: session.id });
        const payload = await buildPayload({
          userId,
          sessionId: session.id,
          assets,
          source: "onboarding",
          tier: "freemium",
          ...(lang !== undefined ? { lang } : {}),
        });
        const jobId = await createAnalysisJob({
          userId,
          sessionId: session.id,
          payload,
          triggerSource: "onboarding_auto",
          tier: "freemium",
        });
        await persistAnalysisJobAssets({
          jobId,
          userId,
          sessionId: session.id,
          payload,
        });

        // Onboarding terminé du point de vue produit dès que le job est
        // persisté. Le succès / échec du worker ScanFace ne doit JAMAIS
        // renvoyer l'utilisateur sur la page d'intro.
        await markOnboardingCompleted(userId);

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
