import type { CameraCalibration, CameraMetric } from "../types";

export interface CameraSignals {
  confidence: number;
  headTurn: number;
  eyeLookSideOrUp: number;
  eyeLookDown: number;
}

export interface ScoredCameraSignals {
  attentionScore: number;
  lookingAway: boolean;
}

const minimumCalibrationSamples = 5;

export function scoreCameraSignals(
  signals: CameraSignals,
  calibration?: CameraCalibration,
): ScoredCameraSignals {
  if (!calibration) {
    return {
      attentionScore: clamp(
        signals.confidence *
          (1 - Math.min(0.8, signals.headTurn * 2.2)) *
          (1 - signals.eyeLookSideOrUp * 0.45) *
          (1 - signals.eyeLookDown * 0.12),
        0,
        1,
      ),
      lookingAway: signals.headTurn > 0.2 || signals.eyeLookSideOrUp > 0.72,
    };
  }

  const relativeConfidence = clamp(
    signals.confidence / Math.max(0.35, calibration.confidence * 0.85),
    0,
    1,
  );
  const headTurn = Math.max(0, signals.headTurn - calibration.headTurn - 0.03);
  const sideOrUp = Math.max(
    0,
    signals.eyeLookSideOrUp - calibration.eyeLookSideOrUp - 0.08,
  );
  const lookDown = Math.max(0, signals.eyeLookDown - calibration.eyeLookDown - 0.12);

  return {
    attentionScore: clamp(
      relativeConfidence *
        (1 - Math.min(0.8, headTurn * 2.2)) *
        (1 - sideOrUp * 0.45) *
        (1 - lookDown * 0.12),
      0,
      1,
    ),
    lookingAway:
      signals.headTurn > Math.max(0.2, calibration.headTurn + 0.12) ||
      signals.eyeLookSideOrUp >
        Math.max(0.72, calibration.eyeLookSideOrUp + 0.2),
  };
}

export function buildCameraCalibration(
  metrics: CameraMetric[],
  calibratedAt = new Date(),
): CameraCalibration | null {
  const usable = metrics.filter(hasDiagnostics);
  if (usable.length < minimumCalibrationSamples) return null;

  return {
    headTurn: round3(median(usable.map((metric) => metric.head_turn!))),
    eyeLookSideOrUp: round3(median(usable.map((metric) => metric.eye_look_side_or_up!))),
    eyeLookDown: round3(median(usable.map((metric) => metric.eye_look_down!))),
    confidence: round3(median(usable.map((metric) => metric.confidence))),
    calibratedAt: calibratedAt.toISOString(),
  };
}

function hasDiagnostics(metric: CameraMetric): boolean {
  return Boolean(
    metric.present &&
    Number.isFinite(metric.head_turn) &&
    Number.isFinite(metric.eye_look_side_or_up) &&
    Number.isFinite(metric.eye_look_down) &&
    Number.isFinite(metric.confidence),
  );
}

function median(values: number[]): number {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
