import {
  buildPayload,
  createAnalysisJob,
  loadRequiredAssets,
} from "./analysis-orchestration";
import { dispatchAnalysisJob, persistAnalysisJobAssets } from "./analysis-jobs";
import { logger } from "./logger";
import { supabaseAdmin } from "./supabase-admin";

/**
 * After the first successful Dodo subscription activation, enqueue the user's
 * first real ScoreMax analysis using the onboarding scan assets already stored
 * in R2 (no freemium run during onboarding).
 */
export async function maybeKickoffPaidAnalysisForUser(userId: string): Promise<void> {
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
    return;
  }

  if (existingJob?.id) {
    logger.info({ userId, jobId: existingJob.id }, "post-payment: analysis already exists, skip");
    return;
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
    logger.error({ err: sessionError, userId }, "post-payment: unable to load onboarding session");
    return;
  }

  if (!session?.id) {
    logger.warn({ userId }, "post-payment: no ready onboarding scan session; cannot start analysis");
    return;
  }

  const sessionId = session.id as string;

  try {
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
    logger.info({ userId, jobId, sessionId }, "post-payment: standard analysis job created and dispatched");
  } catch (error) {
    logger.error({ err: error, userId, sessionId }, "post-payment: failed to create analysis job");
  }
}
