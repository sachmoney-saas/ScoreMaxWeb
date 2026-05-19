import * as React from "react";
import { useAuthenticatedImageObjectUrl } from "@/hooks/use-authenticated-image-object-url";

/**
 * Authenticated image proxy with AVIF negotiation.
 *
 * The underlying `/v1/analyses/.../{thumbnail,asset}` endpoints accept a
 * `?fmt=avif` query parameter (see `serveR2ImageAssetWithAvifNegotiation` on the
 * server). When the browser confirms AVIF decode support we first try the
 * `?fmt=avif` URL; if it 404s (legacy asset, unsupported source MIME, encode
 * failure) we transparently fall back to the original URL. This keeps the
 * server side simple while still saving bandwidth for AVIF-capable browsers.
 */
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
  const { objectUrl, status } = useAuthenticatedImageObjectUrl(src);

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
