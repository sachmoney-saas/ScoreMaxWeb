import { logger } from "../logger";
import { getDodoClient } from "./client";

/**
 * Best-effort cancel of every Dodo subscription attached to a customer.
 *
 * Used as part of the account-deletion cascade so we never keep billing a
 * customer whose ScoreMax account no longer exists. We swallow individual
 * failures (and log them) so a single cancel error doesn't block the rest
 * of the deletion — the periodic reconciliation job will catch leftovers.
 */
export async function cancelAllDodoSubscriptionsForCustomer(params: {
  dodoCustomerId: string;
}): Promise<{
  attempted: number;
  cancelled: string[];
  alreadyInactive: string[];
  failed: Array<{ subscriptionId: string; reason: string }>;
}> {
  const client = getDodoClient();

  const cancelled: string[] = [];
  const alreadyInactive: string[] = [];
  const failed: Array<{ subscriptionId: string; reason: string }> = [];

  let attempted = 0;

  try {
    for await (const subscription of client.subscriptions.list({
      customer_id: params.dodoCustomerId,
    })) {
      attempted += 1;

      const isStillBillable =
        subscription.status === "active" ||
        subscription.status === "on_hold" ||
        subscription.status === "pending";

      if (!isStillBillable) {
        alreadyInactive.push(subscription.subscription_id);
        continue;
      }

      try {
        await client.subscriptions.update(subscription.subscription_id, {
          status: "cancelled",
        });
        cancelled.push(subscription.subscription_id);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "unknown cancel error";
        failed.push({
          subscriptionId: subscription.subscription_id,
          reason,
        });
        logger.warn(
          {
            err: error,
            subscriptionId: subscription.subscription_id,
            customerId: params.dodoCustomerId,
          },
          "dodo: failed to cancel subscription during account deletion",
        );
      }
    }
  } catch (error) {
    // The list call itself failed — surface it to the caller so the
    // deletion flow can decide whether to abort or continue.
    logger.error(
      { err: error, customerId: params.dodoCustomerId },
      "dodo: failed to list subscriptions during account deletion",
    );
    failed.push({
      subscriptionId: "*list*",
      reason:
        error instanceof Error ? error.message : "unknown subscriptions.list error",
    });
  }

  return { attempted, cancelled, alreadyInactive, failed };
}
