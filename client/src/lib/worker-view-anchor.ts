/**
 * Ancres stables pour la page détail worker : scroll depuis les « toiles »
 * (radars, matrices, galeries) vers les blocs de scores / explications.
 */

export function workerMetricAnchorId(
  workerKey: string,
  metricPath: string,
): string {
  const slug = metricPath
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `worker-${workerKey}-metric-${slug}`;
}

export function workerSectionAnchorId(
  workerKey: string,
  sectionSlug: string,
): string {
  const slug = sectionSlug
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `worker-${workerKey}-section-${slug}`;
}

export function scrollToWorkerAnchor(rawId: string): void {
  const id = rawId.startsWith("#") ? rawId.slice(1) : rawId;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  });
}
