import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import type { Plan, SubscriptionEventType, SubscriptionStatus } from "@shared/schema";
import { isPlan } from "@shared/schema";
import { ApiError } from "../errors";
import { supabaseAdmin } from "../supabase-admin";
import { logger } from "../logger";
import { maybeKickoffPaidAnalysisForUser } from "../post-payment-analysis";
import { DODO_METADATA_USER_ID_KEY } from "./checkout";

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

type DbSubscriptionRow = {
  id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  metadata: Record<string, unknown>;
};

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

function extractPlan(subscription: DodoSubscription): Plan | null {
  const candidate = subscription.metadata?.plan;
  if (typeof candidate === "string" && isPlan(candidate)) {
    return candidate;
  }
  return null;
}

async function resolveUserIdFromCustomerId(
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
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

  return (data?.id as string | undefined) ?? null;
}

async function persistDodoCustomerId(params: {
  userId: string;
  dodoCustomerId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ dodo_customer_id: params.dodoCustomerId })
    .eq("id", params.userId)
    .is("dodo_customer_id", null);

  if (error) {
    // Non-fatal: another concurrent webhook may have set the value already.
    logger.warn(
      { err: error, userId: params.userId },
      "dodo: failed to persist customer id (likely already set, continuing)",
    );
  }
}

async function findExistingDodoSubscriptionRow(
  externalSubscriptionId: string,
): Promise<DbSubscriptionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id, status, current_period_end, metadata")
    .eq("source", "dodo")
    .eq("external_subscription_id", externalSubscriptionId)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load existing Dodo subscription row",
      details: error,
    });
  }

  return (data as DbSubscriptionRow | null) ?? null;
}

async function upsertSubscriptionRow(params: {
  userId: string;
  subscription: DodoSubscription;
  existing: DbSubscriptionRow | null;
  plan: Plan | null;
}): Promise<{ id: string; isFirstInsert: boolean; dbStatus: SubscriptionStatus }> {
  const { subscription, userId, existing, plan } = params;

  const dbStatus = mapDodoStatusToDbStatus(
    subscription.status,
    subscription.cancel_at_next_billing_date,
  );

  const payload = {
    user_id: userId,
    status: dbStatus,
    source: "dodo" as const,
    current_period_start: subscription.previous_billing_date,
    current_period_end: subscription.next_billing_date,
    external_subscription_id: subscription.subscription_id,
    metadata: {
      dodo_customer_id: subscription.customer.customer_id,
      product_id: subscription.product_id,
      plan,
      dodo_status: subscription.status,
      cancel_at_next_billing_date: subscription.cancel_at_next_billing_date,
      currency: subscription.currency,
      recurring_pre_tax_amount: subscription.recurring_pre_tax_amount,
    } satisfies Record<string, unknown>,
  };

  if (existing) {
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to update Dodo subscription row",
        details: error,
      });
    }

    return { id: existing.id, isFirstInsert: false, dbStatus };
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to insert Dodo subscription row",
      details: error,
    });
  }

  return { id: data.id as string, isFirstInsert: true, dbStatus };
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
 *   - upsert the matching row in `user_subscriptions` (active/canceled/expired),
 *   - append an audit row in `subscription_events`.
 *
 * Idempotent: the (source='dodo', external_subscription_id) unique index in
 * Supabase guarantees a single row per Dodo subscription, and a repeat delivery
 * just overwrites the payload with the latest payload — which Dodo guarantees
 * is the freshest snapshot of the subscription at the time of delivery.
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

  const existing = await findExistingDodoSubscriptionRow(
    subscription.subscription_id,
  );
  const plan = extractPlan(subscription);

  const { id, isFirstInsert, dbStatus } = await upsertSubscriptionRow({
    userId,
    subscription,
    existing,
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
    },
  });

  if (
    eventType === "subscription.active" &&
    isFirstInsert &&
    dbStatus === "active"
  ) {
    void maybeKickoffPaidAnalysisForUser(userId).catch((err) => {
      logger.error(
        { err, userId },
        "post-payment: failed to kick off analysis after first subscription activation",
      );
    });
  }

  return { userId, subscriptionRowId: id };
}

export type { WebhookSubscriptionEventType };
