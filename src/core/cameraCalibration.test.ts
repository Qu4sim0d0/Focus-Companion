import { describe, expect, it } from "vitest";
import type { CameraMetric } from "../types";
import {
  buildCameraCalibration,
  scoreCameraSignals,
  type CameraSignals,
} from "./cameraCalibration";

describe("camera posture calibration", () => {
  it("keeps the original scoring behavior when no calibration exists", () => {
    const signals: CameraSignals = {
      confidence: 0.8,
      headTurn: 0.1,
      eyeLookSideOrUp: 0.2,
      eyeLookDown: 0.4,
    };
    const expected =
      0.8 *
      (1 - Math.min(0.8, 0.1 * 2.2)) *
      (1 - 0.2 * 0.45) *
      (1 - 0.4 * 0.12);

    expect(scoreCameraSignals(signals).attentionScore).toBeCloseTo(expected);
  });

  it("treats a calibrated downward writing posture as a personal baseline", () => {
    const signals: CameraSignals = {
      confidence: 0.55,
      headTurn: 0.12,
      eyeLookSideOrUp: 0.1,
      eyeLookDown: 0.78,
    };
    const uncalibrated = scoreCameraSignals(signals);
    const calibrated = scoreCameraSignals(signals, {
      headTurn: 0.11,
      eyeLookSideOrUp: 0.09,
      eyeLookDown: 0.75,
      confidence: 0.56,
      calibratedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(uncalibrated.attentionScore).toBeLessThan(0.5);
    expect(calibrated.attentionScore).toBeGreaterThan(0.85);
    expect(calibrated.lookingAway).toBe(false);
  });

  it("still detects a clear head turn after calibration", () => {
    const scored = scoreCameraSignals({
      confidence: 0.75,
      headTurn: 0.42,
      eyeLookSideOrUp: 0.2,
      eyeLookDown: 0.4,
    }, {
      headTurn: 0.08,
      eyeLookSideOrUp: 0.12,
      eyeLookDown: 0.35,
      confidence: 0.78,
      calibratedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(scored.lookingAway).toBe(true);
    expect(scored.attentionScore).toBeLessThan(0.5);
  });

  it("uses medians so one bad sample does not distort the baseline", () => {
    const metrics = [
      metric(0.08, 0.1, 0.6, 0.75),
      metric(0.09, 0.11, 0.62, 0.76),
      metric(0.1, 0.12, 0.61, 0.74),
      metric(0.09, 0.1, 0.63, 0.75),
      metric(0.95, 0.95, 0.02, 0.1),
    ];
    const calibration = buildCameraCalibration(
      metrics,
      new Date("2026-06-15T00:00:00.000Z"),
    );

    expect(calibration).toEqual({
      headTurn: 0.09,
      eyeLookSideOrUp: 0.11,
      eyeLookDown: 0.61,
      confidence: 0.75,
      calibratedAt: "2026-06-15T00:00:00.000Z",
    });
  });

  it("requires enough valid face samples", () => {
    expect(buildCameraCalibration([
      metric(0.1, 0.1, 0.4, 0.8),
      metric(0.1, 0.1, 0.4, 0.8),
      metric(0.1, 0.1, 0.4, 0.8),
      metric(0.1, 0.1, 0.4, 0.8),
    ])).toBeNull();
  });
});

function metric(
  headTurn: number,
  eyeLookSideOrUp: number,
  eyeLookDown: number,
  confidence: number,
): CameraMetric {
  return {
    present: true,
    face_count: 1,
    attention_score: 0.8,
    looking_away: false,
    eyes_visible: true,
    confidence,
    detector_ready: true,
    head_turn: headTurn,
    eye_look_side_or_up: eyeLookSideOrUp,
    eye_look_down: eyeLookDown,
  };
}
