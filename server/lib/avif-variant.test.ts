import { describe, expect, it } from "vitest";
import {
  acceptsAvif,
  avifKeyFor,
  isAvifSourceContentTypeSupported,
} from "./avif-variant-helpers";

describe("avifKeyFor", () => {
  it("appends `.avif` to preserve the source prefix (cleanup-friendly)", () => {
    expect(avifKeyFor("oneshot/u/abc.jpg")).toBe("oneshot/u/abc.jpg.avif");
    expect(avifKeyFor("scan-assets/u/s/face-front.png")).toBe(
      "scan-assets/u/s/face-front.png.avif",
    );
  });

  it("does not double-suffix when called twice (idempotent at the call site)", () => {
    const once = avifKeyFor("k.jpg");
    expect(avifKeyFor(once)).toBe("k.jpg.avif.avif");
  });
});

describe("isAvifSourceContentTypeSupported", () => {
  it("accepts JPEG / PNG / WEBP and unknown (lets libvips decide)", () => {
    expect(isAvifSourceContentTypeSupported("image/jpeg")).toBe(true);
    expect(isAvifSourceContentTypeSupported("image/png")).toBe(true);
    expect(isAvifSourceContentTypeSupported("image/webp")).toBe(true);
    expect(isAvifSourceContentTypeSupported(null)).toBe(true);
    expect(isAvifSourceContentTypeSupported(undefined)).toBe(true);
  });

  it("rejects vector / animated formats we don't want to transcode", () => {
    expect(isAvifSourceContentTypeSupported("image/svg+xml")).toBe(false);
    expect(isAvifSourceContentTypeSupported("image/gif")).toBe(false);
    expect(isAvifSourceContentTypeSupported("application/pdf")).toBe(false);
  });
});

describe("acceptsAvif", () => {
  it("recognises a Chrome-like Accept header advertising AVIF explicitly", () => {
    expect(
      acceptsAvif("image/avif,image/webp,image/apng,image/*,*/*;q=0.8"),
    ).toBe(true);
  });

  it("treats `image/*` and `*\\/*` as positive (browser will pick via picture)", () => {
    expect(acceptsAvif("image/*")).toBe(true);
    expect(acceptsAvif("*/*")).toBe(true);
  });

  it("returns false for missing or text-only Accept headers", () => {
    expect(acceptsAvif(null)).toBe(false);
    expect(acceptsAvif(undefined)).toBe(false);
    expect(acceptsAvif("text/html")).toBe(false);
    expect(acceptsAvif("application/json")).toBe(false);
  });
});
