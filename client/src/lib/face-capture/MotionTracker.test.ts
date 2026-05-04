import { describe, expect, it } from "vitest";
import { MotionTracker } from "./MotionTracker";

describe("MotionTracker", () => {
  it("reports 0 speed and not stable with a single sample", () => {
    const m = new MotionTracker(300);
    m.push(0, { yaw: 0, pitch: 0, roll: 0 });
    expect(m.angularSpeed()).toBe(0);
    expect(m.isStable()).toBe(false);
  });

  it("computes angular speed across the window", () => {
    const m = new MotionTracker(300);
    m.push(0, { yaw: 0, pitch: 0, roll: 0 });
    m.push(100, { yaw: 30, pitch: 0, roll: 0 });
    expect(Math.round(m.angularSpeed())).toBe(300);
    expect(m.isStable(12)).toBe(false);
  });

  it("reports stable when head barely moves", () => {
    const m = new MotionTracker(300);
    m.push(0, { yaw: -50, pitch: 0, roll: 0 });
    m.push(100, { yaw: -50.5, pitch: 0, roll: 0 });
    m.push(200, { yaw: -50.2, pitch: 0.3, roll: 0 });
    expect(m.isStable(12)).toBe(true);
  });

  it("trims samples older than window", () => {
    const m = new MotionTracker(300);
    m.push(0, { yaw: 0, pitch: 0, roll: 0 });
    m.push(500, { yaw: 60, pitch: 0, roll: 0 });
    m.push(550, { yaw: 60, pitch: 0, roll: 0 });
    expect(Math.round(m.angularSpeed())).toBe(0);
    expect(m.isStable(12)).toBe(true);
  });
});
