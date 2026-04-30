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

function readPayloadLimit(value: string | undefined): string {
  return value && value.length > 0 ? value : "12mb";
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
  SCOREMAX_PAYLOAD_LIMIT: readPayloadLimit(readEnv("SCOREMAX_PAYLOAD_LIMIT")),
};

export function getScoreMaxEnv(): {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
} {
  return {
    baseUrl: requireEnv("SCOREMAX_API_BASE_URL"),
    apiKey: requireEnv("SCOREMAX_API_KEY"),
    timeoutMs: parseTimeoutMs(readEnv("SCOREMAX_API_TIMEOUT_MS")),
  };
}

export function getSupabaseAdminEnv(): {
  url: string;
  serviceRoleKey: string;
} {
  return {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getR2Env(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
} {
  return {
    accountId: requireEnv("R2_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
  };
}
