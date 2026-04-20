import { supabase } from "./supabase";
import { clientEnv } from "./env";

/**
 * Stripe utility for future integration
 * This prepares the ground for a future Stripe integration.
 */

export const STRIPE_CONFIG = {
  STRIPE_PUBLIC_KEY: clientEnv.VITE_STRIPE_PUBLIC_KEY,
};

export async function getSubscriptionStatus(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_subscriber, subscription_status")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

// Placeholder for Stripe Checkout flow
export async function createCheckoutSession(priceId: string) {
  // This will be implemented when the Stripe connector is fully setup
  console.log("Creating checkout session for:", priceId);
  return null;
}
