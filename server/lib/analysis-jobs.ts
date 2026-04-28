import { analysesRequestSchema, type AnalysesRequest, type AnalysesResponse } from "@shared/oneshot";
import { mapUnknownError } from "./errors";
import { logger } from "./logger";
import { runScoreMaxAnalyses } from "./scoremax-client";
import { supabaseAdmin } from "./supabase-admin";

const activeJobIds = new Set<string>();

type PersistedAnalysisJob = {
  id: string;
  user_id: string;
  session_id: string;
  trigger_source: "onboarding_auto" | "user_rerun" | "admin" | string;
  request_payload: unknown;
};

export function dispatchAnalysisJob(jobId: string): void {
  if (activeJobIds.has(jobId)) {
    return;
  }

  activeJobIds.add(jobId);
  void processPersistedAnalysisJob(jobId)
    .catch((error) => {
      logger.error({ err: error, jobId }, "Unhandled analysis job processing error");
    })
    .finally(() => {
      activeJobIds.delete(jobId);
    });
}

async function claimQueuedJob(jobId: string): Promise<PersistedAnalysisJob | null> {
  const { data, error } = await supabaseAdmin
    .from("analysis_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, user_id, session_id, trigger_source, request_payload")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PersistedAnalysisJob | null) ?? null;
}

export async function persistAnalysisJobAssets(params: {
  jobId: string;
  userId: string;
  sessionId: string;
  payload: AnalysesRequest;
}): Promise<void> {
  const referencedAssetCodes = Array.from(
    new Set(params.payload.analyses.map((analysis) => analysis.imageId)),
  );

  if (referencedAssetCodes.length === 0) {
    return;
  }

  const { data: scanAssets, error } = await supabaseAdmin
    .from("scan_assets")
    .select("id, asset_type_code")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .in("asset_type_code", referencedAssetCodes);

  if (error) {
    throw error;
  }

  if (!scanAssets || scanAssets.length === 0) {
    return;
  }

  const jobAssetRows = scanAssets.map((asset) => ({
    analysis_job_id: params.jobId,
    asset_type_code: asset.asset_type_code,
    scan_asset_id: asset.id,
    user_id: params.userId,
  }));

  const { error: upsertError } = await supabaseAdmin.from("analysis_job_assets").upsert(jobAssetRows, {
    onConflict: "analysis_job_id,asset_type_code",
  });

  if (upsertError) {
    throw upsertError;
  }
}

async function persistAnalysisResults(params: {
  jobId: string;
  userId: string;
  analysis: AnalysesResponse;
}): Promise<void> {
  if (params.analysis.resultsByWorker.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.from("analysis_results").insert(
    params.analysis.resultsByWorker.map((workerResult) => ({
      analysis_job_id: params.jobId,
      user_id: params.userId,
      worker: workerResult.worker,
      prompt_version: workerResult.promptVersion,
      provider: "scoremax",
      result: workerResult as unknown as Record<string, unknown>,
    })),
  );

  if (error) {
    throw error;
  }
}

async function markSessionCompleted(job: PersistedAnalysisJob): Promise<void> {
  await supabaseAdmin
    .from("scan_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", job.session_id)
    .eq("user_id", job.user_id);

  if (job.trigger_source === "onboarding_auto") {
    await supabaseAdmin
      .from("profiles")
      .update({ has_completed_onboarding: true })
      .eq("id", job.user_id);
  }
}

async function markSessionFailed(job: PersistedAnalysisJob): Promise<void> {
  await supabaseAdmin
    .from("scan_sessions")
    .update({ status: "failed" })
    .eq("id", job.session_id)
    .eq("user_id", job.user_id);
}

export async function processPersistedAnalysisJob(jobId: string): Promise<void> {
  const job = await claimQueuedJob(jobId);

  if (!job) {
    return;
  }

  try {
    const payload = analysesRequestSchema.parse(job.request_payload);
    await persistAnalysisJobAssets({
      jobId: job.id,
      userId: job.user_id,
      sessionId: job.session_id,
      payload,
    });

    const analysis = await runScoreMaxAnalyses(payload);
    await persistAnalysisResults({ jobId: job.id, userId: job.user_id, analysis });
    await markSessionCompleted(job);

    await supabaseAdmin
      .from("analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        failed_at: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", job.id);
  } catch (error) {
    const mapped = mapUnknownError(error);
    logger.error({ err: error, jobId: job.id }, "Analysis job failed");
    await markSessionFailed(job);
    await supabaseAdmin
      .from("analysis_jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_code: mapped.code,
        error_message: mapped.message,
      })
      .eq("id", job.id);
  }
}

export async function recoverAnalysisJobsOnStartup(): Promise<void> {
  const { data: runningJobs, error: runningError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id")
    .eq("status", "running");

  if (runningError) {
    logger.error({ err: runningError }, "Unable to load running analysis jobs for recovery");
    return;
  }

  for (const job of runningJobs ?? []) {
    await supabaseAdmin.from("analysis_results").delete().eq("analysis_job_id", job.id);
    await supabaseAdmin
      .from("analysis_jobs")
      .update({
        status: "queued",
        started_at: null,
        completed_at: null,
        failed_at: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "running");
  }

  const { data: queuedJobs, error: queuedError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (queuedError) {
    logger.error({ err: queuedError }, "Unable to load queued analysis jobs for recovery");
    return;
  }

  logger.info(
    {
      resetRunningJobs: runningJobs?.length ?? 0,
      queuedJobs: queuedJobs?.length ?? 0,
    },
    "Recovering analysis jobs",
  );

  for (const job of queuedJobs ?? []) {
    dispatchAnalysisJob(job.id as string);
  }
}
