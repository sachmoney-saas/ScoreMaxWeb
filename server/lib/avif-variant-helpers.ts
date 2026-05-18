/**
 * Pure helpers for the AVIF variant pipeline.
 *
 * Kept separate from `avif-variant.ts` so unit tests can import them without
 * pulling in R2/sharp (which require server env to be configured).
 */

const SUPPORTED_SOURCE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Pure: derive the AVIF key for a given source key. */
export function avifKeyFor(sourceKey: string): string {
  return `${sourceKey}.avif`;
}

/** Pure: whether a given MIME type is something we'll transcode to AVIF. */
export function isAvifSourceContentTypeSupported(
  contentType: string | null | undefined,
): boolean {
  if (!contentType) {
    return true;
  }
  return SUPPORTED_SOURCE_CONTENT_TYPES.has(contentType);
}

/**
 * Pure: parse a comma-separated `Accept` header and decide if the client
 * positively accepts AVIF (i.e. lists `image/avif` or `image/*` / `*\/*`).
 *
 * We deliberately ignore quality factors (`q=0`) for now — they're rare from
 * real browsers, and serving AVIF when the client said `q=0` only triggers
 * a one-shot fallback, not a long-term issue.
 */
export function acceptsAvif(acceptHeader: string | null | undefined): boolean {
  if (!acceptHeader) return false;
  const lower = acceptHeader.toLowerCase();
  return (
    lower.includes("image/avif") ||
    lower.includes("image/*") ||
    lower.includes("*/*")
  );
}
