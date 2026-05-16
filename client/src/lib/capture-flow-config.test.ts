import { describe, expect, it } from "vitest";
import {
  REQUIRED_ONBOARDING_SCAN_ASSET_CODES,
  SCANFACE_CANONICAL_IMAGE_SLOTS,
} from "../../../shared/schema";
import { CAPTURE_POSES } from "./face-capture/types";

describe("capture flow configuration", () => {
  it("ends capture on the eye close-up pose", () => {
    expect(CAPTURE_POSES.map((p) => p.id)).not.toContain("closeup-hairline");
    expect(CAPTURE_POSES.at(-1)?.id).toBe("closeup-eye");
  });

  it("does not require the legacy hair-back asset", () => {
    expect(REQUIRED_ONBOARDING_SCAN_ASSET_CODES).not.toContain("HAIR_BACK");
    expect(SCANFACE_CANONICAL_IMAGE_SLOTS).not.toContain("hair_back_hand");
    expect(REQUIRED_ONBOARDING_SCAN_ASSET_CODES).toHaveLength(7);
  });
});
