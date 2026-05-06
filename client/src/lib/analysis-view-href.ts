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
