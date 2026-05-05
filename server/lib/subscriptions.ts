import type {
  PremiumAccessState,
  SubscriptionEventType,
  SubscriptionSource,
} from "@shared/schema";
import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";

type ProfileAccessRow = {
  id: string;
  role: "user" | "admin" | string | null;
};

type ActiveSubscriptionRow = {
  id: string;
  status: "active" | "canceled" | "expired";
  source: SubscriptionSource;
  current_period_start: string | null;
  current_period_end: string | null;
  granted_reason: string | null;
  created_at: string;
};

async function loadProfileAccess(userId: string): Promise<ProfileAccessRow> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load profile",
      details: error,
    });
  }

  if (!data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "User profile not found",
    });
  }

  return data as ProfileAccessRow;
}

async function loadActiveSubscriptionRow(
  userId: string,
): Promise<ActiveSubscriptionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select(
      "id, status, source, current_period_start, current_period_end, granted_reason, created_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load active subscription",
      details: error,
    });
  }

  return (data as ActiveSubscriptionRow | null) ?? null;
}

function isActiveWithinPeriod(row: ActiveSubscriptionRow | null): boolean {
  if (!row) {
    return false;
  }

  if (row.current_period_end === null) {
    return true;
  }

  const expiresAt = new Date(row.current_period_end).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/**
 * Source of truth for premium-access checks across the server.
 *
 * - `is_subscriber`        : has at least one row in user_subscriptions with
 *                            status='active' (and within current_period_end).
 * - `is_admin`             : profiles.role = 'admin'.
 * - `has_premium_access`   : is_admin OR is_subscriber. This is what most
 *                            features should gate on.
 */
export async function getPremiumAccessState(
  userId: string,
): Promise<PremiumAccessState> {
  const [profile, subscription] = await Promise.all([
    loadProfileAccess(userId),
    loadActiveSubscriptionRow(userId),
  ]);

  const isAdmin = profile.role === "admin";
  const isSubscriber = isActiveWithinPeriod(subscription);

  return {
    has_premium_access: isAdmin || isSubscriber,
    is_subscriber: isSubscriber,
    is_admin: isAdmin,
    active_subscription: isSubscriber ? subscription : null,
  };
}

/** Convenience boolean for hot paths (analysis clamp, route guards, etc). */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const state = await getPremiumAccessState(userId);
  return state.has_premium_access;
}

async function logSubscriptionEvent(params: {
  userId: string;
  subscriptionId: string | null;
  eventType: SubscriptionEventType;
  source: SubscriptionSource | "system";
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("subscription_events").insert({
    user_id: params.userId,
    subscription_id: params.subscriptionId,
    event_type: params.eventType,
    source: params.source,
    actor_user_id: params.actorUserId ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to log subscription event",
      details: error,
    });
  }
}

/**
 * Grant or refresh a manual admin subscription.
 *
 * - If an active subscription already exists, returns it untouched (idempotent).
 * - Otherwise inserts a new active row with `source='manual_admin'`.
 * - Records a `granted` event in `subscription_events`.
 */
export async function grantManualSubscription(params: {
  userId: string;
  actorUserId: string;
  reason?: string | null;
  /** ISO date string; null/undefined → perpetual access (no expiry). */
  endsAt?: string | null;
}): Promise<PremiumAccessState> {
  const existing = await loadActiveSubscriptionRow(params.userId);
  if (existing) {
    return getPremiumAccessState(params.userId);
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .insert({
      user_id: params.userId,
      status: "active",
      source: "manual_admin",
      current_period_start: new Date().toISOString(),
      current_period_end: params.endsAt ?? null,
      granted_by: params.actorUserId,
      granted_reason: params.reason ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to grant subscription",
      details: error,
    });
  }

  await logSubscriptionEvent({
    userId: params.userId,
    subscriptionId: data.id as string,
    eventType: "granted",
    source: "manual_admin",
    actorUserId: params.actorUserId,
    reason: params.reason ?? null,
  });

  return getPremiumAccessState(params.userId);
}

/**
 * Revoke any active subscription (manual or otherwise) for the user.
 * Marks the row as `canceled` and logs a `revoked` event. Idempotent.
 */
export async function revokeSubscription(params: {
  userId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<PremiumAccessState> {
  const existing = await loadActiveSubscriptionRow(params.userId);
  if (!existing) {
    return getPremiumAccessState(params.userId);
  }

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "canceled" })
    .eq("id", existing.id)
    .eq("user_id", params.userId);

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to revoke subscription",
      details: error,
    });
  }

  await logSubscriptionEvent({
    userId: params.userId,
    subscriptionId: existing.id,
    eventType: "revoked",
    source: existing.source,
    actorUserId: params.actorUserId,
    reason: params.reason ?? null,
  });

  return getPremiumAccessState(params.userId);
}

/**
 * Express helper: throw a structured 403 when the caller does not have premium
 * access. Use this on routes that gate paid features.
 */
export async function requirePremiumAccess(userId: string): Promise<void> {
  const allowed = await hasPremiumAccess(userId);
  if (!allowed) {
    throw new ApiError({
      code: "API_KEY_FORBIDDEN",
      status: 403,
      message: "Premium subscription required",
      details: { reason: "premium_required" },
    });
  }
}
