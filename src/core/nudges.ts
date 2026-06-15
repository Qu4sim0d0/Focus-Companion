import type { FocusState } from "../types";

export interface NudgeTracker {
  distractedSince: number | null;
  lastNudgeAt: number | null;
}

interface NudgeEvaluation {
  tracker: NudgeTracker;
  shouldNotify: boolean;
  distractedSeconds: number;
}

export function isWithinWorkday(
  date: Date,
  startHour: number,
  endHour: number,
): boolean {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export function isFreshTimestamp(
  nowMs: number,
  timestamp: string,
  maxAgeMs = 2 * 60 * 1000,
): boolean {
  const timestampMs = new Date(timestamp).getTime();
  return Number.isFinite(timestampMs) &&
    timestampMs <= nowMs + 5_000 &&
    nowMs - timestampMs < maxAgeMs;
}

export function evaluateNudge(
  nowMs: number,
  state: FocusState | null,
  enabled: boolean,
  withinWorkday: boolean,
  thresholdSeconds: number,
  cooldownSeconds: number,
  tracker: NudgeTracker,
): NudgeEvaluation {
  if (!enabled || !withinWorkday || state !== "distracted") {
    return {
      tracker: { distractedSince: null, lastNudgeAt: tracker.lastNudgeAt },
      shouldNotify: false,
      distractedSeconds: 0,
    };
  }

  const distractedSince = tracker.distractedSince ?? nowMs;
  const distractedSeconds = Math.max(0, (nowMs - distractedSince) / 1000);
  const cooledDown =
    tracker.lastNudgeAt === null ||
    nowMs - tracker.lastNudgeAt >= cooldownSeconds * 1000;
  const shouldNotify = distractedSeconds >= thresholdSeconds && cooledDown;

  return {
    tracker: {
      distractedSince,
      lastNudgeAt: shouldNotify ? nowMs : tracker.lastNudgeAt,
    },
    shouldNotify,
    distractedSeconds,
  };
}
