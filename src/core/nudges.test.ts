import { describe, expect, it } from "vitest";
import { evaluateNudge, isFreshTimestamp, isWithinWorkday } from "./nudges";

describe("focus nudges", () => {
  it("supports daytime and overnight work windows", () => {
    expect(isWithinWorkday(new Date(2026, 5, 15, 10), 8, 22)).toBe(true);
    expect(isWithinWorkday(new Date(2026, 5, 15, 23), 8, 22)).toBe(false);
    expect(isWithinWorkday(new Date(2026, 5, 15, 23), 22, 6)).toBe(true);
    expect(isWithinWorkday(new Date(2026, 5, 15, 12), 22, 6)).toBe(false);
  });

  it("rejects stale and implausibly future live records", () => {
    const now = new Date("2026-06-15T10:00:00.000Z").getTime();
    expect(isFreshTimestamp(now, "2026-06-15T09:59:00.000Z")).toBe(true);
    expect(isFreshTimestamp(now, "2026-06-15T09:55:00.000Z")).toBe(false);
    expect(isFreshTimestamp(now, "2026-06-15T10:01:00.000Z")).toBe(false);
  });

  it("waits for the threshold and respects cooldown", () => {
    const initial = { distractedSince: null, lastNudgeAt: null };
    const started = evaluateNudge(0, "distracted", true, true, 60, 300, initial);
    expect(started.shouldNotify).toBe(false);

    const notified = evaluateNudge(60_000, "distracted", true, true, 60, 300, started.tracker);
    expect(notified.shouldNotify).toBe(true);

    const cooling = evaluateNudge(120_000, "distracted", true, true, 60, 300, notified.tracker);
    expect(cooling.shouldNotify).toBe(false);
  });

  it("resets the continuous distraction timer after focus returns", () => {
    const tracker = { distractedSince: 0, lastNudgeAt: null };
    const focused = evaluateNudge(70_000, "focused", true, true, 60, 300, tracker);
    expect(focused.tracker.distractedSince).toBeNull();
  });
});
