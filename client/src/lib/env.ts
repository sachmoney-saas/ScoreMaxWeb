const requiredClientKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

type RequiredClientKey = (typeof requiredClientKeys)[number];

function readClientEnv(name: string): string {
  const value = import.meta.env[name];
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

const missingRequired = requiredClientKeys.filter((key) => !readClientEnv(key));
if (missingRequired.length > 0) {
  throw new Error(
    `Missing required client environment variables: ${missingRequired.join(", ")}`,
  );
}

export const clientEnv: Record<RequiredClientKey, string> & {
  VITE_STRIPE_PUBLIC_KEY: string;
} = {
  VITE_SUPABASE_URL: readClientEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: readClientEnv("VITE_SUPABASE_ANON_KEY"),
  VITE_STRIPE_PUBLIC_KEY: readClientEnv("VITE_STRIPE_PUBLIC_KEY"),
};
