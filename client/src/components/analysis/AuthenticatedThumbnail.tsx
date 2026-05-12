import * as React from "react";
import { supabase } from "@/lib/supabase";

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

      const response = await fetch(src, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
