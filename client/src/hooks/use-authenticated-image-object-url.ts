import * as React from "react";
import { probeAvifSupport } from "@/lib/avif-support";
import { supabase } from "@/lib/supabase";

export type AuthenticatedImageStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable";

function appendFormatQuery(url: string, fmt: "avif"): string {
  return `${url}${url.includes("?") ? "&" : "?"}fmt=${fmt}`;
}

async function fetchAuthenticatedImage(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function useAuthenticatedImageObjectUrl(
  src: string | null | undefined,
  options?: {
    enabled?: boolean;
    preferAvif?: boolean;
  },
): {
  objectUrl: string | null;
  status: AuthenticatedImageStatus;
} {
  const enabled = (options?.enabled ?? true) && Boolean(src);
  const preferAvif = options?.preferAvif ?? true;
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AuthenticatedImageStatus>(
    enabled ? "loading" : "idle",
  );

  React.useEffect(() => {
    if (!enabled || !src) {
      setObjectUrl(null);
      setStatus("idle");
      return;
    }

    const url = src;
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    setObjectUrl(null);
    setStatus("loading");

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

      let response: Response | null = null;

      if (preferAvif && (await probeAvifSupport())) {
        const avifResponse = await fetchAuthenticatedImage(
          appendFormatQuery(url, "avif"),
          token,
        );
        if (avifResponse.ok) {
          response = avifResponse;
        }
      }

      if (!response) {
        response = await fetchAuthenticatedImage(url, token);
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
  }, [enabled, preferAvif, src]);

  return { objectUrl, status };
}
