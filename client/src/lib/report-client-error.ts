import { supabase } from "@/lib/supabase";

/** Chemin API de remontée — à exclure pour éviter les boucles. */
export const CLIENT_ERROR_REPORT_API_PATH = "/v1/client-errors";

export function shouldSkipClientErrorReportingForUrl(url: string): boolean {
  return url.includes(CLIENT_ERROR_REPORT_API_PATH);
}

export type ReportClientErrorInput = {
  source: string;
  message: string;
  errorCode?: string;
  errorDetail?: string;
  errorHint?: string;
  payload?: Record<string, unknown>;
};

/**
 * Envoie une erreur applicative au backend (persistée en base).
 * Fire-and-forget : ne doit pas bloquer l’UI ni déclencher la redirection login sur échec.
 */
export function reportClientError(input: ReportClientErrorInput): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        return;
      }

      const body = {
        source: input.source,
        message: input.message,
        errorCode: input.errorCode,
        errorDetail: input.errorDetail,
        errorHint: input.errorHint,
        payload: input.payload,
        clientRoute:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      await fetch("/v1/client-errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch {
      // Ignorer silencieusement (réseau, etc.).
    }
  })();
}
