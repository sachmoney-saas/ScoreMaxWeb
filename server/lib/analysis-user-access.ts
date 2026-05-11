import { requireAdminUser, requireUserId } from "./auth";
import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";

export async function loadAnalysisJobOwner(jobId: string): Promise<string> {
  const { data: job, error } = await supabaseAdmin
    .from("analysis_jobs")
    .select("user_id")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Analysis not found",
      details: error,
    });
  }

  return job.user_id as string;
}

/** L'utilisateur authentifié consulte lui-même ce `subjectUserId`, ou est admin. */
export async function assertCallerIsSubjectUserOrAdmin(
  authorizationHeader: string | undefined,
  subjectUserId: string,
): Promise<void> {
  const callerId = await requireUserId(authorizationHeader);
  if (callerId === subjectUserId) {
    return;
  }
  await requireAdminUser(authorizationHeader);
}

/**
 * La requête doit viser le vrai propriétaire du job.
 * On ne fait pas confiance à `userId` côté client pour l'autorité.
 */
export async function assertCallerCanAccessAnalysisJob(
  authorizationHeader: string | undefined,
  jobId: string,
  claimedOwnerUserId: string,
): Promise<string> {
  const ownerId = await loadAnalysisJobOwner(jobId);

  if (claimedOwnerUserId !== ownerId) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "userId does not match this analysis owner",
    });
  }

  await assertCallerIsSubjectUserOrAdmin(authorizationHeader, ownerId);
  return ownerId;
}
