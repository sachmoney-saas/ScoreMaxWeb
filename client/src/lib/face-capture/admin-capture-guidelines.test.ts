import { describe, expect, it } from "vitest";
import {
  averageCanthalTiltDegreesFromLandmarks,
  canthalTiltDisplayCategoryFromMeanDegrees,
} from "./admin-capture-guidelines";
import {
  FACEMESH_LEFT_EYE_CANTHUS_LATERAL,
  FACEMESH_LEFT_EYE_CANTHUS_MEDIAL,
  FACEMESH_RIGHT_EYE_CANTHUS_LATERAL,
  FACEMESH_RIGHT_EYE_CANTHUS_MEDIAL,
} from "./facemesh-feature-contours";
import type { LandmarkPoint } from "./types";

function p(x: number, y: number): LandmarkPoint {
  return { x, y, z: 0 };
}

function canthalLandmarks(params: {
  rightMedial: LandmarkPoint;
  rightLateral: LandmarkPoint;
  leftMedial: LandmarkPoint;
  leftLateral: LandmarkPoint;
}): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = [];
  landmarks[FACEMESH_RIGHT_EYE_CANTHUS_MEDIAL] = params.rightMedial;
  landmarks[FACEMESH_RIGHT_EYE_CANTHUS_LATERAL] = params.rightLateral;
  landmarks[FACEMESH_LEFT_EYE_CANTHUS_MEDIAL] = params.leftMedial;
  landmarks[FACEMESH_LEFT_EYE_CANTHUS_LATERAL] = params.leftLateral;
  return landmarks;
}

describe("canthal tilt display helpers", () => {
  it("returns a positive signed tilt when both lateral canthi are higher", () => {
    const tilt = averageCanthalTiltDegreesFromLandmarks(
      canthalLandmarks({
        rightMedial: p(0.55, 0.5),
        rightLateral: p(0.35, 0.49),
        leftMedial: p(0.45, 0.5),
        leftLateral: p(0.65, 0.49),
      }),
      { width: 1000, height: 1000 },
    );

    expect(tilt).toBeCloseTo(2.862, 3);
    expect(canthalTiltDisplayCategoryFromMeanDegrees(tilt!)).toBe("positive");
  });

  it("returns a negative signed tilt when both lateral canthi are lower", () => {
    const tilt = averageCanthalTiltDegreesFromLandmarks(
      canthalLandmarks({
        rightMedial: p(0.55, 0.5),
        rightLateral: p(0.35, 0.51),
        leftMedial: p(0.45, 0.5),
        leftLateral: p(0.65, 0.51),
      }),
      { width: 1000, height: 1000 },
    );

    expect(tilt).toBeCloseTo(-2.862, 3);
    expect(canthalTiltDisplayCategoryFromMeanDegrees(tilt!)).toBe("negative");
  });

  it("keeps near-horizontal eye corners neutral", () => {
    expect(canthalTiltDisplayCategoryFromMeanDegrees(0.4)).toBe("neutral");
    expect(canthalTiltDisplayCategoryFromMeanDegrees(-0.4)).toBe("neutral");
  });
});
