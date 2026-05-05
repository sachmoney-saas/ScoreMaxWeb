import {
  analysesRequestSchema,
  type AnalysesRequest,
  type AnalysesResponse,
} from "@shared/oneshot";
import { mapUnknownError } from "./errors";
import { logger } from "./logger";
import { runScoreMaxAnalyses } from "./scoremax-client";
import { supabaseAdmin } from "./supabase-admin";

const activeJobIds = new Set<string>();

/**
 * Au-delà de cette durée, un job en `running` qui n'a aucun worker dans ce
 * process (`activeJobIds`) est considéré comme orphelin (process tué en plein
 * await sous `bun --watch`, crash, etc.) et marqué `failed` par le watchdog.
 *
 * Doit être > `SCOREMAX_API_TIMEOUT_MS` ; on prend une marge confortable.
 */
const STALLED_RUNNING_JOB_THRESHOLD_MS = 15 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 60 * 1000;

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
    .select("id, asset_type_code, created_at")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .in("asset_type_code", referencedAssetCodes)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!scanAssets || scanAssets.length === 0) {
    return;
  }

  /**
   * Guard against duplicate assets of the same type in a session.
   * Users can re-upload/retake poses, so `scan_assets` may contain multiple
   * rows for one `asset_type_code`. Keep only the latest one per type before
   * `upsert`, otherwise Postgres can raise:
   * "ON CONFLICT DO UPDATE command cannot affect row a second time" (21000).
   */
  const latestByType = new Map<string, (typeof scanAssets)[number]>();
  for (const asset of scanAssets) {
    if (!latestByType.has(asset.asset_type_code)) {
      latestByType.set(asset.asset_type_code, asset);
    }
  }

  const jobAssetRows = Array.from(latestByType.values()).map((asset) => ({
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

/**
 * Snapshot a ScoreMax worker row for JSONB storage without numeric coercion.
 * We never Math.round / parseInt aggregate scores here; JSON.parse preserves
 * finite floats as JSON numbers (same precision PostgreSQL jsonb stores).
 */
function snapshotWorkerResultForDb(
  workerResult: AnalysesResponse["resultsByWorker"][number],
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(workerResult)) as Record<string, unknown>;
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
      result: snapshotWorkerResultForDb(workerResult),
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

export async function recoverAnalysisJobsOnStartup(params?: { dispatchQueuedJobs?: boolean }): Promise<void> {
  const shouldDispatchQueuedJobs = params?.dispatchQueuedJobs ?? true;
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

  if (!shouldDispatchQueuedJobs) {
    return;
  }

  for (const job of queuedJobs ?? []) {
    dispatchAnalysisJob(job.id as string);
  }
}

/**
 * Watchdog périodique pour réconcilier l'état DB avec ce que ce process
 * traite réellement (`activeJobIds`). Couvre deux pannes silencieuses :
 *
 * 1. Job `running` en DB **non présent** dans `activeJobIds` et dont
 *    `started_at` est plus vieux que `STALLED_RUNNING_JOB_THRESHOLD_MS` →
 *    le worker a été tué (hot-reload `bun --watch`, crash) → `failed`.
 * 2. Job `queued` en DB **non présent** dans `activeJobIds` → personne ne
 *    l'a repris (ex. après redémarrage avec `dispatchQueuedJobs:false`,
 *    ou après réincarnation par le bloc 1) → on relance `dispatchAnalysisJob`.
 */
export async function reconcileAnalysisJobsTick(): Promise<void> {
  const stalledBefore = new Date(
    Date.now() - STALLED_RUNNING_JOB_THRESHOLD_MS,
  ).toISOString();

  try {
    const { data: stalledRunning, error: stalledError } = await supabaseAdmin
      .from("analysis_jobs")
      .select("id, started_at")
      .eq("status", "running")
      .lt("started_at", stalledBefore);

    if (stalledError) {
      logger.error({ err: stalledError }, "Watchdog: load stalled running failed");
    } else {
      for (const job of stalledRunning ?? []) {
        const jobId = job.id as string;
        if (activeJobIds.has(jobId)) {
          continue;
        }
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("analysis_jobs")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_code: "JOB_STALLED",
            error_message:
              "Worker disappeared while running this analysis (process restart or crash).",
          })
          .eq("id", jobId)
          .eq("status", "running")
          .select("id")
          .maybeSingle();

        if (updateError) {
          logger.error({ err: updateError, jobId }, "Watchdog: failed to mark stalled job");
          continue;
        }
        if (updated) {
          logger.warn({ jobId }, "Watchdog: marked stalled running job as failed");
        }
      }
    }

    const { data: queuedJobs, error: queuedError } = await supabaseAdmin
      .from("analysis_jobs")
      .select("id")
      .eq("status", "queued")
      .order("created_at", { ascending: true });

    if (queuedError) {
      logger.error({ err: queuedError }, "Watchdog: load queued failed");
      return;
    }

    for (const job of queuedJobs ?? []) {
      const jobId = job.id as string;
      if (activeJobIds.has(jobId)) {
        continue;
      }
      logger.info({ jobId }, "Watchdog: re-dispatching orphan queued job");
      dispatchAnalysisJob(jobId);
    }
  } catch (error) {
    logger.error({ err: error }, "Watchdog tick failed");
  }
}

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

export function startAnalysisJobsWatchdog(): void {
  if (watchdogTimer) {
    return;
  }
  watchdogTimer = setInterval(() => {
    void reconcileAnalysisJobsTick();
  }, WATCHDOG_INTERVAL_MS);
  if (typeof watchdogTimer.unref === "function") {
    watchdogTimer.unref();
  }
}

export function stopAnalysisJobsWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
