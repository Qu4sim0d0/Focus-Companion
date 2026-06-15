import { formatLocalDate } from "./activitywatch";
import type {
  ActivityWatchEvent,
  CameraMetric,
  FocusInputEvents,
  FocusSessionData,
  WindowEventData,
} from "../types";

const minuteMs = 60_000;

export function buildSimulatedFocusInputs(
  now = new Date(),
  durationMinutes = 45,
): FocusInputEvents {
  const end = new Date(now);
  end.setSeconds(0, 0);
  const dayStart = new Date(end);
  dayStart.setHours(0, 0, 0, 0);
  const availableMinutes = Math.floor((end.getTime() - dayStart.getTime()) / minuteMs) + 1;
  const effectiveDurationMinutes = Math.max(1, Math.min(durationMinutes, availableMinutes));
  const start = new Date(end.getTime() - (effectiveDurationMinutes - 1) * minuteMs);
  const windowEvents: ActivityWatchEvent<WindowEventData>[] = [];
  const cameraEvents: ActivityWatchEvent<CameraMetric>[] = [];

  for (let minute = 0; minute < effectiveDurationMinutes; minute += 1) {
    const minuteStart = new Date(start.getTime() + minute * minuteMs);
    const phase = simulationPhase(minute, effectiveDurationMinutes);
    windowEvents.push({
      timestamp: minuteStart.toISOString(),
      duration: 60,
      data: phase.window,
    });

    for (let second = 5; second < 60; second += 10) {
      const timestamp = new Date(minuteStart.getTime() + second * 1000);
      cameraEvents.push({
        timestamp: timestamp.toISOString(),
        duration: 0,
        data: phase.metric(minute, second),
      });
    }
  }

  const sessionEvents: ActivityWatchEvent<FocusSessionData>[] = [
    {
      timestamp: start.toISOString(),
      duration: effectiveDurationMinutes * 60,
      data: { running: true },
    },
  ];

  return {
    date: formatLocalDate(end),
    windowEvents,
    cameraEvents,
    sessionEvents,
  };
}

function simulationPhase(
  minute: number,
  durationMinutes: number,
): {
  window: WindowEventData;
  metric: (minuteIndex: number, second: number) => CameraMetric;
} {
  const progress = minute / Math.max(1, durationMinutes);
  if (progress < 0.32) {
    return {
      window: { app: "Code", title: "Focus Companion - implementation" },
      metric: (minuteIndex, second) =>
        presentMetric(waveScore(0.84, 0.08, minuteIndex, second), false),
    };
  }
  if (progress < 0.53) {
    return {
      window: { app: "Safari", title: "YouTube - recommended" },
      metric: (minuteIndex, second) =>
        presentMetric(waveScore(0.42, 0.12, minuteIndex, second), true),
    };
  }
  if (progress < 0.66) {
    return {
      window: { app: "", title: "" },
      metric: () => ({
        present: false,
        face_count: 0,
        attention_score: 0,
        looking_away: false,
        eyes_visible: false,
        confidence: 0,
        detector_ready: true,
      }),
    };
  }
  return {
    window: { app: "Terminal", title: "npm test" },
    metric: (minuteIndex, second) =>
      presentMetric(waveScore(0.76, 0.14, minuteIndex, second), false),
  };
}

function presentMetric(attentionScore: number, lookingAway: boolean): CameraMetric {
  return {
    present: true,
    face_count: 1,
    attention_score: attentionScore,
    looking_away: lookingAway,
    eyes_visible: true,
    confidence: 0.92,
    detector_ready: true,
  };
}

function waveScore(base: number, amplitude: number, minute: number, second: number): number {
  const wave = Math.sin(minute * 0.8 + second * 0.13) * amplitude;
  return Math.round(clamp(base + wave, 0.05, 0.98) * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
