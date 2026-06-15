import { formatLocalDate } from "./activitywatch";

const storageKey = "focus-companion.opened-today.v1";
const maxContinuousGapMs = 10_000;

export interface OpenTimerState {
  date: string;
  totalMs: number;
  lastTickAt: number;
  active: boolean;
}

export function loadOpenTimer(nowMs: number, active: boolean): OpenTimerState {
  const date = formatLocalDate(new Date(nowMs));
  return {
    date,
    totalMs: readOpenedTodayMs(date),
    lastTickAt: nowMs,
    active,
  };
}

export function advanceOpenTimer(
  current: OpenTimerState,
  nowMs: number,
  active: boolean,
): OpenTimerState {
  const date = formatLocalDate(new Date(nowMs));
  if (date !== current.date) {
    return { date, totalMs: 0, lastTickAt: nowMs, active };
  }

  const elapsed = Math.max(0, nowMs - current.lastTickAt);
  const counted = current.active && elapsed <= maxContinuousGapMs ? elapsed : 0;
  return {
    ...current,
    totalMs: current.totalMs + counted,
    lastTickAt: nowMs,
    active,
  };
}

export function persistOpenTimer(state: OpenTimerState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify({
    date: state.date,
    totalMs: state.totalMs,
  }));
}

export function resetOpenTimer(nowMs: number, active: boolean): OpenTimerState {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  return {
    date: formatLocalDate(new Date(nowMs)),
    totalMs: 0,
    lastTickAt: nowMs,
    active,
  };
}

function readOpenedTodayMs(date: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as {
      date?: string;
      totalMs?: number;
    };
    return stored.date === date && Number.isFinite(stored.totalMs)
      ? Math.max(0, stored.totalMs ?? 0)
      : 0;
  } catch {
    return 0;
  }
}
