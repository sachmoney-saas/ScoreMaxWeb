const ADMIN_IMPERSONATE_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `?asUser=<uuid>` : lecture d’une analyse au nom d’un autre utilisateur (réservé aux admins côté API).
 */
export function parseAdminImpersonationUserId(
  currentSearch: string,
  isAdmin: boolean,
): string | undefined {
  if (!isAdmin) return undefined;
  const trimmed = currentSearch.startsWith("?")
    ? currentSearch.slice(1)
    : currentSearch;
  const raw = new URLSearchParams(trimmed).get("asUser");
  if (!raw || !ADMIN_IMPERSONATE_USER_ID_RE.test(raw)) return undefined;
  return raw;
}

/**
 * URL de la vue analyse (overview / recommandations) en conservant les autres
 * paramètres de query (ex. `lang=`).
 */
export function buildAnalysisViewHref(
  jobId: string,
  currentSearch: string,
  tab: "overview" | "recommendations",
): string {
  const trimmed = currentSearch.startsWith("?")
    ? currentSearch.slice(1)
    : currentSearch;
  const params = new URLSearchParams(trimmed || undefined);
  if (tab === "recommendations") {
    params.set("tab", "recommendations");
  } else {
    params.delete("tab");
  }
  const query = params.toString();
  return `/app/analyses/${jobId}${query ? `?${query}` : ""}`;
}

export function parseAnalysisTabFromSearch(
  currentSearch: string,
): "overview" | "recommendations" {
  const trimmed = currentSearch.startsWith("?")
    ? currentSearch.slice(1)
    : currentSearch;
  const tab = new URLSearchParams(trimmed).get("tab");
  return tab === "recommendations" ? "recommendations" : "overview";
}
