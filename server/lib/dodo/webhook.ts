import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks";
import { ApiError } from "../errors";
import { logger } from "../logger";
import { supabaseAdmin } from "../supabase-admin";
import { getDodoClient } from "./client";
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

type LedgerInsertResult =
  | { status: "fresh" }
  | { status: "duplicate" };

/**
 * Insert the webhook id into the idempotency ledger. If the row already
 * exists, the unique constraint fires and we treat the event as a duplicate
 * delivery (Dodo retries up to 8 times — see their docs).
 */
async function recordWebhookReceived(params: {
  webhookId: string;
  eventType: string;
  payload: unknown;
}): Promise<LedgerInsertResult> {
  const { error } = await supabaseAdmin
    .from("dodo_webhook_events")
    .insert({
      webhook_id: params.webhookId,
      event_type: params.eventType,
      payload: params.payload as Record<string, unknown>,
    });

  if (!error) {
    return { status: "fresh" };
  }

  // 23505 = unique_violation on Postgres -> we've already seen this webhook id.
  if (typeof (error as { code?: string }).code === "string" && (error as { code: string }).code === "23505") {
    return { status: "duplicate" };
  }

  throw new ApiError({
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "Unable to record Dodo webhook delivery",
    details: error,
  });
}

async function markWebhookProcessed(params: {
  webhookId: string;
  error?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dodo_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: params.error ?? null,
    })
    .eq("webhook_id", params.webhookId);

  if (error) {
    // Non-fatal: we'll just see the row stay "received" in the ledger.
    logger.warn(
      { err: error, webhookId: params.webhookId },
      "dodo: failed to mark webhook as processed",
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

  const ledger = await recordWebhookReceived({
    webhookId: params.headers.webhookId,
    eventType: event.type,
    payload: event as unknown,
  });

  if (ledger.status === "duplicate") {
    logger.info(
      { webhookId: params.headers.webhookId, eventType: event.type },
      "dodo: duplicate webhook delivery, skipping processing",
    );
    return { status: "duplicate" };
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

    logger.info(
      { eventType: event.type, webhookId: params.headers.webhookId },
      "dodo: event type not handled; acknowledging only",
    );
    await markWebhookProcessed({ webhookId: params.headers.webhookId });
    return { status: "ignored" };
  } catch (error) {
    await markWebhookProcessed({
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
