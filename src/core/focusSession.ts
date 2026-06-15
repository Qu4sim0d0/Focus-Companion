import { formatLocalDate } from "./activitywatch";

const storageKey = "focus-companion.session-clock.v1";
export type FocusSessionStatus = "idle" | "running" | "paused";

export interface FocusSessionClock {
  date: string;
  status: FocusSessionStatus;
  elapsedMs: number;
  completedMs: number;
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
    return {
      date,
      // Monitoring connections are re-established after reload, so a persisted
      // running session must be explicitly resumed.
      status: stored.status === "running" ? "paused" : stored.status,
      elapsedMs: Math.max(0, stored.elapsedMs!),
      completedMs: Math.max(0, Number.isFinite(stored.completedMs) ? stored.completedMs! : 0),
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
      current.status === "running"
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
    completedMs: current.date === formatLocalDate(new Date(nowMs))
      ? current.completedMs
      : 0,
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
  if (current.status === "idle") return advanceFocusSessionClock(current, nowMs);
  const ended = advanceFocusSessionClock(current, nowMs);
  return {
    ...ended,
    status: "idle",
    completedMs: ended.completedMs + ended.elapsedMs,
  };
}

export function resetFocusSessionClock(nowMs: number): FocusSessionClock {
  return idleClock(formatLocalDate(new Date(nowMs)), nowMs);
}

export function focusSessionTotalMs(clock: FocusSessionClock): number {
  return clock.completedMs + (clock.status === "idle" ? 0 : clock.elapsedMs);
}

export function focusSessionElapsedMsAt(
  clock: FocusSessionClock,
  nowMs: number,
): number {
  return advanceFocusSessionClock(clock, nowMs).elapsedMs;
}

export function focusSessionTotalMsAt(
  clock: FocusSessionClock,
  nowMs: number,
): number {
  return focusSessionTotalMs(advanceFocusSessionClock(clock, nowMs));
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
  return { date, status: "idle", elapsedMs: 0, completedMs: 0, lastTickAt: nowMs };
}

function isStatus(value: unknown): value is FocusSessionStatus {
  return value === "idle" || value === "running" || value === "paused";
}
