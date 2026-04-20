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
