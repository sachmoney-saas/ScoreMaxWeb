import type { PremiumAccessState } from "@shared/schema";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error?: { message?: string } | null;
};

async function adminFetch<T>(params: {
  path: string;
  method: "GET" | "POST";
  accessToken: string;
  body?: Record<string, unknown>;
  fallbackError: string;
}): Promise<T> {
  const init: RequestInit = {
    method: params.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    credentials: "include",
  };

  if (params.body !== undefined) {
    init.body = JSON.stringify(params.body);
  }

  const res = await fetch(params.path, init);
  if (!res.ok) {
    let message = params.fallbackError;
    try {
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (json?.error?.message) {
        message = json.error.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok || json.data === null || json.data === undefined) {
    throw new Error(json.error?.message ?? params.fallbackError);
  }

  return json.data;
}

export async function getUserSubscriptionState(params: {
  accessToken: string;
  userId: string;
}): Promise<PremiumAccessState> {
  return adminFetch<PremiumAccessState>({
    path: `/v1/admin/users/${encodeURIComponent(params.userId)}/subscription`,
    method: "GET",
    accessToken: params.accessToken,
    fallbackError: "Unable to load subscription state",
  });
}

export async function grantUserSubscription(params: {
  accessToken: string;
  userId: string;
  reason?: string | null;
  /** ISO 8601 datetime; null/undefined = no expiry. */
  endsAt?: string | null;
}): Promise<PremiumAccessState> {
  return adminFetch<PremiumAccessState>({
    path: `/v1/admin/users/${encodeURIComponent(params.userId)}/subscription/grant`,
    method: "POST",
    accessToken: params.accessToken,
    body: {
      ...(params.reason !== undefined ? { reason: params.reason } : {}),
      ...(params.endsAt !== undefined ? { endsAt: params.endsAt } : {}),
    },
    fallbackError: "Unable to grant subscription",
  });
}

export async function revokeUserSubscription(params: {
  accessToken: string;
  userId: string;
  reason?: string | null;
}): Promise<PremiumAccessState> {
  return adminFetch<PremiumAccessState>({
    path: `/v1/admin/users/${encodeURIComponent(params.userId)}/subscription/revoke`,
    method: "POST",
    accessToken: params.accessToken,
    body: params.reason !== undefined ? { reason: params.reason } : {},
    fallbackError: "Unable to revoke subscription",
  });
}
