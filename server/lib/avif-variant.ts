/**
 * AVIF derivative pipeline.
 *
 * Goal: avoid serving multi-MB JPEG/PNG portraits straight to phones. We keep
 * the original (untouched) on R2 — it's the source of truth for ML workers and
 * re-analysis — and store a *display-only* AVIF variant alongside it. The
 * browser picks AVIF via `<picture>` / `Accept: image/avif`; if the variant
 * does not exist (legacy assets, transient encode failure), callers fall back
 * to the original format and `ensureAvifVariantInBackground` re-tries on the
 * next read.
 *
 * Convention: AVIF key is `<sourceKey>.avif` so we can probe existence with a
 * single `HeadObject`, and the lifecycle / deletion code (`analysis-cleanup`,
 * `account-deletion`) only needs the base key prefix to wipe everything.
 */

import sharp from "sharp";
import {
  avifKeyFor,
  isAvifSourceContentTypeSupported,
} from "./avif-variant-helpers";
import { logger } from "./logger";
import {
  downloadR2Object,
  getDefaultR2Bucket,
  r2ObjectExists,
  uploadR2Object,
} from "./r2-storage";

export { avifKeyFor, isAvifSourceContentTypeSupported };
export { acceptsAvif } from "./avif-variant-helpers";

const AVIF_CONTENT_TYPE = "image/avif" as const;

/**
 * Encoder tuning — calibrated for portrait photography on R2:
 *
 *  - `quality: 50` matches Cloudflare's polish default and gives ≈ −40 %
 *    bandwidth vs. JPEG q85 at perceptually equivalent quality.
 *  - `effort: 4` keeps encode under ~600 ms for a 1080-px portrait on a
 *    cold container (vs. 2–3 s at the default `effort: 4` for libavif).
 *  - `chromaSubsampling: "4:2:0"` is the AVIF default; we set it explicitly
 *    so future libvips bumps don't silently switch us to 4:4:4 (which doubles
 *    file size for negligible perceptual gain on faces).
 *  - `MAX_AVIF_WIDTH_PX`: the display surface is at most ~1080 CSS px;
 *    storing anything wider just wastes bandwidth. 1600 leaves headroom for
 *    @2× tablets without exploding encode cost.
 */
const AVIF_QUALITY = 50;
const AVIF_EFFORT = 4;
const MAX_AVIF_WIDTH_PX = 1600;

/**
 * In-flight generation guard. Many UI paths read the same asset within seconds
 * (sidebar thumbnail + analysis view + worker preview) — without this, every
 * cold cache hit would trigger a parallel encode of the same source.
 */
const inFlightGenerations = new Map<string, Promise<EnsureAvifVariantResult>>();

export type EnsureAvifVariantParams = {
  /** Bucket of the source object — defaults to the configured R2 bucket. */
  bucket?: string;
  /** R2 key of the source JPEG/PNG. The AVIF key is derived from this. */
  sourceKey: string;
  /** Optional MIME hint to short-circuit unsupported formats (svg, gif…). */
  sourceContentType?: string | null;
};

export type EnsureAvifVariantResult = {
  bucket: string;
  /** AVIF key on R2, e.g. `<sourceKey>.avif`. */
  key: string;
  contentType: typeof AVIF_CONTENT_TYPE;
  /**
   * `false` when the variant already existed on R2 (no encode performed),
   * `true` when this call uploaded a freshly encoded variant.
   */
  encoded: boolean;
};

/**
 * Ensure an AVIF derivative exists for `sourceKey` on R2.
 *
 * Idempotent: if `<sourceKey>.avif` is already present, returns immediately
 * without re-encoding. Concurrent callers for the same key share a single
 * in-flight promise. Errors do not throw — the caller decides whether to fall
 * back to the original asset.
 */
export async function ensureAvifVariant(
  params: EnsureAvifVariantParams,
): Promise<EnsureAvifVariantResult | null> {
  const bucket = params.bucket || getDefaultR2Bucket();
  const sourceKey = params.sourceKey;
  const targetKey = avifKeyFor(sourceKey);
  const dedupeKey = `${bucket}::${targetKey}`;

  if (!isAvifSourceContentTypeSupported(params.sourceContentType)) {
    return null;
  }

  const existing = inFlightGenerations.get(dedupeKey);
  if (existing) {
    return existing;
  }

  const work = (async (): Promise<EnsureAvifVariantResult | null> => {
    try {
      const alreadyThere = await r2ObjectExists({ bucket, key: targetKey });
      if (alreadyThere) {
        return {
          bucket,
          key: targetKey,
          contentType: AVIF_CONTENT_TYPE,
          encoded: false,
        };
      }

      const sourceBlob = await downloadR2Object({ bucket, key: sourceKey });
      const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());

      const encoded = await encodeAvifFromBuffer(sourceBuffer);
      if (!encoded) {
        return null;
      }

      await uploadR2Object({
        bucket,
        key: targetKey,
        body: encoded,
        contentType: AVIF_CONTENT_TYPE,
      });

      logger.debug(
        {
          bucket,
          sourceKey,
          targetKey,
          sourceBytes: sourceBuffer.length,
          avifBytes: encoded.length,
        },
        "AVIF variant generated",
      );

      return {
        bucket,
        key: targetKey,
        contentType: AVIF_CONTENT_TYPE,
        encoded: true,
      };
    } catch (error) {
      logger.warn(
        { err: error, bucket, sourceKey, targetKey },
        "Failed to ensure AVIF variant; callers will fall back to original",
      );
      return null;
    }
  })();

  inFlightGenerations.set(dedupeKey, work as Promise<EnsureAvifVariantResult>);
  try {
    return await work;
  } finally {
    inFlightGenerations.delete(dedupeKey);
  }
}

/**
 * Fire-and-forget variant: never blocks the caller, never throws.
 *
 * Useful from request handlers where we want to serve the original right now
 * and have the AVIF ready for the *next* request without paying encode latency
 * on this one.
 */
export function ensureAvifVariantInBackground(
  params: EnsureAvifVariantParams,
): void {
  void ensureAvifVariant(params).catch(() => {
    // ensureAvifVariant already logs — silence the unhandled rejection.
  });
}

/**
 * Encode a JPEG/PNG/WEBP buffer to AVIF (resized for display).
 *
 * Exposed for endpoints that already hold the source bytes in memory and want
 * to avoid a redundant R2 round-trip (`/v1/analyses/:id/thumbnail?fmt=avif`
 * served from a fresh proxy fetch). Returns `null` on encoder failure so
 * callers can decide whether to fall back to the original asset.
 */
export async function encodeAvifFromBuffer(
  input: Buffer,
): Promise<Buffer | null> {
  try {
    const pipeline = sharp(input, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const width = meta.width ?? 0;
    const needsResize = width > MAX_AVIF_WIDTH_PX;

    const result = await (needsResize
      ? pipeline.resize({ width: MAX_AVIF_WIDTH_PX, withoutEnlargement: true })
      : pipeline
    )
      .avif({
        quality: AVIF_QUALITY,
        effort: AVIF_EFFORT,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    return result;
  } catch (error) {
    logger.warn({ err: error }, "sharp failed to encode AVIF variant");
    return null;
  }
}

export const __testing__ = {
  AVIF_CONTENT_TYPE,
  MAX_AVIF_WIDTH_PX,
};
