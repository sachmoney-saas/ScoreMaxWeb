import * as React from "react";

/**
 * Runtime AVIF support detection.
 *
 * Why not just rely on `<picture><source type="image/avif">` for fallback?
 * Two reasons specific to this codebase:
 *
 *  1. `useDecodedImage` and similar hooks instantiate `new Image()` directly
 *     and read `.naturalWidth` / `decode()` — there's no `<picture>` in the
 *     loop, so the browser cannot pick the variant for us.
 *  2. `AuthenticatedThumbnail` performs an authenticated `fetch` to a proxy
 *     endpoint; we need to know up-front whether to send `?fmt=avif` to save
 *     the round-trip vs. a 404-then-retry.
 *
 * Detection is a one-pixel AVIF data URL. Decode is cached for the lifetime
 * of the page (the answer is constant per browser session).
 */

const AVIF_PROBE_DATA_URL =
  "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8DAAAEAAAACvJB4AA==";

let cachedSupport: boolean | null = null;
let inFlightProbe: Promise<boolean> | null = null;

/** Returns true once the runtime has confirmed it can decode an AVIF blob. */
export function probeAvifSupport(): Promise<boolean> {
  if (cachedSupport !== null) return Promise.resolve(cachedSupport);
  if (inFlightProbe) return inFlightProbe;

  inFlightProbe = new Promise<boolean>((resolve) => {
    const img = new Image();
    const finalize = (supported: boolean) => {
      cachedSupport = supported;
      inFlightProbe = null;
      resolve(supported);
    };
    img.onload = () => finalize(img.width > 0 && img.height > 0);
    img.onerror = () => finalize(false);
    img.src = AVIF_PROBE_DATA_URL;
  });

  return inFlightProbe;
}

/**
 * React hook variant. Starts as `null` (unknown) on the first render and
 * resolves to a boolean once the probe completes — usually within a microtask.
 *
 * Components are expected to treat `null` as "don't know yet, use the safe
 * fallback (JPEG)".
 */
export function useAvifSupport(): boolean | null {
  const [supported, setSupported] = React.useState<boolean | null>(
    cachedSupport,
  );

  React.useEffect(() => {
    if (cachedSupport !== null) {
      if (cachedSupport !== supported) {
        setSupported(cachedSupport);
      }
      return;
    }
    let cancelled = false;
    void probeAvifSupport().then((value) => {
      if (!cancelled) setSupported(value);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  return supported;
}

/**
 * Pure: pick the best displayable URL given current AVIF support.
 *
 *  - `supportsAvif === true` and AVIF URL set → AVIF wins.
 *  - `supportsAvif === false` → always the fallback.
 *  - `supportsAvif === null` (still probing) → use fallback to avoid a wasted
 *    request on Safari < 16 etc.
 */
export function pickBestImageUrl(
  options: { avif: string | null | undefined; fallback: string | null | undefined },
  supportsAvif: boolean | null,
): string | null {
  if (supportsAvif === true && options.avif) return options.avif;
  return options.fallback ?? null;
}

export const __testing__ = {
  AVIF_PROBE_DATA_URL,
  resetCache(): void {
    cachedSupport = null;
    inFlightProbe = null;
  },
};
