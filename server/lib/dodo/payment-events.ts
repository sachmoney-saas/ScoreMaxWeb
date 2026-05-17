import type { Payment } from "dodopayments/resources/payments";
import type { Refund } from "dodopayments/resources/refunds";
import type { Dispute } from "dodopayments/resources/disputes";
import { logger } from "../logger";
import { supabaseAdmin } from "../supabase-admin";
import { getDodoClient } from "./client";

/**
 * Webhook events that don't change subscription state but matter for audit /
 * support / accounting: card declines, refunds, chargebacks.
 *
 * For each one we:
 *   1. structured-log (so dashboards can alert),
 *   2. resolve the ScoreMax user when possible (via `dodo_customer_id`),
 *   3. write an `admin_note` row in `subscription_events` so the trail is
 *      visible from the admin UI alongside the subscription history.
 *
 * Note: we intentionally don't down-grade access on `payment.failed`.
 * Dodo will retry, then emit `subscription.on_hold` (still active), and
 * eventually `subscription.cancelled` / `subscription.expired` — those
 * events flow through `subscription-sync.ts` which is the canonical place
 * for access-state changes.
 */

export type PaymentLifecycleEventType =
  | "payment.failed"
  | "payment.succeeded"
  | "payment.cancelled"
  | "refund.succeeded"
  | "refund.failed"
  | "dispute.opened"
  | "dispute.lost"
  | "dispute.won"
  | "dispute.challenged"
  | "dispute.expired"
  | "dispute.accepted"
  | "dispute.cancelled";

type ResolvedActor = {
  userId: string | null;
  subscriptionRowId: string | null;
  dodoCustomerId: string;
  dodoSubscriptionId: string | null;
};

async function resolveActorFromCustomer(params: {
  dodoCustomerId: string;
  dodoSubscriptionId: string | null;
}): Promise<ResolvedActor> {
  const { dodoCustomerId, dodoSubscriptionId } = params;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("dodo_customer_id", dodoCustomerId)
    .maybeSingle();

  const userId = (profile?.user_id as string | undefined) ?? null;

  let subscriptionRowId: string | null = null;
  if (dodoSubscriptionId) {
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("source", "dodo")
      .eq("external_subscription_id", dodoSubscriptionId)
      .maybeSingle();
    subscriptionRowId = (sub?.id as string | undefined) ?? null;
  }

  return {
    userId,
    subscriptionRowId,
    dodoCustomerId,
    dodoSubscriptionId,
  };
}

async function writeAuditNote(params: {
  actor: ResolvedActor;
  reason: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!params.actor.userId) {
    return;
  }

  const { error } = await supabaseAdmin.from("subscription_events").insert({
    user_id: params.actor.userId,
    subscription_id: params.actor.subscriptionRowId,
    event_type: "admin_note",
    source: "dodo",
    actor_user_id: null,
    reason: params.reason,
    metadata: params.metadata,
  });

  if (error) {
    logger.warn(
      { err: error, actor: params.actor, reason: params.reason },
      "dodo-payment-events: failed to write audit note (non-fatal)",
    );
  }
}

export async function applyDodoPaymentEvent(params: {
  eventType: PaymentLifecycleEventType;
  payment: Payment;
}): Promise<void> {
  const { eventType, payment } = params;
  const actor = await resolveActorFromCustomer({
    dodoCustomerId: payment.customer.customer_id,
    dodoSubscriptionId: payment.subscription_id ?? null,
  });

  const baseMetadata = {
    dodo_event_type: eventType,
    payment_id: payment.payment_id,
    status: payment.status,
    total_amount: payment.total_amount,
    currency: payment.currency,
    error_code: payment.error_code ?? null,
    error_message: payment.error_message ?? null,
    subscription_id: payment.subscription_id ?? null,
  } satisfies Record<string, unknown>;

  if (eventType === "payment.failed") {
    logger.warn(
      {
        eventType,
        paymentId: payment.payment_id,
        userId: actor.userId,
        dodoCustomerId: actor.dodoCustomerId,
        dodoSubscriptionId: actor.dodoSubscriptionId,
        errorCode: payment.error_code,
        errorMessage: payment.error_message,
      },
      "dodo: payment failed — Dodo will retry; user may end up on_hold",
    );
    await writeAuditNote({
      actor,
      reason: `payment_failed:${payment.error_code ?? "unknown"}`,
      metadata: baseMetadata,
    });
    return;
  }

  if (eventType === "payment.cancelled") {
    logger.info(
      {
        eventType,
        paymentId: payment.payment_id,
        userId: actor.userId,
      },
      "dodo: payment cancelled",
    );
    await writeAuditNote({
      actor,
      reason: "payment_cancelled",
      metadata: baseMetadata,
    });
    return;
  }

  // payment.succeeded — already covered by subscription.renewed for subs.
  // We just log; an audit row would just be noise.
  logger.info(
    {
      eventType,
      paymentId: payment.payment_id,
      userId: actor.userId,
      subscriptionId: payment.subscription_id ?? null,
    },
    "dodo: payment succeeded",
  );
}

export async function applyDodoRefundEvent(params: {
  eventType: PaymentLifecycleEventType;
  refund: Refund;
}): Promise<void> {
  const { eventType, refund } = params;
  const actor = await resolveActorFromCustomer({
    dodoCustomerId: refund.customer.customer_id,
    dodoSubscriptionId: null,
  });

  const baseMetadata = {
    dodo_event_type: eventType,
    refund_id: refund.refund_id,
    payment_id: refund.payment_id,
    status: refund.status,
    amount: refund.amount ?? null,
    currency: refund.currency ?? null,
    is_partial: refund.is_partial,
    reason: refund.reason ?? null,
  } satisfies Record<string, unknown>;

  if (eventType === "refund.succeeded") {
    logger.warn(
      {
        eventType,
        refundId: refund.refund_id,
        paymentId: refund.payment_id,
        userId: actor.userId,
        amount: refund.amount,
      },
      "dodo: refund issued",
    );
  } else {
    logger.info(
      {
        eventType,
        refundId: refund.refund_id,
        paymentId: refund.payment_id,
        userId: actor.userId,
      },
      "dodo: refund event",
    );
  }

  await writeAuditNote({
    actor,
    reason: eventType,
    metadata: baseMetadata,
  });
}

export async function applyDodoDisputeEvent(params: {
  eventType: PaymentLifecycleEventType;
  dispute: Dispute;
}): Promise<void> {
  const { eventType, dispute } = params;

  // The `Dispute` payload doesn't carry the customer — we need to resolve
  // it via the underlying payment. Best-effort: if Dodo rate-limits us, we
  // just log without an audit row.
  let dodoCustomerId: string | null = null;
  let dodoSubscriptionId: string | null = null;
  try {
    const payment = await getDodoClient().payments.retrieve(dispute.payment_id);
    dodoCustomerId = payment.customer.customer_id;
    dodoSubscriptionId = payment.subscription_id ?? null;
  } catch (error) {
    logger.warn(
      { err: error, disputeId: dispute.dispute_id, paymentId: dispute.payment_id },
      "dodo-disputes: failed to fetch underlying payment for customer resolution",
    );
  }

  const actor = dodoCustomerId
    ? await resolveActorFromCustomer({
        dodoCustomerId,
        dodoSubscriptionId,
      })
    : ({
        userId: null,
        subscriptionRowId: null,
        dodoCustomerId: "",
        dodoSubscriptionId: null,
      } satisfies ResolvedActor);

  const baseMetadata = {
    dodo_event_type: eventType,
    dispute_id: dispute.dispute_id,
    payment_id: dispute.payment_id,
    dispute_stage: dispute.dispute_stage,
    dispute_status: dispute.dispute_status,
    amount: dispute.amount,
    currency: dispute.currency,
    remarks: dispute.remarks ?? null,
  } satisfies Record<string, unknown>;

  // Disputes are always worth a loud log — they affect both revenue and
  // chargeback ratios, both of which matter for the payments account health.
  if (eventType === "dispute.opened" || eventType === "dispute.lost") {
    logger.error(
      {
        eventType,
        disputeId: dispute.dispute_id,
        paymentId: dispute.payment_id,
        userId: actor.userId,
        amount: dispute.amount,
      },
      "dodo: dispute event (action required)",
    );
  } else {
    logger.warn(
      {
        eventType,
        disputeId: dispute.dispute_id,
        paymentId: dispute.payment_id,
        userId: actor.userId,
      },
      "dodo: dispute event",
    );
  }

  await writeAuditNote({
    actor,
    reason: eventType,
    metadata: baseMetadata,
  });
}
