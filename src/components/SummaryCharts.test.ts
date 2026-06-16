import { describe, expect, it } from "vitest";
import { summarizeTimeline } from "../core/focus";
import { buildDonutSegments, buildWeeklyChartModel } from "./SummaryCharts";

describe("native summary charts", () => {
  it("builds proportional donut segments", () => {
    const summary = {
      ...summarizeTimeline("2026-06-15", []),
      totalMinutes: 10,
      focusedMinutes: 6,
      distractedMinutes: 4,
      awayMinutes: 0,
    };
    const segments = buildDonutSegments(summary);

    expect(segments.map((segment) => segment.ratio)).toEqual([0.6, 0.4]);
    expect(segments[1].offset + segments[1].length).toBeCloseTo(
      segments[1].circumference,
    );
  });

  it("marks an all-zero week as empty and scales nonzero data", () => {
    const empty = summarizeTimeline("2026-06-14", []);
    expect(buildWeeklyChartModel({
      weekLabel: "empty",
      days: [empty],
    }).empty).toBe(true);

    const active = {
      ...empty,
      totalMinutes: 12,
      focusedMinutes: 8,
      distractedMinutes: 4,
      awayMinutes: 0,
    };
    const model = buildWeeklyChartModel({
      weekLabel: "active",
      days: [empty, active],
    });

    expect(model.empty).toBe(false);
    expect(model.series[0].points[1].value).toBe(8);
    expect(model.series[0].points[1].y).toBeLessThan(
      model.series[1].points[1].y,
    );
  });
});
