import DodoPayments from "dodopayments";
import { getDodoEnv } from "./env";

let cachedClient: DodoPayments | null = null;

/**
 * Singleton Dodo Payments SDK client.
 *
 * Lazy so the rest of the server (tests, health checks, non-billing routes)
 * can boot even when Dodo credentials are not yet provisioned. The first
 * billing or webhook call will fail loudly with an env error instead.
 */
export function getDodoClient(): DodoPayments {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getDodoEnv();
  cachedClient = new DodoPayments({
    bearerToken: env.apiKey,
    webhookKey: env.webhookKey,
    environment: env.environment,
  });
  return cachedClient;
}
