import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceOpenTimer, loadOpenTimer, persistOpenTimer, resetOpenTimer } from "./openTimer";

describe("open timer", () => {
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => backing.set(key, value),
        removeItem: (key: string) => backing.delete(key),
      },
    });
  });

  it("counts short active intervals and pauses while hidden", () => {
    const started = loadOpenTimer(new Date(2026, 5, 15, 9).getTime(), true);
    const active = advanceOpenTimer(started, started.lastTickAt + 1_000, false);
    const hidden = advanceOpenTimer(active, active.lastTickAt + 60_000, true);

    expect(active.totalMs).toBe(1_000);
    expect(hidden.totalMs).toBe(1_000);
  });

  it("does not count a long sleep gap", () => {
    const started = loadOpenTimer(new Date(2026, 5, 15, 9).getTime(), true);
    const resumed = advanceOpenTimer(started, started.lastTickAt + 60 * 60 * 1000, true);
    expect(resumed.totalMs).toBe(0);
  });

  it("resets at the local calendar day and persists totals", () => {
    const started = loadOpenTimer(new Date(2026, 5, 15, 23, 59, 59).getTime(), true);
    const nextDay = advanceOpenTimer(started, new Date(2026, 5, 16, 0, 0, 1).getTime(), true);
    persistOpenTimer({ ...nextDay, totalMs: 2_000 });
    expect(loadOpenTimer(nextDay.lastTickAt, true).totalMs).toBe(2_000);
  });

  it("clears the persisted total when reset manually", () => {
    const now = new Date(2026, 5, 15, 9).getTime();
    persistOpenTimer({ date: "2026-06-15", totalMs: 20_000, lastTickAt: now, active: true });
    const reset = resetOpenTimer(now, true);

    expect(reset.totalMs).toBe(0);
    expect(loadOpenTimer(now, true).totalMs).toBe(0);
  });
});
