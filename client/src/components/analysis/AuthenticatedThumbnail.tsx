import * as React from "react";
import { supabase } from "@/lib/supabase";
import { probeAvifSupport } from "@/lib/avif-support";

/**
 * Authenticated image proxy with AVIF negotiation.
 *
 * The underlying `/v1/analyses/.../{thumbnail,asset}` endpoints accept a
 * `?fmt=avif` query parameter (see `serveAssetWithAvifNegotiation` on the
 * server). When the browser confirms AVIF decode support we *first* try the
 * `?fmt=avif` URL; if it 404s (legacy asset, unsupported source MIME, encode
 * failure) we transparently fall back to the original URL. This keeps the
 * server side simple — no `Vary: Accept` games — while still saving bandwidth
 * for the 95 %+ of visitors on AVIF-capable browsers.
 */
function appendFormatQuery(url: string, fmt: "avif"): string {
  return `${url}${url.includes("?") ? "&" : "?"}fmt=${fmt}`;
}

export function AuthenticatedThumbnail({
  src,
  alt,
  className,
  fallback,
  /** Si vrai, ne rend rien après un échec réseau / 401 / 404 (utile pour les assets optionnels par job). */
  hideWhenUnavailable = false,
  /** Si défini, entoure l’image ou le fallback d’un conteneur ; absent quand `hideWhenUnavailable` et indisponible. */
  wrapperClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  hideWhenUnavailable?: boolean;
  wrapperClassName?: string;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  React.useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;
    setStatus("loading");
    setObjectUrl(null);

    async function fetchWithToken(url: string, token: string) {
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setStatus("unavailable");
          setObjectUrl(null);
        }
        return;
      }

      const avifSupported = await probeAvifSupport();
      let response: Response | null = null;

      if (avifSupported) {
        const avifResponse = await fetchWithToken(
          appendFormatQuery(src, "avif"),
          token,
        );
        if (avifResponse.ok) {
          response = avifResponse;
        }
      }

      if (!response) {
        response = await fetchWithToken(src, token);
      }

      if (!response.ok) {
        if (!cancelled) {
          setStatus("unavailable");
          setObjectUrl(null);
        }
        return;
      }

      const blob = await response.blob();
      currentObjectUrl = URL.createObjectURL(blob);
      if (!cancelled) {
        setObjectUrl(currentObjectUrl);
        setStatus("ready");
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setStatus("unavailable");
        setObjectUrl(null);
      }
    });

    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [src]);

  if (hideWhenUnavailable && status === "unavailable") {
    return null;
  }

  const inner = !objectUrl ? (
    <>{fallback ?? null}</>
  ) : (
    <img src={objectUrl} alt={alt} className={className} />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{inner}</div>;
  }

  return inner;
}
