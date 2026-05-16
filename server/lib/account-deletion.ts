import { deleteAllScanAssetStorageForUser } from "./analysis-cleanup";
import { ApiError } from "./errors";
import { isAccountDeletionBlockedBySubscription } from "./subscriptions";
import { supabaseAdmin } from "./supabase-admin";

export type DeleteUserAccountOptions = {
  /** Si false (défaut), refuse si abonnement actif sans annulation programmée. Les admins peuvent passer true. */
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
    const blocked = await isAccountDeletionBlockedBySubscription(userId);
    if (blocked) {
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
