function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "5000", 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return 5000;
  }

  return parsed;
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "15000", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 15000;
  }

  return parsed;
}

function parseMaxImageBytes(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "6291456", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 6291456;
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseWorkers(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((worker) => worker.trim())
    .filter((worker) => worker.length > 0);
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export const serverEnv = {
  NODE_ENV: readEnv("NODE_ENV") ?? "development",
  PORT: parsePort(readEnv("PORT")),
  LOG_LEVEL: readEnv("LOG_LEVEL") ?? "info",
};

export function getSupabaseAdminEnv(): {
  supabaseUrl: string;
  serviceRoleKey: string;
} {
  const supabaseUrl = readEnv("SUPABASE_URL") ?? readEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl ? "SUPABASE_URL (or VITE_SUPABASE_URL)" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter((value): value is string => value !== null);

    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}`,
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

export function getOneshotEnv(): {
  baseUrl: string;
  upstreamApiKey: string;
  timeoutMs: number;
  maxImageBytes: number;
  supportedWorkers: string[];
} {
  return {
    baseUrl: requireEnv("ONESHOT_API_BASE_URL"),
    upstreamApiKey: requireEnv("ONESHOT_API_KEY"),
    timeoutMs: parseTimeoutMs(readEnv("ONESHOT_TIMEOUT_MS")),
    maxImageBytes: parseMaxImageBytes(readEnv("MAX_IMAGE_BYTES")),
    supportedWorkers: parseWorkers(readEnv("ONESHOT_SUPPORTED_WORKERS")),
  };
}

export function getApiKeyConfig(): {
  pepper: string;
  adminRoutesEnabled: boolean;
} {
  const isProduction = serverEnv.NODE_ENV === "production";

  return {
    pepper: requireEnv("API_KEY_PEPPER"),
    adminRoutesEnabled: parseBoolean(readEnv("ENABLE_ADMIN_API_KEYS"), !isProduction),
  };
}
