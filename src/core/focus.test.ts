import { describe, expect, it } from "vitest";
import {
  activityScoreForState,
  aggregateDailyFocus,
  classifyMinute,
  defaultSettings,
  explainWindowScore,
  inputIdleThresholdSeconds,
  scoreWindow,
  summarizeTimeline,
} from "./focus";
import type {
  ActivityWatchEvent,
  FocusSessionData,
  InputMetric,
  MinuteFocusRecord,
  WindowEventData,
} from "../types";

describe("focus aggregation", () => {
  it("keeps 59 seconds without input focused", () => {
    expect(classifyMinute(
      windowEvent("Code", "focus.ts"),
      { idleSeconds: inputIdleThresholdSeconds - 1, active: true },
      defaultSettings,
    )).toBe("focused");
  });

  it("marks 60 seconds without input distracted", () => {
    expect(classifyMinute(
      windowEvent("Code", "focus.ts"),
      { idleSeconds: inputIdleThresholdSeconds, active: false },
      defaultSettings,
    )).toBe("distracted");
  });

  it("restores focus after new input", () => {
    expect(classifyMinute(
      windowEvent("Code", "focus.ts"),
      { idleSeconds: 0, active: true },
      defaultSettings,
    )).toBe("focused");
  });

  it("keeps distracting windows distracted even with recent input", () => {
    expect(classifyMinute(
      windowEvent("Safari", "YouTube - 推荐视频"),
      { idleSeconds: 2, active: true },
      defaultSettings,
    )).toBe("distracted");
  });

  it("uses away only when neither window nor input data exists", () => {
    expect(classifyMinute(undefined, undefined, defaultSettings)).toBe("away");
    expect(classifyMinute(
      undefined,
      { idleSeconds: 4, active: true },
      defaultSettings,
    )).toBe("focused");
  });

  it("assigns distinct chart heights to all states", () => {
    expect(activityScoreForState("focused")).toBe(1);
    expect(activityScoreForState("distracted")).toBe(0.6);
    expect(activityScoreForState("away")).toBe(0.2);
  });

  it("classifies different Safari windows independently", () => {
    const settings = {
      ...defaultSettings,
      allowedApps: ["Safari"],
      distractingApps: [],
      allowedWindowTitles: ["在线课程"],
      distractingWindowTitles: ["YouTube"],
      rules: [],
    };
    const course = windowEvent("Safari", "数学在线课程 - 第 4 讲");
    const video = windowEvent("Safari", "YouTube - 推荐视频");

    expect(scoreWindow(course, settings)).toBe("focus");
    expect(scoreWindow(video, settings)).toBe("distract");
    expect(explainWindowScore(video, settings)).toEqual({
      score: "distract",
      source: "distracting-window",
      pattern: "YouTube",
    });
  });

  it("lets an allowed window override a distracting app", () => {
    const settings = {
      ...defaultSettings,
      allowedApps: [],
      distractingApps: ["Safari"],
      allowedWindowTitles: ["学校作业"],
      distractingWindowTitles: [],
      rules: [],
    };

    expect(scoreWindow(windowEvent("Safari", "学校作业平台"), settings)).toBe("focus");
  });

  it("gives distracting window rules priority on conflicts", () => {
    const settings = {
      ...defaultSettings,
      allowedApps: ["Safari"],
      distractingApps: [],
      allowedWindowTitles: ["课程"],
      distractingWindowTitles: ["直播"],
      rules: [],
    };

    expect(scoreWindow(windowEvent("Safari", "课程直播"), settings)).toBe("distract");
  });

  it("aggregates one input sample into one minute", () => {
    const date = "2026-06-14";
    const summary = aggregateDailyFocus(
      date,
      [{
        timestamp: `${date}T09:00:00.000`,
        duration: 60,
        data: { app: "Code", title: "focus.ts" },
      }],
      [inputEvent(`${date}T09:00:05.000`, 2, 55)],
      defaultSettings,
    );

    expect(summary.totalMinutes).toBe(1);
    expect(summary.focusedMinutes).toBe(1);
    expect(summary.timeline[0]).toEqual(expect.objectContaining({
      activityScore: 1,
      inputActive: true,
    }));
  });

  it("limits totals to active focus-session events", () => {
    const date = "2026-06-14";
    const sessions: ActivityWatchEvent<FocusSessionData>[] = [{
      timestamp: `${date}T09:10:00.000`,
      duration: 120,
      data: { running: true },
    }];
    const summary = aggregateDailyFocus(
      date,
      [{
        timestamp: `${date}T09:00:00.000`,
        duration: 60 * 60,
        data: { app: "Code", title: "focus.ts" },
      }],
      [inputEvent(`${date}T09:10:00.000`, 1, 120)],
      defaultSettings,
      sessions,
    );

    expect(summary.totalMinutes).toBe(2);
    expect(summary.focusedMinutes).toBe(2);
  });

  it("summarizes longest focus run", () => {
    const timeline: MinuteFocusRecord[] = [
      "focused",
      "focused",
      "distracted",
      "focused",
    ].map((state, index) => ({
      minuteStart: `2026-06-14T09:0${index}:00.000Z`,
      app: "Code",
      title: "",
      state: state as MinuteFocusRecord["state"],
      activityScore: activityScoreForState(state as MinuteFocusRecord["state"]),
      inputActive: true,
    }));

    const summary = summarizeTimeline("2026-06-14", timeline);
    expect(summary.longestFocusRunMinutes).toBe(2);
    expect(summary.focusedMinutes).toBe(3);
  });
});

function windowEvent(
  app: string,
  title: string,
): ActivityWatchEvent<WindowEventData> {
  return {
    timestamp: "2026-06-15T09:00:00.000Z",
    duration: 60,
    data: { app, title },
  };
}

function inputEvent(
  timestamp: string,
  idleSeconds: number,
  duration = 65,
): ActivityWatchEvent<InputMetric> {
  return {
    timestamp,
    duration,
    data: {
      idleSeconds,
      active: idleSeconds < inputIdleThresholdSeconds,
    },
  };
}
