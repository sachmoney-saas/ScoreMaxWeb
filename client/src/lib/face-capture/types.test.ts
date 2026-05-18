import { describe, expect, it } from "vitest";
import {
  CAPTURE_POSES,
  MOBILE_CLOSER_FACE_RATIO_MULTIPLIER,
  prefersRelaxedPcWebcamCaptureFraming,
  resolveCapturePoseDefinitionsForRuntime,
} from "./types";

describe("resolveCapturePoseDefinitionsForRuntime", () => {
  it("doubles frontal min/max face ratio on mobile (non-desktop pointer)", () => {
    const isDesktop = prefersRelaxedPcWebcamCaptureFraming();
    const resolved = resolveCapturePoseDefinitionsForRuntime();
    const base = CAPTURE_POSES.find((p) => p.id === "frontal")!;
    const frontal = resolved.find((p) => p.id === "frontal")!;

    if (isDesktop) {
      expect(frontal.minFaceRatio).toBeLessThan(base.minFaceRatio);
      expect(frontal.maxFaceRatio).toBe(base.maxFaceRatio);
    } else {
      expect(frontal.minFaceRatio).toBeCloseTo(
        base.minFaceRatio * MOBILE_CLOSER_FACE_RATIO_MULTIPLIER,
        5,
      );
      expect(frontal.maxFaceRatio).toBeCloseTo(
        (base.maxFaceRatio ?? 0) * MOBILE_CLOSER_FACE_RATIO_MULTIPLIER,
        5,
      );
    }
  });
});
