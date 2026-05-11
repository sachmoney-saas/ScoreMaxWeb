import { requireAdminUser, requireUserId } from "./auth";
import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";

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
 * La requête cite `claimedOwnerUserId` comme propriétaire du job :
 * soit c'est bien le JWT, soit c'est admin et la citation correspond au job.
 */
export async function assertCallerCanAccessJobForClaimedOwner(
  authorizationHeader: string | undefined,
  jobId: string,
  claimedOwnerUserId: string,
): Promise<void> {
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

  const ownerId = job.user_id as string;
  if (claimedOwnerUserId !== ownerId) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "userId does not match this analysis owner",
    });
  }

  await assertCallerIsSubjectUserOrAdmin(authorizationHeader, ownerId);
}
