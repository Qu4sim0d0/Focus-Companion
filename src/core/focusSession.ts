import { formatLocalDate } from "./activitywatch";

const storageKey = "focus-companion.session-clock.v1";
const maximumTickGapMs = 90_000;

export type FocusSessionStatus = "idle" | "running" | "paused";

export interface FocusSessionClock {
  date: string;
  status: FocusSessionStatus;
  elapsedMs: number;
  lastTickAt: number;
}

export function loadFocusSessionClock(nowMs: number): FocusSessionClock {
  const date = formatLocalDate(new Date(nowMs));
  if (typeof window === "undefined") return idleClock(date, nowMs);
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as
      Partial<FocusSessionClock>;
    if (
      stored.date !== date ||
      !isStatus(stored.status) ||
      !Number.isFinite(stored.elapsedMs) ||
      !Number.isFinite(stored.lastTickAt)
    ) {
      return idleClock(date, nowMs);
    }
    const staleRunning =
      stored.status === "running" &&
      nowMs - stored.lastTickAt! > maximumTickGapMs;
    return {
      date,
      status: staleRunning ? "paused" : stored.status,
      elapsedMs: Math.max(0, stored.elapsedMs!),
      lastTickAt: nowMs,
    };
  } catch {
    return idleClock(date, nowMs);
  }
}

export function advanceFocusSessionClock(
  current: FocusSessionClock,
  nowMs: number,
): FocusSessionClock {
  const date = formatLocalDate(new Date(nowMs));
  if (date !== current.date) return idleClock(date, nowMs);
  const elapsed = Math.max(0, nowMs - current.lastTickAt);
  return {
    ...current,
    elapsedMs:
      current.status === "running" && elapsed <= maximumTickGapMs
        ? current.elapsedMs + elapsed
        : current.elapsedMs,
    lastTickAt: nowMs,
  };
}

export function startFocusSessionClock(
  current: FocusSessionClock,
  nowMs: number,
): FocusSessionClock {
  return {
    date: formatLocalDate(new Date(nowMs)),
    status: "running",
    elapsedMs: 0,
    lastTickAt: nowMs,
  };
}

export function resumeFocusSessionClock(
  current: FocusSessionClock,
  nowMs: number,
): FocusSessionClock {
  return {
    ...advanceFocusSessionClock(current, nowMs),
    status: "running",
    lastTickAt: nowMs,
  };
}

export function pauseFocusSessionClock(
  current: FocusSessionClock,
  nowMs: number,
): FocusSessionClock {
  return {
    ...advanceFocusSessionClock(current, nowMs),
    status: "paused",
  };
}

export function endFocusSessionClock(
  current: FocusSessionClock,
  nowMs: number,
): FocusSessionClock {
  return {
    ...advanceFocusSessionClock(current, nowMs),
    status: "idle",
  };
}

export function resetFocusSessionClock(nowMs: number): FocusSessionClock {
  return idleClock(formatLocalDate(new Date(nowMs)), nowMs);
}

export function persistFocusSessionClock(clock: FocusSessionClock): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(clock));
  } catch {
    // Session timing remains available in memory when local storage is unavailable.
  }
}

function idleClock(date: string, nowMs: number): FocusSessionClock {
  return { date, status: "idle", elapsedMs: 0, lastTickAt: nowMs };
}

function isStatus(value: unknown): value is FocusSessionStatus {
  return value === "idle" || value === "running" || value === "paused";
}
