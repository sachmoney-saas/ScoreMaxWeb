import type { Response } from "express";
import { ApiError } from "./errors";
import {
  avifKeyFor,
  encodeAvifFromBuffer,
  ensureAvifVariantInBackground,
  isAvifSourceContentTypeSupported,
} from "./avif-variant";
import { logger } from "./logger";
import {
  downloadR2Object,
  getDefaultR2Bucket,
  r2ObjectExists,
  uploadR2Object,
} from "./r2-storage";

export type R2ImageAsset = {
  bucket: string | null | undefined;
  key: string;
  mimeType: string;
};

/**
 * Streams a private R2 image through an authenticated API endpoint with explicit
 * AVIF negotiation via `?fmt=avif`.
 */
export async function serveR2ImageAssetWithAvifNegotiation(params: {
  res: Response;
  asset: R2ImageAsset;
  fmt: "avif" | undefined;
  notFoundMessage: string;
  cacheControl?: string;
}): Promise<void> {
  const {
    res,
    asset,
    fmt,
    notFoundMessage,
    cacheControl = "private, max-age=120",
  } = params;
  const bucket = asset.bucket || getDefaultR2Bucket();

  if (fmt === "avif") {
    if (!isAvifSourceContentTypeSupported(asset.mimeType)) {
      throw new ApiError({
        code: "IMAGE_NOT_FOUND",
        status: 404,
        message: notFoundMessage,
      });
    }

    const avifKey = avifKeyFor(asset.key);

    if (await r2ObjectExists({ bucket, key: avifKey })) {
      const cached = await downloadR2Object({ bucket, key: avifKey });
      const buffer = Buffer.from(await cached.arrayBuffer());
      res.setHeader("Content-Type", "image/avif");
      res.setHeader("Cache-Control", cacheControl);
      res.status(200).send(buffer);
      return;
    }

    const sourceBlob = await downloadR2Object({ bucket, key: asset.key });
    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
    const encoded = await encodeAvifFromBuffer(sourceBuffer);
    if (!encoded) {
      throw new ApiError({
        code: "IMAGE_NOT_FOUND",
        status: 404,
        message: notFoundMessage,
      });
    }

    void uploadR2Object({
      bucket,
      key: avifKey,
      body: encoded,
      contentType: "image/avif",
    }).catch((error) => {
      logger.warn(
        { err: error, bucket, avifKey },
        "Failed to persist AVIF variant after on-demand encode",
      );
    });

    res.setHeader("Content-Type", "image/avif");
    res.setHeader("Cache-Control", cacheControl);
    res.status(200).send(encoded);
    return;
  }

  const sourceBlob = await downloadR2Object({ bucket, key: asset.key });
  const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());

  ensureAvifVariantInBackground({
    bucket,
    sourceKey: asset.key,
    sourceContentType: asset.mimeType,
  });

  res.setHeader("Content-Type", asset.mimeType);
  res.setHeader("Cache-Control", cacheControl);
  res.status(200).send(sourceBuffer);
}
