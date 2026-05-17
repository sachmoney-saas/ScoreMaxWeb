import { ApiError } from "./errors";
import { logger } from "./logger";
import { maybeKickoffPaidAnalysisForUser } from "./post-payment-analysis";
import { supabaseAdmin } from "./supabase-admin";

export type KickoffMissingOutcome = {
  scanned: number;
  queued: Array<{ user_id: string; job_id: string }>;
  already_exists: Array<{ user_id: string; job_id: string }>;
  skipped: Array<{ user_id: string; reason: "no_session" }>;
  errors: Array<{ user_id: string; error: string }>;
};

const PAGE_SIZE = 200;

/**
 * Find every subscriber that should have a `standard` analysis job but
 * doesn't, and kick one off. Idempotent: leans on
 * `maybeKickoffPaidAnalysisForUser`'s "already exists" check.
 *
 * Designed to be safe to call repeatedly (cron every hour, manual button on
 * admin dashboard, …). Stops paginating after `PAGE_SIZE` candidates so a
 * single invocation can't run unbounded — call again to drain the queue.
 */
export async function kickoffMissingPaidAnalyses(): Promise<KickoffMissingOutcome> {
  const outcome: KickoffMissingOutcome = {
    scanned: 0,
    queued: [],
    already_exists: [],
    skipped: [],
    errors: [],
  };

  // Step 1 — short-list subscribers without any analysis job at all.
  // We deliberately filter on `is_subscriber=true` so we hit the same source
  // of truth as the rest of the app (and naturally skip admins-only access).
  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("is_subscriber", true)
    .order("user_id", { ascending: true })
    .limit(PAGE_SIZE);

  if (candidatesError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load subscriber list for analysis rescue",
      details: candidatesError,
    });
  }

  const userIds = (candidates ?? [])
    .map((row) => row.user_id as string | null)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (userIds.length === 0) {
    return outcome;
  }

  // Step 2 — fetch existing job ownership in one round-trip so we don't
  // hammer the DB with N small SELECTs.
  const { data: existingJobs, error: jobsError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("user_id, id, status")
    .in("user_id", userIds)
    .in("status", ["queued", "running", "completed"]);

  if (jobsError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load existing analysis jobs",
      details: jobsError,
    });
  }

  const ownersWithJobs = new Set<string>();
  for (const job of existingJobs ?? []) {
    if (typeof job.user_id === "string") {
      ownersWithJobs.add(job.user_id);
    }
  }

  const missing = userIds.filter((id) => !ownersWithJobs.has(id));
  outcome.scanned = missing.length;

  // Step 3 — actually kick off, sequentially. The endpoint is bounded by
  // `PAGE_SIZE`, so this is fine; sequential keeps us under the ScoreMax
  // API rate-limit and gives us deterministic logs.
  for (const userId of missing) {
    try {
      const result = await maybeKickoffPaidAnalysisForUser(userId);
      switch (result.status) {
        case "queued":
          outcome.queued.push({ user_id: userId, job_id: result.jobId });
          break;
        case "already_exists":
          outcome.already_exists.push({ user_id: userId, job_id: result.jobId });
          break;
        case "skipped_no_session":
          outcome.skipped.push({ user_id: userId, reason: "no_session" });
          break;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown kickoff error";
      outcome.errors.push({ user_id: userId, error: message });
      logger.error(
        { err: error, userId },
        "kickoff-missing-analyses: failed for user, continuing",
      );
    }
  }

  logger.info(
    {
      scanned: outcome.scanned,
      queued: outcome.queued.length,
      alreadyExists: outcome.already_exists.length,
      skipped: outcome.skipped.length,
      errors: outcome.errors.length,
    },
    "kickoff-missing-analyses: pass complete",
  );

  return outcome;
}
