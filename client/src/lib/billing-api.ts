import type { Plan, PremiumAccessState } from "@shared/schema";
import { supabase } from "@/lib/supabase";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error?: { message?: string } | null;
};

async function authedFetch<T>(params: {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  fallbackError: string;
}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Vous devez être connecté pour effectuer cette action.");
  }

  const init: RequestInit = {
    method: params.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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

export async function fetchBillingState(): Promise<PremiumAccessState> {
  return authedFetch<PremiumAccessState>({
    path: "/v1/billing/subscription",
    method: "GET",
    fallbackError: "Impossible de charger l'état de l'abonnement.",
  });
}

export async function createBillingCheckout(plan: Plan): Promise<{
  session_id: string;
  checkout_url: string;
}> {
  return authedFetch<{ session_id: string; checkout_url: string }>({
    path: "/v1/billing/checkout",
    method: "POST",
    body: { plan },
    fallbackError: "Impossible de démarrer le paiement.",
  });
}

export async function createBillingPortalSession(): Promise<{
  portal_url: string;
}> {
  return authedFetch<{ portal_url: string }>({
    path: "/v1/billing/portal",
    method: "POST",
    fallbackError: "Impossible d'ouvrir le portail de gestion.",
  });
}
