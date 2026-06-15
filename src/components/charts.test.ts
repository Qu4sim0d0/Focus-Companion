import { describe, expect, it } from "vitest";
import { dailyBreakdownOption, dailyTimelineOption, weeklyTrendOption } from "./charts";
import { summarizeTimeline } from "../core/focus";
import type { ActivityWatchEvent, CameraMetric, MinuteFocusRecord } from "../types";

describe("daily timeline chart", () => {
  it("renders a draggable time-based attention line", () => {
    const timeline: MinuteFocusRecord[] = [
      ...records("2026-06-14T09:00:00.000Z", "focused"),
      ...records("2026-06-14T09:05:00.000Z", "distracted"),
      ...records("2026-06-14T09:10:00.000Z", "away"),
    ];
    const option = dailyTimelineOption(
      summarizeTimeline("2026-06-14", timeline),
      "zh",
      new Date("2026-06-14T10:00:00"),
    );

    expect(option.dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "inside" }),
        expect.objectContaining({ type: "slider" }),
      ]),
    );
    expect(option.xAxis).toEqual(expect.objectContaining({ type: "time" }));
    expect(option.yAxis).toEqual(expect.objectContaining({ min: 0, max: 100 }));
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "注意力",
          type: "line",
          data: expect.arrayContaining([expect.arrayContaining([expect.any(Number), 0])]),
        }),
      ]),
    );
    const line = Array.isArray(option.series) ? option.series[0] : undefined;
    const data = line && "data" in line && Array.isArray(line.data) ? line.data : [];
    expect(data).toHaveLength(15);
    expect(new Set(data.map((point) => Array.isArray(point) ? point[0] : undefined)).size).toBe(15);
  });

  it("uses raw camera samples so the live line changes within a minute", () => {
    const timeline = records("2026-06-14T09:00:00.000Z", "focused");
    const cameraEvents: ActivityWatchEvent<CameraMetric>[] = [5, 15, 25, 35].map((second, index) => ({
      timestamp: `2026-06-14T09:00:${String(second).padStart(2, "0")}.000Z`,
      duration: 0,
      data: {
        present: true,
        face_count: 1,
        attention_score: [0.82, 0.67, 0.91, 0.74][index],
        looking_away: false,
        eyes_visible: true,
        confidence: 0.9,
        detector_ready: true,
      },
    }));
    const option = dailyTimelineOption(
      summarizeTimeline("2026-06-14", timeline),
      "zh",
      new Date("2026-06-14T10:00:00Z"),
      cameraEvents,
    );
    const line = Array.isArray(option.series) ? option.series[0] : undefined;
    const data = line && "data" in line && Array.isArray(line.data) ? line.data : [];
    const scores = data.map((point) => Array.isArray(point) ? point[1] : undefined);

    expect(data).toHaveLength(4);
    expect(new Set(scores).size).toBe(4);
  });
});

describe("empty chart states", () => {
  it("does not render an equal-slice pie for a zero-minute day", () => {
    const summary = summarizeTimeline("2026-06-14", []);
    const option = dailyBreakdownOption(summary, "zh");

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

function records(firstMinute: string, state: MinuteFocusRecord["state"]): MinuteFocusRecord[] {
  const start = new Date(firstMinute).getTime();
  return Array.from({ length: 5 }, (_, index) => ({
    minuteStart: new Date(start + index * 60_000).toISOString(),
    app: state === "away" ? "" : "Code",
    title: "",
    state,
    attentionScore: 0,
    present: state !== "away",
  }));
}
