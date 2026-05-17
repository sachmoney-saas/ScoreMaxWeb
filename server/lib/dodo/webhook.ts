import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks";
import { ApiError } from "../errors";
import { logger } from "../logger";
import { supabaseAdmin } from "../supabase-admin";
import { getDodoClient } from "./client";
import {
  applyDodoDisputeEvent,
  applyDodoPaymentEvent,
  applyDodoRefundEvent,
  type PaymentLifecycleEventType,
} from "./payment-events";
import {
  applyDodoSubscriptionEvent,
  type WebhookSubscriptionEventType,
} from "./subscription-sync";

const SUBSCRIPTION_EVENT_TYPES = new Set<WebhookSubscriptionEventType>([
  "subscription.active",
  "subscription.renewed",
  "subscription.updated",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.failed",
  "subscription.expired",
]);

const PAYMENT_EVENT_TYPES = new Set<PaymentLifecycleEventType>([
  "payment.failed",
  "payment.succeeded",
  "payment.cancelled",
]);

const REFUND_EVENT_TYPES = new Set<PaymentLifecycleEventType>([
  "refund.succeeded",
  "refund.failed",
]);

const DISPUTE_EVENT_TYPES = new Set<PaymentLifecycleEventType>([
  "dispute.opened",
  "dispute.lost",
  "dispute.won",
  "dispute.challenged",
  "dispute.expired",
  "dispute.accepted",
  "dispute.cancelled",
]);

export type DodoWebhookHeaders = {
  webhookId: string;
  webhookSignature: string;
  webhookTimestamp: string;
};

export class DodoWebhookSignatureError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

/**
 * Verify the Standard Webhooks signature using the official SDK helper.
 *
 * Throws `DodoWebhookSignatureError` if the signature does not match —
 * the route handler maps that to a 401 to make replay attempts visible
 * in dashboards without being retried by Dodo.
 */
export function verifyDodoWebhook(params: {
  rawBody: string;
  headers: DodoWebhookHeaders;
}): UnwrapWebhookEvent {
  const client = getDodoClient();

  try {
    return client.webhooks.unwrap(params.rawBody, {
      headers: {
        "webhook-id": params.headers.webhookId,
        "webhook-signature": params.headers.webhookSignature,
        "webhook-timestamp": params.headers.webhookTimestamp,
      },
    });
  } catch (error) {
    throw new DodoWebhookSignatureError(
      "Invalid Dodo webhook signature",
      error,
    );
  }
}

type LedgerReservation =
  | { status: "fresh" }
  | { status: "retry"; previousError: string | null }
  | { status: "already_processed" };

/**
 * Reserve the delivery in the idempotency ledger.
 *
 * Uses an UPSERT keyed on `webhook_id` so that:
 *  - a brand-new delivery inserts a row with `processed_at = NULL`,
 *  - a retry of a delivery we *failed* to process (processed_at still NULL)
 *    is re-attempted and gets a chance to succeed,
 *  - a retry of a delivery we *already* processed (processed_at set) is
 *    short-circuited and never re-runs the side effects.
 *
 * This is the correct shape for Standard Webhooks at-least-once delivery:
 * we never lose a fail (Dodo will retry → we will retry), and we never
 * double-apply a success.
 */
async function reserveWebhookDelivery(params: {
  webhookId: string;
  eventType: string;
  payload: unknown;
}): Promise<LedgerReservation> {
  // Step 1 — peek to know whether we have already processed this delivery.
  const { data: existing, error: peekError } = await supabaseAdmin
    .from("dodo_webhook_events")
    .select("processed_at, error")
    .eq("webhook_id", params.webhookId)
    .maybeSingle();

  if (peekError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to read Dodo webhook ledger",
      details: peekError,
    });
  }

  if (existing?.processed_at) {
    return { status: "already_processed" };
  }

  // Step 2 — upsert the row. Either we create it (fresh delivery) or we
  // overwrite it with the latest payload bytes (Dodo may include richer
  // data on a retry; we want the freshest snapshot for replay/debug).
  const { error: upsertError } = await supabaseAdmin
    .from("dodo_webhook_events")
    .upsert(
      {
        webhook_id: params.webhookId,
        event_type: params.eventType,
        payload: params.payload as Record<string, unknown>,
        // Explicitly null out the previous error so the row reflects the
        // current attempt and not a stale failure from a prior delivery.
        error: null,
      },
      { onConflict: "webhook_id", ignoreDuplicates: false },
    );

  if (upsertError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to record Dodo webhook delivery",
      details: upsertError,
    });
  }

  if (existing) {
    return { status: "retry", previousError: existing.error ?? null };
  }
  return { status: "fresh" };
}

async function markWebhookProcessed(params: {
  webhookId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dodo_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("webhook_id", params.webhookId);

  if (error) {
    // Non-fatal: we'll just see the row stay "received" in the ledger and
    // the next Dodo retry will re-process — which is safe because the
    // downstream apply step is itself idempotent.
    logger.warn(
      { err: error, webhookId: params.webhookId },
      "dodo: failed to mark webhook as processed",
    );
  }
}

async function markWebhookErrored(params: {
  webhookId: string;
  error: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dodo_webhook_events")
    .update({
      // Leave processed_at = NULL so the next Dodo retry triggers another
      // attempt. We only record *why* the previous attempt failed.
      error: params.error,
    })
    .eq("webhook_id", params.webhookId);

  if (error) {
    logger.warn(
      { err: error, webhookId: params.webhookId },
      "dodo: failed to record webhook error on ledger",
    );
  }
}

/**
 * High-level orchestrator: verify the webhook, persist it for idempotency
 * and dispatch to the matching sync routine.
 *
 * Returns once the DB has been updated. The route layer ACKs Dodo with a 2xx
 * only after we've reached a consistent state — this is safe because Dodo's
 * own retry policy is exponential and the work here completes well under
 * their 15s timeout for healthy DB connections.
 */
export async function handleDodoWebhook(params: {
  rawBody: string;
  headers: DodoWebhookHeaders;
}): Promise<{ status: "ok" | "duplicate" | "ignored" }> {
  const event = verifyDodoWebhook(params);

  const reservation = await reserveWebhookDelivery({
    webhookId: params.headers.webhookId,
    eventType: event.type,
    payload: event as unknown,
  });

  if (reservation.status === "already_processed") {
    logger.info(
      { webhookId: params.headers.webhookId, eventType: event.type },
      "dodo: duplicate webhook delivery (already processed), skipping",
    );
    return { status: "duplicate" };
  }

  if (reservation.status === "retry") {
    logger.warn(
      {
        webhookId: params.headers.webhookId,
        eventType: event.type,
        previousError: reservation.previousError,
      },
      "dodo: retrying previously failed webhook delivery",
    );
  }

  try {
    if (isSubscriptionEvent(event.type)) {
      const subscriptionEvent = event as Extract<
        UnwrapWebhookEvent,
        { type: WebhookSubscriptionEventType }
      >;
      await applyDodoSubscriptionEvent({
        eventType: subscriptionEvent.type,
        subscription: subscriptionEvent.data,
      });
      await markWebhookProcessed({ webhookId: params.headers.webhookId });
      return { status: "ok" };
    }

    if (isPaymentEvent(event.type)) {
      const paymentEvent = event as Extract<
        UnwrapWebhookEvent,
        { type: "payment.failed" | "payment.succeeded" | "payment.cancelled" }
      >;
      await applyDodoPaymentEvent({
        eventType: paymentEvent.type,
        payment: paymentEvent.data,
      });
      await markWebhookProcessed({ webhookId: params.headers.webhookId });
      return { status: "ok" };
    }

    if (isRefundEvent(event.type)) {
      const refundEvent = event as Extract<
        UnwrapWebhookEvent,
        { type: "refund.succeeded" | "refund.failed" }
      >;
      await applyDodoRefundEvent({
        eventType: refundEvent.type,
        refund: refundEvent.data,
      });
      await markWebhookProcessed({ webhookId: params.headers.webhookId });
      return { status: "ok" };
    }

    if (isDisputeEvent(event.type)) {
      const disputeEvent = event as Extract<
        UnwrapWebhookEvent,
        {
          type:
            | "dispute.opened"
            | "dispute.lost"
            | "dispute.won"
            | "dispute.challenged"
            | "dispute.expired"
            | "dispute.accepted"
            | "dispute.cancelled";
        }
      >;
      await applyDodoDisputeEvent({
        eventType: disputeEvent.type,
        dispute: disputeEvent.data,
      });
      await markWebhookProcessed({ webhookId: params.headers.webhookId });
      return { status: "ok" };
    }

    logger.info(
      { eventType: event.type, webhookId: params.headers.webhookId },
      "dodo: event type not handled; acknowledging only",
    );
    await markWebhookProcessed({ webhookId: params.headers.webhookId });
    return { status: "ignored" };
  } catch (error) {
    await markWebhookErrored({
      webhookId: params.headers.webhookId,
      error:
        error instanceof Error ? error.message : "unknown webhook handler error",
    });
    throw error;
  }
}

function isSubscriptionEvent(
  eventType: string,
): eventType is WebhookSubscriptionEventType {
  return SUBSCRIPTION_EVENT_TYPES.has(eventType as WebhookSubscriptionEventType);
}

function isPaymentEvent(
  eventType: string,
): eventType is "payment.failed" | "payment.succeeded" | "payment.cancelled" {
  return PAYMENT_EVENT_TYPES.has(eventType as PaymentLifecycleEventType);
}

function isRefundEvent(
  eventType: string,
): eventType is "refund.succeeded" | "refund.failed" {
  return REFUND_EVENT_TYPES.has(eventType as PaymentLifecycleEventType);
}

function isDisputeEvent(
  eventType: string,
): eventType is
  | "dispute.opened"
  | "dispute.lost"
  | "dispute.won"
  | "dispute.challenged"
  | "dispute.expired"
  | "dispute.accepted"
  | "dispute.cancelled" {
  return DISPUTE_EVENT_TYPES.has(eventType as PaymentLifecycleEventType);
}
