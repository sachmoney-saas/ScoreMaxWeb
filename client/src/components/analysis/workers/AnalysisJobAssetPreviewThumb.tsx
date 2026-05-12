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
  /**
   * `cover` remplit un cadre à dimensions fixes (défaut, vignettes carrées).
   * `contain` conserve le ratio intrinsèque de l’asset — adapté aux crops larges (ex. lèvres).
   */
  imgFit = "cover",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  onUnavailable?: () => void;
  imgFit?: "cover" | "contain";
}) {
  if (!src) return null;
  const imgCn =
    imgFit === "contain"
      ? cn(
          "mx-auto block h-auto max-h-[11rem] w-auto max-w-full object-contain",
          imgClassName,
        )
      : cn("h-full w-full object-cover", imgClassName);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        imgFit === "contain" && "flex justify-center py-1",
        className,
      )}
    >
      <AuthenticatedThumbnail
        src={src}
        alt={alt}
        className={imgCn}
        fallback={
          <div
            className={cn(
              "flex items-center justify-center text-xs text-zinc-500",
              imgFit === "cover" ? "aspect-square" : "min-h-[5rem] py-8",
            )}
          >
            —
          </div>
        }
      />
    </div>
  );
}
