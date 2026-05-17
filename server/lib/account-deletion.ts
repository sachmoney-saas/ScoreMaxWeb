import { deleteAllScanAssetStorageForUser } from "./analysis-cleanup";
import { cancelAllDodoSubscriptionsForCustomer } from "./dodo/cancel";
import { ApiError } from "./errors";
import { logger } from "./logger";
import { isAccountDeletionBlockedBySubscription } from "./subscriptions";
import { supabaseAdmin } from "./supabase-admin";

export type DeleteUserAccountOptions = {
  /** Si false (défaut), refuse si abonnement actif sans annulation programmée. Les admins peuvent passer true. */
  allowActiveSubscriber?: boolean;
};

export type DeleteUserAccountResult = {
  storage: Awaited<ReturnType<typeof deleteAllScanAssetStorageForUser>>;
  dodo:
    | {
        customer_id: string;
        attempted: number;
        cancelled: string[];
        already_inactive: string[];
        failed: Array<{ subscription_id: string; reason: string }>;
      }
    | null;
};

type ProfileBillingSnapshot = {
  dodo_customer_id: string | null;
};

async function loadProfileBillingSnapshot(
  userId: string,
): Promise<ProfileBillingSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("dodo_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load billing snapshot before deletion",
      details: error,
    });
  }

  return (data as ProfileBillingSnapshot | null) ?? null;
}

/**
 * Suppression complète : annule les abos Dodo restants, supprime les fichiers
 * R2 des scan_assets puis l'`auth.users` (CASCADE vers profiles, sessions,
 * jobs, etc.).
 *
 * Ordre choisi à dessein :
 *   1. Cancel Dodo : on protège le revenu (et l'utilisateur). Même en mode
 *      `allowActiveSubscriber=true`, on ne veut pas continuer à facturer
 *      un compte qui n'existe plus.
 *   2. Storage R2 : irréversible mais sans effet de bord externe.
 *   3. auth.users : déclenche le CASCADE relationnel.
 */
export async function deleteUserAccountCompletely(
  userId: string,
  options: DeleteUserAccountOptions = {},
): Promise<DeleteUserAccountResult> {
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

  const billing = await loadProfileBillingSnapshot(userId);

  let dodoSummary: DeleteUserAccountResult["dodo"] = null;
  if (billing?.dodo_customer_id) {
    try {
      const result = await cancelAllDodoSubscriptionsForCustomer({
        dodoCustomerId: billing.dodo_customer_id,
      });
      dodoSummary = {
        customer_id: billing.dodo_customer_id,
        attempted: result.attempted,
        cancelled: result.cancelled,
        already_inactive: result.alreadyInactive,
        failed: result.failed.map((entry) => ({
          subscription_id: entry.subscriptionId,
          reason: entry.reason,
        })),
      };

      if (result.failed.length > 0) {
        logger.warn(
          {
            userId,
            dodoCustomerId: billing.dodo_customer_id,
            failed: result.failed,
          },
          "account-deletion: some Dodo subscriptions could not be cancelled (will be reconciled)",
        );
      }
    } catch (error) {
      // Defensive: don't block the deletion because Dodo is unreachable.
      // Reconciliation cron will catch any orphaned subscriptions.
      logger.error(
        { err: error, userId, dodoCustomerId: billing.dodo_customer_id },
        "account-deletion: Dodo cancellation step failed, continuing deletion",
      );
      dodoSummary = {
        customer_id: billing.dodo_customer_id,
        attempted: 0,
        cancelled: [],
        already_inactive: [],
        failed: [
          {
            subscription_id: "*list*",
            reason:
              error instanceof Error ? error.message : "dodo cancel pipeline failed",
          },
        ],
      };
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

  return { storage, dodo: dodoSummary };
}
