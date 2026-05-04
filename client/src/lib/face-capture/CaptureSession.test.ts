import { describe, expect, it } from "vitest";
import { CaptureSession } from "./CaptureSession";

describe("CaptureSession", () => {
  it("starts in idle state", () => {
    const session = new CaptureSession();
    expect(session.getState()).toBe("idle");
  });

  it("resets hold progress when no face is detected", () => {
    const session = new CaptureSession();
    const internal = session as any;
    internal.state = "Aligning";
    internal.videoEl = { videoWidth: 1280, videoHeight: 720, clientWidth: 640, clientHeight: 480 };
    internal.currentPoseIndex = 0;
    internal.poseStates = [
      {
        poseId: "frontal",
        index: 0,
        state: "holding",
        validation: { poseId: "frontal", status: "ready", score: 1, reasons: [], confidence: 1 },
      },
    ];
    internal.holdStartAt = performance.now() - 500;
    internal.holdProgress = 0.9;
    internal.onLandmarks([], { yaw: 0, pitch: 0, roll: 0 }, {});
    expect(session.getHoldProgress()).toBe(0);
    expect(session.getState()).toBe("AwaitFace");
  });
});
