import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceFocusSessionClock,
  endFocusSessionClock,
  loadFocusSessionClock,
  pauseFocusSessionClock,
  persistFocusSessionClock,
  resumeFocusSessionClock,
  startFocusSessionClock,
} from "./focusSession";

describe("focus session clock", () => {
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => backing.set(key, value),
      },
    });
  });

  it("starts, pauses, resumes, and ends without counting paused time", () => {
    const startAt = new Date(2026, 5, 15, 9).getTime();
    const idle = loadFocusSessionClock(startAt);
    const running = startFocusSessionClock(idle, startAt);
    const paused = pauseFocusSessionClock(running, startAt + 30_000);
    const resumed = resumeFocusSessionClock(paused, startAt + 90_000);
    const ended = endFocusSessionClock(resumed, startAt + 120_000);

    expect(paused.elapsedMs).toBe(30_000);
    expect(resumed.elapsedMs).toBe(30_000);
    expect(ended.elapsedMs).toBe(60_000);
    expect(ended.status).toBe("idle");
  });

  it("does not count a sleep-sized gap", () => {
    const startAt = new Date(2026, 5, 15, 9).getTime();
    const running = startFocusSessionClock(loadFocusSessionClock(startAt), startAt);
    const advanced = advanceFocusSessionClock(running, startAt + 10 * 60_000);

    expect(advanced.elapsedMs).toBe(0);
  });

  it("restores a stale running session as paused", () => {
    const startAt = new Date(2026, 5, 15, 9).getTime();
    persistFocusSessionClock({
      date: "2026-06-15",
      status: "running",
      elapsedMs: 45_000,
      lastTickAt: startAt,
    });

    const restored = loadFocusSessionClock(startAt + 5 * 60_000);
    expect(restored.status).toBe("paused");
    expect(restored.elapsedMs).toBe(45_000);
  });

  it("resets on the next local date", () => {
    const current = {
      date: "2026-06-15",
      status: "running" as const,
      elapsedMs: 60_000,
      lastTickAt: new Date(2026, 5, 15, 23, 59, 59).getTime(),
    };
    const next = advanceFocusSessionClock(
      current,
      new Date(2026, 5, 16, 0, 0, 1).getTime(),
    );

    expect(next.status).toBe("idle");
    expect(next.elapsedMs).toBe(0);
  });
});
