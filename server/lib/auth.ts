import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase-admin";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export function getBearerToken(authorizationHeader: string | undefined): string {
  const [scheme, token] = authorizationHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new ApiError({
      code: "API_KEY_MISSING",
      status: 401,
      message: "Missing Supabase access token",
    });
  }

  return token;
}

export async function requireUser(
  authorizationHeader: string | undefined,
): Promise<AuthenticatedUser> {
  const token = getBearerToken(authorizationHeader);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Invalid Supabase access token",
    });
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

export async function requireUserId(authorizationHeader: string | undefined): Promise<string> {
  const user = await requireUser(authorizationHeader);
  return user.id;
}

export async function requireAdminUser(
  authorizationHeader: string | undefined,
): Promise<AuthenticatedUser> {
  const user = await requireUser(authorizationHeader);
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to verify admin access",
      details: error,
    });
  }

  if (!profile || profile.role !== "admin") {
    throw new ApiError({
      code: "API_KEY_FORBIDDEN",
      status: 403,
      message: "Admin access is required",
    });
  }

  return {
    id: user.id,
    email: user.email ?? profile.email ?? undefined,
  };
}
