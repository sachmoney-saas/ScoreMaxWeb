import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import { logger } from "../logger";
import { supabaseAdmin } from "../supabase-admin";
import { getDodoClient } from "./client";
import { applyDodoSubscriptionEvent } from "./subscription-sync";

type DodoSubscriptionStatus = DodoSubscription["status"];

export type ReconciliationOutcome = {
  scanned: number;
  resynced: number;
  orphan_in_dodo: Array<{
    subscription_id: string;
    customer_id: string;
    status: string;
    reason: "no_scoremax_user" | "scoremax_user_missing";
  }>;
  errors: Array<{ subscription_id: string; error: string }>;
};

export type SingleSubscriptionReconciliationOutcome =
  | {
      status: "resynced";
      subscription_id: string;
      dodo_status: string;
    }
  | {
      status: "orphan";
      subscription_id: string;
      dodo_status: string;
      reason: "no_scoremax_user" | "scoremax_user_missing";
    };

/**
 * Walk every active-ish Dodo subscription and make sure our DB mirrors it.
 *
 * Designed for a periodic cron (every 1h is sane) and for one-off recovery
 * after a webhook outage. We never *create* a row from scratch when we
 * can't tie the subscription back to a ScoreMax user — we just report it
 * as an orphan so the team can act (refund, manual cleanup, etc.).
 *
 * The heavy lifting is reusing `applyDodoSubscriptionEvent`: same code path
 * as the live webhook, same idempotency guarantees.
 */
export async function reconcileDodoSubscriptions(): Promise<ReconciliationOutcome> {
  const client = getDodoClient();
  const outcome: ReconciliationOutcome = {
    scanned: 0,
    resynced: 0,
    orphan_in_dodo: [],
    errors: [],
  };

  for await (const listed of client.subscriptions.list({ page_size: 100 })) {
    outcome.scanned += 1;

    // Skip subscriptions whose last activity is older than 90 days to keep
    // the reconciliation cost bounded — webhooks already covered them.
    const recentlyTouchedAt = listed.next_billing_date
      ? new Date(listed.next_billing_date).getTime()
      : new Date(listed.created_at).getTime();
    const ageMs = Date.now() - recentlyTouchedAt;
    if (ageMs > 1000 * 60 * 60 * 24 * 90) {
      continue;
    }

    try {
      // The list endpoint returns a slim payload; we need the full
      // `Subscription` shape (with billing dates, status, metadata, etc.)
      // to feed it into the same code path the webhook uses.
      const subscription = await client.subscriptions.retrieve(
        listed.subscription_id,
      );
      const result = await reconcileSingleSubscription(subscription);
      if (result === "resynced") {
        outcome.resynced += 1;
      } else if (result.kind === "orphan") {
        outcome.orphan_in_dodo.push({
          subscription_id: subscription.subscription_id,
          customer_id: subscription.customer.customer_id,
          status: subscription.status,
          reason: result.reason,
        });
      }
    } catch (error) {
      outcome.errors.push({
        subscription_id: listed.subscription_id,
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(
        { err: error, subscriptionId: listed.subscription_id },
        "dodo-reconciliation: failed to resync subscription",
      );
    }
  }

  logger.info(
    {
      scanned: outcome.scanned,
      resynced: outcome.resynced,
      orphans: outcome.orphan_in_dodo.length,
      errors: outcome.errors.length,
    },
    "dodo-reconciliation: pass complete",
  );

  return outcome;
}

/**
 * Targeted resync: fetches a single Dodo subscription by id and applies
 * the same webhook code path. Designed for hotfix paths (e.g. a webhook
 * delivery was rejected for signature reasons and never landed in our DB):
 * an admin can replay it without scanning the whole account.
 */
export async function reconcileDodoSubscriptionById(
  subscriptionId: string,
): Promise<SingleSubscriptionReconciliationOutcome> {
  const client = getDodoClient();
  const subscription = await client.subscriptions.retrieve(subscriptionId);
  const result = await reconcileSingleSubscription(subscription);
  if (result === "resynced") {
    return {
      status: "resynced",
      subscription_id: subscription.subscription_id,
      dodo_status: subscription.status,
    };
  }
  return {
    status: "orphan",
    subscription_id: subscription.subscription_id,
    dodo_status: subscription.status,
    reason: result.reason,
  };
}

type ReconcileResult =
  | "resynced"
  | { kind: "orphan"; reason: "no_scoremax_user" | "scoremax_user_missing" };

async function reconcileSingleSubscription(
  subscription: DodoSubscription,
): Promise<ReconcileResult> {
  // Map Dodo status to a synthetic event_type the apply function knows how
  // to consume. We always pass a representative event — the row state ends
  // up identical regardless of which we pick (the apply step writes the
  // freshest snapshot).
  const eventType = pickSyntheticEventType(subscription.status);

  const applied = await applyDodoSubscriptionEvent({
    eventType,
    subscription,
  });

  if (!applied) {
    // applyDodoSubscriptionEvent returns null when it can't resolve a
    // ScoreMax user. Differentiate "never linked" vs "user was deleted"
    // by checking if a profile exists for the metadata-provided uid.
    const metadataUid =
      typeof subscription.metadata?.scoremax_user_id === "string"
        ? subscription.metadata.scoremax_user_id
        : null;
    if (metadataUid) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("user_id", metadataUid)
        .maybeSingle();
      return {
        kind: "orphan",
        reason: data ? "no_scoremax_user" : "scoremax_user_missing",
      };
    }
    return { kind: "orphan", reason: "no_scoremax_user" };
  }

  return "resynced";
}

function pickSyntheticEventType(status: DodoSubscriptionStatus):
  | "subscription.active"
  | "subscription.cancelled"
  | "subscription.expired"
  | "subscription.failed"
  | "subscription.on_hold" {
  switch (status) {
    case "active":
      return "subscription.active";
    case "cancelled":
      return "subscription.cancelled";
    case "expired":
      return "subscription.expired";
    case "failed":
      return "subscription.failed";
    case "on_hold":
      return "subscription.on_hold";
    case "pending":
      return "subscription.active"; // treated as no-op upstream
  }
}
