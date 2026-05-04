import { deleteAllScanAssetStorageForUser } from "./analysis-cleanup";
import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";

export type DeleteUserAccountOptions = {
  /** Si false (défaut), refuse si le profil a un abonnement actif. Les admins peuvent passer true. */
  allowActiveSubscriber?: boolean;
};

/**
 * Suppression complète : fichiers R2 des scan_assets, puis auth.users (CASCADE vers profiles, sessions, jobs, etc.).
 */
export async function deleteUserAccountCompletely(
  userId: string,
  options: DeleteUserAccountOptions = {},
): Promise<{ storage: Awaited<ReturnType<typeof deleteAllScanAssetStorageForUser>> }> {
  if (!options.allowActiveSubscriber) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_subscriber")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to verify subscription before account deletion",
        details: profileError,
      });
    }

    if (profile?.is_subscriber) {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        status: 409,
        message:
          "You must cancel your active subscription before deleting your account.",
      });
    }
  }

  const storage = await deleteAllScanAssetStorageForUser(userId);

  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: deleteAuthError.message || "Unable to delete auth user",
      details: deleteAuthError,
    });
  }

  return { storage };
}
