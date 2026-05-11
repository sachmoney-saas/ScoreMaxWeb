import type { Plan as DodoPlan } from "@shared/schema";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export type DodoEnvironment = "test_mode" | "live_mode";

function parseEnvironment(raw: string | undefined): DodoEnvironment {
  if (raw === "live_mode" || raw === "test_mode") {
    return raw;
  }
  // Default to test_mode to avoid charging real customers from a misconfigured env.
  return "test_mode";
}

export type DodoEnv = {
  apiKey: string;
  webhookKey: string;
  environment: DodoEnvironment;
  productIds: Record<DodoPlan, string>;
  appBaseUrl: string;
};

/**
 * Dodo Payments configuration, loaded lazily so the rest of the server (tests,
 * non-billing endpoints) can boot even when Dodo keys are not yet provisioned.
 *
 * Throws as soon as any billing code path is hit without proper configuration.
 */
export function getDodoEnv(): DodoEnv {
  return {
    apiKey: requireEnv("DODO_PAYMENTS_API_KEY"),
    webhookKey: requireEnv("DODO_PAYMENTS_WEBHOOK_KEY"),
    environment: parseEnvironment(readEnv("DODO_PAYMENTS_ENVIRONMENT")),
    productIds: {
      monthly: requireEnv("DODO_PRODUCT_ID_MONTHLY"),
      yearly: requireEnv("DODO_PRODUCT_ID_YEARLY"),
    },
    appBaseUrl: requireEnv("APP_BASE_URL"),
  };
}
