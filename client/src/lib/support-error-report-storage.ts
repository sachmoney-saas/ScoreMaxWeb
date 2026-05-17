/** Données d’erreur client transmises à la page `/support/error` (sessionStorage, onglet courant). */
export const SUPPORT_ERROR_REPORT_STORAGE_KEY = "sm_support_error_report";

export type SupportErrorReportV1 = {
  v: 1;
  ts: number;
  source: string;
  message: string;
  stack?: string;
  componentStack?: string;
  href: string;
  userAgent: string;
};

export function storeSupportErrorReport(
  data: Omit<SupportErrorReportV1, "v" | "ts" | "userAgent"> &
    Partial<Pick<SupportErrorReportV1, "userAgent">>,
): void {
  if (typeof window === "undefined") return;
  const payload: SupportErrorReportV1 = {
    v: 1,
    ts: Date.now(),
    userAgent:
      data.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent : ""),
    source: data.source,
    message: data.message,
    stack: data.stack,
    componentStack: data.componentStack,
    href: data.href,
  };
  try {
    window.sessionStorage.setItem(
      SUPPORT_ERROR_REPORT_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* quota / mode privé */
  }
}

export function consumeSupportErrorReport(): SupportErrorReportV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SUPPORT_ERROR_REPORT_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(SUPPORT_ERROR_REPORT_STORAGE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1 || typeof o.message !== "string" || typeof o.href !== "string") {
      return null;
    }
    return o as SupportErrorReportV1;
  } catch {
    return null;
  }
}
