import * as React from "react";

type PictureAvifProps = {
  avifSrc: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  decoding?: React.ImgHTMLAttributes<HTMLImageElement>["decoding"];
  sizes?: string;
  loading?: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
};

/**
 * AVIF prioritaire avec repli automatique sur JPEG/PNG si le navigateur ne lit pas l’AVIF.
 */
export function PictureAvif({
  avifSrc,
  fallbackSrc,
  alt,
  className,
  imgClassName,
  decoding = "async",
  sizes,
  loading,
}: PictureAvifProps) {
  return (
    <picture className={className}>
      <source srcSet={avifSrc} type="image/avif" />
      <img
        src={fallbackSrc}
        alt={alt}
        decoding={decoding}
        className={imgClassName}
        sizes={sizes}
        loading={loading}
      />
    </picture>
  );
}
