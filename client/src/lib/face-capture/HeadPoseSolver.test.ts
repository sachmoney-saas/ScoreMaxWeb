import { describe, expect, it } from "vitest";
import { solveHeadPoseFromMatrix } from "./HeadPoseSolver";

describe("solveHeadPoseFromMatrix", () => {
  it("returns zero for identity matrix", () => {
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const pose = solveHeadPoseFromMatrix(matrix, false);
    expect(pose).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it("handles right profile with mirrored output", () => {
    const yaw = Math.PI / 2;
    const matrix = [
      Math.cos(yaw),
      0,
      -Math.sin(yaw),
      0,
      0,
      1,
      0,
      0,
      Math.sin(yaw),
      0,
      Math.cos(yaw),
      0,
      0,
      0,
      0,
      1,
    ];
    const pose = solveHeadPoseFromMatrix(matrix, true);
    expect(pose.yaw).toBeLessThan(-80);
  });
});
