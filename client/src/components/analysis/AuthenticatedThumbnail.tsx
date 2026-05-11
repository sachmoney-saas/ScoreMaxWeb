import * as React from "react";
import { supabase } from "@/lib/supabase";

export function AuthenticatedThumbnail({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setObjectUrl(null);
        return;
      }

      const response = await fetch(src, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (!cancelled) setObjectUrl(null);
        return;
      }

      const blob = await response.blob();
      currentObjectUrl = URL.createObjectURL(blob);
      if (!cancelled) {
        setObjectUrl(currentObjectUrl);
      }
    }

    load().catch(() => {
      if (!cancelled) setObjectUrl(null);
    });

    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [src]);

  if (!objectUrl) {
    return <>{fallback ?? null}</>;
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}
