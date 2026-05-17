import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import type { Plan, SubscriptionEventType, SubscriptionStatus } from "@shared/schema";
import { isPlan } from "@shared/schema";
import { ApiError } from "../errors";
import { supabaseAdmin } from "../supabase-admin";
import { logger } from "../logger";
import { maybeKickoffPaidAnalysisForUser } from "../post-payment-analysis";
import { DODO_METADATA_USER_ID_KEY } from "./checkout";
import { getDodoEnv } from "./env";

type DodoSubscriptionStatus = DodoSubscription["status"];

type WebhookSubscriptionEventType =
  | "subscription.active"
  | "subscription.renewed"
  | "subscription.updated"
  | "subscription.plan_changed"
  | "subscription.on_hold"
  | "subscription.cancelled"
  | "subscription.failed"
  | "subscription.expired";

/**
 * Whether the subscription should still grant premium access in our DB.
 *
 * Dodo emits `subscription.cancelled` as soon as the user clicks cancel, but
 * if they chose "cancel at next billing date" they keep access until the
 * period ends — Dodo will fire `subscription.expired` at that point. We mirror
 * that grace period by keeping `status='active'` until the expired event.
 */
function mapDodoStatusToDbStatus(
  dodoStatus: DodoSubscriptionStatus,
  cancelAtNextBillingDate: boolean,
): SubscriptionStatus {
  switch (dodoStatus) {
    case "active":
    case "on_hold": // payment retry — keep access during grace period
      return "active";
    case "cancelled":
      // If the user opted to keep access until period end, stay active in our DB
      // and wait for the `subscription.expired` event to flip to expired.
      return cancelAtNextBillingDate ? "active" : "canceled";
    case "failed":
      return "canceled";
    case "expired":
      return "expired";
    case "pending":
      // Subscription created but no successful payment yet; we have not granted
      // any access. Don't write a row at all in that case (handled in caller).
      return "canceled";
  }
}

function mapEventTypeToInternal(
  eventType: WebhookSubscriptionEventType,
  isFirstInsert: boolean,
): SubscriptionEventType {
  switch (eventType) {
    case "subscription.active":
      return isFirstInsert ? "granted" : "period_updated";
    case "subscription.renewed":
      return "renewed";
    case "subscription.updated":
    case "subscription.plan_changed":
    case "subscription.on_hold":
      return "period_updated";
    case "subscription.cancelled":
    case "subscription.failed":
      return "revoked";
    case "subscription.expired":
      return "expired";
  }
}

function extractScoreMaxUserId(subscription: DodoSubscription): string | null {
  const candidate = subscription.metadata?.[DODO_METADATA_USER_ID_KEY];
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  return null;
}

/**
 * Resolve the canonical `Plan` for a Dodo subscription.
 *
 * Priority order:
 *   1. `product_id` lookup against our configured Dodo products (single
 *      source of truth — survives upgrades/downgrades via the customer
 *      portal where our checkout `metadata.plan` is no longer accurate).
 *   2. `metadata.plan` set at checkout (legacy fallback for accounts created
 *      before the product map existed, and for safety during env rotation).
 */
function resolvePlanFromSubscription(
  subscription: DodoSubscription,
): Plan | null {
  try {
    const env = getDodoEnv();
    for (const [plan, productId] of Object.entries(env.productIds) as Array<
      [Plan, string]
    >) {
      if (productId === subscription.product_id) {
        return plan;
      }
    }
  } catch {
    // env not configured (tests, partial bootstraps) — fall back to metadata.
  }

  const metadataPlan = subscription.metadata?.plan;
  if (typeof metadataPlan === "string" && isPlan(metadataPlan)) {
    return metadataPlan;
  }
  return null;
}

async function resolveUserIdFromCustomerId(
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("dodo_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to resolve user from Dodo customer id",
      details: error,
    });
  }

  return (data?.user_id as string | undefined) ?? null;
}

async function persistDodoCustomerId(params: {
  userId: string;
  dodoCustomerId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ dodo_customer_id: params.dodoCustomerId })
    .eq("user_id", params.userId)
    .is("dodo_customer_id", null);

  if (error) {
    // Non-fatal: another concurrent webhook may have set the value already.
    logger.warn(
      { err: error, userId: params.userId },
      "dodo: failed to persist customer id (likely already set, continuing)",
    );
  }
}

type UpsertOutcome = {
  id: string;
  isFirstInsert: boolean;
  dbStatus: SubscriptionStatus;
};

type ApplyDodoActiveRpcRow = {
  subscription_row_id: string;
  is_first_insert: boolean;
  was_active_before: boolean;
};

/**
 * Atomic apply of a Dodo subscription row.
 *
 * Uses the dedicated RPC `scoremax_apply_dodo_active_subscription` which:
 *   - cancels any *other* active dodo row for the same user (prevents the
 *     partial unique index `scoremax_user_subscriptions_active_uidx` from
 *     blowing up when a user re-subscribes during a cancel-at-eob grace),
 *   - performs the atomic UPSERT on `(source, external_subscription_id)`,
 *   - returns whether the row was just created (drives the "first activation
 *     → kick off the analysis" decision).
 */
async function applySubscriptionRow(params: {
  userId: string;
  subscription: DodoSubscription;
  plan: Plan | null;
}): Promise<UpsertOutcome> {
  const { subscription, userId, plan } = params;

  const dbStatus = mapDodoStatusToDbStatus(
    subscription.status,
    subscription.cancel_at_next_billing_date,
  );

  const metadata = {
    dodo_customer_id: subscription.customer.customer_id,
    product_id: subscription.product_id,
    plan,
    dodo_status: subscription.status,
    cancel_at_next_billing_date: subscription.cancel_at_next_billing_date,
    currency: subscription.currency,
    recurring_pre_tax_amount: subscription.recurring_pre_tax_amount,
  } satisfies Record<string, unknown>;

  const { data, error } = await supabaseAdmin.rpc(
    "scoremax_apply_dodo_active_subscription",
    {
      p_user_id: userId,
      p_external_subscription_id: subscription.subscription_id,
      p_status: dbStatus,
      p_current_period_start: subscription.previous_billing_date,
      p_current_period_end: subscription.next_billing_date,
      p_metadata: metadata,
    },
  );

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to upsert Dodo subscription row",
      details: error,
    });
  }

  const rows = (data ?? []) as ApplyDodoActiveRpcRow[];
  const row = rows[0];
  if (!row) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Dodo subscription RPC returned no row",
    });
  }

  return {
    id: row.subscription_row_id,
    isFirstInsert: row.is_first_insert,
    dbStatus,
  };
}

async function insertSubscriptionEvent(params: {
  userId: string;
  subscriptionId: string;
  eventType: SubscriptionEventType;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("subscription_events").insert({
    user_id: params.userId,
    subscription_id: params.subscriptionId,
    event_type: params.eventType,
    source: "dodo",
    actor_user_id: null,
    reason: null,
    metadata: params.metadata,
  });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to log Dodo subscription event",
      details: error,
    });
  }
}

/**
 * Apply a Dodo subscription webhook event to our DB:
 *   - persist the customer id on `profiles` the first time we see it,
 *   - atomically upsert the matching row in `user_subscriptions`
 *     (cancelling any stale active row for the same user beforehand),
 *   - append an audit row in `subscription_events`,
 *   - on a fresh `subscription.active`, kick off the post-payment analysis.
 *
 * Idempotent: the (source='dodo', external_subscription_id) unique index in
 * Supabase guarantees a single row per Dodo subscription, and a repeat
 * delivery just overwrites the payload with the latest snapshot.
 *
 * Errors from the analysis kickoff are propagated so Dodo retries the
 * webhook delivery — that gives us a second chance to enqueue the job.
 * A separate periodic job (`/v1/admin/dodo/kickoff-missing-analyses`)
 * acts as a long-tail safety net.
 */
export async function applyDodoSubscriptionEvent(params: {
  eventType: WebhookSubscriptionEventType;
  subscription: DodoSubscription;
}): Promise<{ userId: string; subscriptionRowId: string } | null> {
  const { subscription, eventType } = params;
  const customerId = subscription.customer.customer_id;

  let userId = extractScoreMaxUserId(subscription);
  if (!userId) {
    userId = await resolveUserIdFromCustomerId(customerId);
  }

  if (!userId) {
    logger.warn(
      {
        eventType,
        subscriptionId: subscription.subscription_id,
        customerId,
      },
      "dodo: could not resolve ScoreMax user for subscription event; skipping",
    );
    return null;
  }

  await persistDodoCustomerId({ userId, dodoCustomerId: customerId });

  const plan = resolvePlanFromSubscription(subscription);

  const { id, isFirstInsert, dbStatus } = await applySubscriptionRow({
    userId,
    subscription,
    plan,
  });

  await insertSubscriptionEvent({
    userId,
    subscriptionId: id,
    eventType: mapEventTypeToInternal(eventType, isFirstInsert),
    metadata: {
      dodo_event_type: eventType,
      dodo_subscription_id: subscription.subscription_id,
      dodo_status: subscription.status,
      product_id: subscription.product_id,
      plan,
    },
  });

  if (eventType === "subscription.active" && dbStatus === "active") {
    // Awaited on purpose: if the kickoff fails (transient DB issue, R2 hiccup,
    // ScoreMax API timeout, …), we let the error bubble up. The webhook
    // handler marks the delivery as errored, returns 5xx, and Dodo retries
    // with exponential backoff. `maybeKickoffPaidAnalysisForUser` is itself
    // idempotent (it skips when an analysis job already exists), so the
    // retry will either succeed or no-op safely.
    await maybeKickoffPaidAnalysisForUser(userId);
  }

  return { userId, subscriptionRowId: id };
}

export type { WebhookSubscriptionEventType };
