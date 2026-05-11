import * as React from "react";
import { cn } from "@/lib/utils";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";

/**
 * Miniature depuis `GET /v1/analyses/:jobId/asset` — masquée si 404 / erreur réseau.
 */
export function AnalysisJobAssetPreviewThumb({
  src,
  alt,
  className,
  imgClassName,
  onUnavailable,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  onUnavailable?: () => void;
}) {
  if (!src) return null;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <AuthenticatedThumbnail
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", imgClassName)}
        fallback={
          <div className="flex aspect-square items-center justify-center text-xs text-zinc-500">
            —
          </div>
        }
      />
    </div>
  );
}
