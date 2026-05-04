import type { HeadPose } from "./types";

export function solveHeadPoseFromMatrix(
  matrixData: number[] | Float32Array,
  mirrored = true,
): HeadPose {
  if (matrixData.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const m00 = matrixData[0] ?? 0;
  const m10 = matrixData[1] ?? 0;
  const m20 = matrixData[2] ?? 0;
  const m21 = matrixData[6] ?? 0;
  const m22 = matrixData[10] ?? 0;

  const yawRad = Math.atan2(-m20, Math.sqrt(m21 * m21 + m22 * m22));
  const pitchRad = Math.atan2(m21, m22);
  const rollRad = Math.atan2(m10, m00);

  const radToDeg = 180 / Math.PI;
  let yaw = yawRad * radToDeg;
  const pitch = pitchRad * radToDeg;
  const roll = rollRad * radToDeg;

  if (mirrored) {
    yaw = -yaw;
  }

  return {
    yaw: Object.is(Math.round(yaw * 10) / 10, -0) ? 0 : Math.round(yaw * 10) / 10,
    pitch: Object.is(Math.round(pitch * 10) / 10, -0) ? 0 : Math.round(pitch * 10) / 10,
    roll: Object.is(Math.round(roll * 10) / 10, -0) ? 0 : Math.round(roll * 10) / 10,
  };
}
