import {
  buildPayload,
  createAnalysisJob,
  loadRequiredAssets,
} from "./analysis-orchestration";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "./analysis-jobs";
import { ApiError } from "./errors";
import { logger } from "./logger";
import { supabaseAdmin } from "./supabase-admin";

export type PostPaymentKickoffOutcome =
  | { status: "queued"; jobId: string }
  | { status: "already_exists"; jobId: string }
  | { status: "skipped_no_session" };

/**
 * After the first successful Dodo subscription activation, enqueue the user's
 * first real ScoreMax analysis using the onboarding scan assets already stored
 * in R2 (no freemium run during onboarding).
 *
 * Idempotent on `analysis_jobs` (skips when a `queued`/`running`/`completed`
 * job already exists for the user), so the caller can safely await + retry.
 *
 * **Throws** on transient or unexpected failures (DB issues, payload build
 * failures, dispatch errors). The webhook handler relies on this propagation
 * to surface a 5xx → Dodo retries the delivery → we get another chance to
 * kick off the analysis.
 */
export async function maybeKickoffPaidAnalysisForUser(
  userId: string,
): Promise<PostPaymentKickoffOutcome> {
  const { data: existingJob, error: existingError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["queued", "running", "completed"])
    .limit(1)
    .maybeSingle();

  if (existingError) {
    logger.error(
      { err: existingError, userId },
      "post-payment: unable to check existing analysis jobs",
    );
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to check existing analysis jobs",
      details: existingError,
    });
  }

  if (existingJob?.id) {
    logger.info(
      { userId, jobId: existingJob.id },
      "post-payment: analysis already exists, skip",
    );
    return { status: "already_exists", jobId: existingJob.id as string };
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("scan_sessions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("source", "onboarding")
    .in("status", ["ready", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    logger.error(
      { err: sessionError, userId },
      "post-payment: unable to load onboarding session",
    );
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load onboarding scan session",
      details: sessionError,
    });
  }

  if (!session?.id) {
    // Not retryable via Dodo webhook: the user simply has no onboarding
    // session yet (rare but possible if they paid before completing it).
    // We log and return a non-throwing outcome so the webhook ACKs 200.
    logger.warn(
      { userId },
      "post-payment: no ready onboarding scan session; cannot start analysis",
    );
    return { status: "skipped_no_session" };
  }

  const sessionId = session.id as string;

  const assets = await loadRequiredAssets({ userId, sessionId });
  const payload = await buildPayload({
    userId,
    sessionId,
    assets,
    source: "onboarding",
    tier: "standard",
  });

  const jobId = await createAnalysisJob({
    userId,
    sessionId,
    payload,
    triggerSource: "user_rerun",
    tier: "standard",
  });

  await persistAnalysisJobAssets({
    jobId,
    userId,
    sessionId,
    payload,
  });

  dispatchAnalysisJob(jobId);

  logger.info(
    { userId, jobId, sessionId },
    "post-payment: standard analysis job created and dispatched",
  );

  return { status: "queued", jobId };
}
