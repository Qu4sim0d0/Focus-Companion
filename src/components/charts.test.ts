import { describe, expect, it } from "vitest";
import { dailyBreakdownOption, dailyTimelineOption, weeklyTrendOption } from "./charts";
import { activityScoreForState, summarizeTimeline } from "../core/focus";
import type { MinuteFocusRecord } from "../types";

describe("daily timeline chart", () => {
  it("renders one colored bar per minute for the latest three hours", () => {
    const timeline: MinuteFocusRecord[] = [
      record("2026-06-14T08:59:00.000", "focused"),
      record("2026-06-14T09:00:00.000", "focused"),
      record("2026-06-14T09:01:00.000", "distracted"),
      record("2026-06-14T09:02:00.000", "away"),
    ];
    const option = dailyTimelineOption(
      summarizeTimeline("2026-06-14", timeline),
      "zh",
      new Date("2026-06-14T12:00:00"),
    );
    const series = Array.isArray(option.series) ? option.series[0] : undefined;
    const data = series && "data" in series && Array.isArray(series.data)
      ? series.data
      : [];

    expect(option.dataZoom).toBeUndefined();
    expect(option.xAxis).toEqual(expect.objectContaining({
      type: "time",
      min: new Date("2026-06-14T09:00:00").getTime(),
      max: new Date("2026-06-14T12:00:00").getTime(),
    }));
    expect(series).toEqual(expect.objectContaining({ type: "bar" }));
    expect(data).toHaveLength(3);
    expect(data.map((item) => item.value[1])).toEqual([100, 60, 20]);
    expect(new Set(data.map((item) => item.itemStyle.color)).size).toBe(3);
  });

  it("clamps the three-hour window to the start of the day", () => {
    const option = dailyTimelineOption(
      summarizeTimeline("2026-06-14", [
        record("2026-06-14T00:15:00.000", "focused"),
      ]),
      "zh",
      new Date("2026-06-14T01:30:00"),
    );

    expect(option.xAxis).toEqual(expect.objectContaining({
      min: new Date("2026-06-14T00:00:00.000").getTime(),
      max: new Date("2026-06-14T01:30:00").getTime(),
    }));
  });
});

describe("empty chart states", () => {
  it("does not render an equal-slice pie for a zero-minute day", () => {
    const option = dailyBreakdownOption(summarizeTimeline("2026-06-14", []), "zh");
    expect(option.series).toEqual([]);
    expect(option.title).toEqual(expect.objectContaining({ text: "暂无有效记录" }));
  });

  it("shows an empty weekly state when all days have no observations", () => {
    const emptyDay = summarizeTimeline("2026-06-14", []);
    const option = weeklyTrendOption({
      weekLabel: "2026-06-08 - 2026-06-14",
      days: [emptyDay],
    }, "en");
    expect(option.series).toEqual([]);
    expect(option.title).toEqual(expect.objectContaining({ text: "No valid records yet" }));
  });
});

function record(
  minuteStart: string,
  state: MinuteFocusRecord["state"],
): MinuteFocusRecord {
  return {
    minuteStart,
    app: state === "away" ? "" : "Code",
    title: "",
    state,
    activityScore: activityScoreForState(state),
    inputActive: state === "focused",
  };
}
