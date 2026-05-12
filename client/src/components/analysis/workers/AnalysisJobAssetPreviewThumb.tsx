import * as React from "react";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Miniature depuis `GET /v1/analyses/:jobId/asset` — clic pour agrandir (lightbox).
 */
export function AnalysisJobAssetPreviewThumb({
  src,
  alt,
  className,
  imgClassName,
  bare = false,
  imgFit = "cover",
  /**
   * Faux pour désactiver le zoom (cas rare où le clic doit rester disponible au parent).
   */
  zoomable = true,
  onUnavailable: _onUnavailable,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  onUnavailable?: () => void;
  bare?: boolean;
  imgFit?: "cover" | "contain";
  zoomable?: boolean;
}) {
  const language = useAppLanguage();
  const [zoomOpen, setZoomOpen] = React.useState(false);

  if (!src) return null;

  const imgCn =
    imgFit === "contain"
      ? cn(
          "mx-auto block h-auto w-auto max-w-full object-contain",
          imgClassName,
        )
      : cn("h-full w-full object-cover", imgClassName);

  const thumbnailInner = (
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
  );

  /** `contain` : largeur suit l’image (jusqu’à `max-w-full` au parent). */
  const paddedFrame =
    imgFit === "contain"
      ? "inline-flex w-fit max-w-full shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      : null;

  const outerBare = cn(
    imgFit === "contain" &&
      "inline-flex w-fit max-w-full shrink-0 items-center justify-center",
    className,
  );

  const outerDefault = cn(
    imgFit === "contain"
      ? paddedFrame
      : "overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
    className,
  );

  const zoomTriggerClass = cn(
    zoomable &&
      "cursor-zoom-in rounded-[inherit] transition-opacity hover:opacity-[0.97] focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
  );

  const enlargeLabel = i18n(language, {
    en: "Enlarge image",
    fr: "Agrandir l'image",
  });

  /** Bouton neutre qui reprend les classes du conteneur (inline-flex ou bloc). */
  const triggerWrap = (
    outer: string,
  ): React.ReactElement => (
    <button
      type="button"
      aria-label={enlargeLabel}
      title={enlargeLabel}
      className={cn(
        zoomTriggerClass,
        "m-0 border-0 bg-transparent p-0 text-left [font:inherit] [-webkit-tap-highlight-color:transparent]",
        outer,
      )}
    >
      {thumbnailInner}
    </button>
  );

  const staticWrap = (
    outer: string,
  ): React.ReactElement => <div className={outer}>{thumbnailInner}</div>;

  let frame = zoomable
      ? triggerWrap(bare ? outerBare : outerDefault)
      : staticWrap(bare ? outerBare : outerDefault);

  if (!zoomable) {
    return frame;
  }

  return (
    <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
      <DialogTrigger asChild>{frame}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[92vh] w-[min(96vw,72rem)] max-w-[96vw] gap-0 border-zinc-700 bg-zinc-950 p-3 sm:p-5",
          "[&_button.absolute]:right-4 [&_button.absolute]:top-4 [&_button.absolute]:text-zinc-100 [&_button.absolute]:opacity-95 hover:[&_button.absolute]:opacity-100",
        )}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="flex max-h-[min(86vh,900px)] w-full items-center justify-center overflow-auto px-1">
          <AuthenticatedThumbnail
            src={src}
            alt={alt}
            className="h-auto max-h-[min(84vh,880px)] w-auto max-w-full object-contain"
            fallback={
              <div className="flex min-h-[12rem] items-center justify-center text-sm text-zinc-500">
                —
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
