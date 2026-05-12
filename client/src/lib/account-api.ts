/**
 * Suppression de compte via l’API serveur (service role + purge R2).
 * Ne pas appeler supabase.auth.admin.* depuis le navigateur.
 */

import { reportClientError } from "@/lib/report-client-error";

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (typeof j?.error?.message === "string" && j.error.message.trim()) {
      return j.error.message;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function deleteMyAccount(accessToken: string): Promise<void> {
  const res = await fetch("/v1/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });

  if (res.ok) {
    return;
  }

  const message = await parseErrorMessage(
    res,
    "Unable to delete account right now. Try again later.",
  );
  reportClientError({
    source: "account.delete.failed",
    message,
    payload: { status: res.status },
  });
  throw new Error(message);
}
