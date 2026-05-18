import { describe, expect, it } from "vitest";
import { pickBestImageUrl } from "./avif-support";

describe("pickBestImageUrl", () => {
  it("returns the AVIF URL when supported and present", () => {
    expect(
      pickBestImageUrl({ avif: "a.avif", fallback: "a.jpg" }, true),
    ).toBe("a.avif");
  });

  it("falls back to JPEG when AVIF is missing even if supported", () => {
    expect(pickBestImageUrl({ avif: null, fallback: "a.jpg" }, true)).toBe(
      "a.jpg",
    );
    expect(
      pickBestImageUrl({ avif: undefined, fallback: "a.jpg" }, true),
    ).toBe("a.jpg");
  });

  it("never returns AVIF when support is unknown (probe still pending)", () => {
    expect(
      pickBestImageUrl({ avif: "a.avif", fallback: "a.jpg" }, null),
    ).toBe("a.jpg");
  });

  it("always falls back when AVIF is explicitly unsupported", () => {
    expect(
      pickBestImageUrl({ avif: "a.avif", fallback: "a.jpg" }, false),
    ).toBe("a.jpg");
  });

  it("returns null when neither variant is available", () => {
    expect(pickBestImageUrl({ avif: null, fallback: null }, true)).toBeNull();
    expect(pickBestImageUrl({ avif: null, fallback: null }, false)).toBeNull();
  });
});
