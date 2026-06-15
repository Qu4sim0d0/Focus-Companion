import { describe, expect, it } from "vitest";
import { aggregateDailyFocus, defaultSettings } from "./focus";
import { buildSimulatedFocusInputs } from "./simulation";

describe("focus simulation", () => {
  it("creates a changing 45-minute run with focus, distraction, and away phases", () => {
    const inputs = buildSimulatedFocusInputs(new Date("2026-06-14T23:30:00+08:00"), 45);
    const summary = aggregateDailyFocus(
      inputs.date,
      inputs.windowEvents,
      inputs.cameraEvents,
      defaultSettings,
      inputs.sessionEvents,
    );
    const measuredScores = inputs.cameraEvents
      .filter((event) => event.data.present)
      .map((event) => event.data.attention_score);

    expect(summary.totalMinutes).toBe(45);
    expect(summary.focusedMinutes).toBeGreaterThan(0);
    expect(summary.distractedMinutes).toBeGreaterThan(0);
    expect(summary.awayMinutes).toBeGreaterThan(0);
    expect(new Set(measuredScores).size).toBeGreaterThan(10);
  });

  it("keeps an after-midnight simulation inside the current local day", () => {
    const inputs = buildSimulatedFocusInputs(new Date("2026-06-15T00:13:00+08:00"), 45);
    const timestamps = inputs.cameraEvents.map((event) => new Date(event.timestamp));
    const summary = aggregateDailyFocus(
      inputs.date,
      inputs.windowEvents,
      inputs.cameraEvents,
      defaultSettings,
      inputs.sessionEvents,
    );

    expect(summary.totalMinutes).toBe(14);
    expect(timestamps.every((timestamp) => timestamp.getDate() === 15)).toBe(true);
    expect(summary.focusedMinutes).toBeGreaterThan(0);
    expect(summary.distractedMinutes).toBeGreaterThan(0);
    expect(summary.awayMinutes).toBeGreaterThan(0);
  });
});
