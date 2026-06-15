import { describe, expect, it } from "vitest";
import {
  aggregateDailyFocus,
  defaultSettings,
  explainWindowScore,
  scoreWindow,
  summarizeTimeline,
} from "./focus";
import type {
  ActivityWatchEvent,
  CameraMetric,
  FocusSessionData,
  MinuteFocusRecord,
  WindowEventData,
} from "../types";

describe("focus aggregation", () => {
  it("never classifies Focus Companion itself as distracting", () => {
    expect(aggregateDailyFocus(
      "2026-06-14",
      [{
        timestamp: "2026-06-14T09:00:00.000",
        duration: 60,
        data: { app: "Focus Companion", title: "Focus Companion" },
      }],
      [],
      defaultSettings,
    ).focusedMinutes).toBe(1);
  });

  it("classifies focused minutes when app rule and attention agree", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 120,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const camera: ActivityWatchEvent<CameraMetric>[] = [
      {
        timestamp: `${date}T09:00:05.000`,
        duration: 0,
        data: {
          present: true,
          face_count: 1,
          attention_score: 0.9,
          looking_away: false,
          eyes_visible: true,
          confidence: 0.9,
        },
      },
    ];

    const summary = aggregateDailyFocus(date, windows, camera, defaultSettings);
    expect(summary.focusedMinutes).toBeGreaterThanOrEqual(1);
    expect(summary.totalMinutes).toBe(2);
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
    const course = event("Safari", "数学在线课程 - 第 4 讲");
    const video = event("Safari", "YouTube - 推荐视频");

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

    expect(scoreWindow(event("Safari", "学校作业平台"), settings)).toBe("focus");
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

    expect(scoreWindow(event("Safari", "课程直播"), settings)).toBe("distract");
  });

  it("keeps app lists app-only when no window rule matches", () => {
    const settings = {
      ...defaultSettings,
      allowedApps: [],
      distractingApps: ["YouTube"],
      allowedWindowTitles: [],
      distractingWindowTitles: [],
      rules: [],
    };

    expect(scoreWindow(event("Safari", "YouTube"), settings)).toBe("neutral");
  });

  it("summarizes longest focus run", () => {
    const timeline: MinuteFocusRecord[] = ["focused", "focused", "distracted", "focused"].map(
      (state, index) => ({
        minuteStart: `2026-06-14T09:0${index}:00.000Z`,
        app: "Code",
        title: "",
        state: state as MinuteFocusRecord["state"],
        attentionScore: 0.8,
        present: true,
      }),
    );

    const summary = summarizeTimeline("2026-06-14", timeline);
    expect(summary.longestFocusRunMinutes).toBe(2);
    expect(summary.focusedMinutes).toBe(3);
  });

  it("classifies unallowed foreground apps as distracted", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 60,
        data: { app: "Netflix", title: "Movie" },
      },
    ];

    const summary = aggregateDailyFocus(date, windows, [], defaultSettings);
    expect(summary.distractedMinutes).toBeGreaterThanOrEqual(1);
    expect(summary.totalMinutes).toBe(1);
  });

  it("limits totals to Focus Companion session events when present", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 60 * 60,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const sessions = [
      {
        timestamp: `${date}T09:10:00.000`,
        duration: 120,
        data: { running: true },
      },
    ];

    const summary = aggregateDailyFocus(date, windows, [], defaultSettings, sessions);
    expect(summary.totalMinutes).toBe(2);
    expect(summary.focusedMinutes).toBe(2);
  });

  it("ignores paused session markers when choosing observed minutes", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [{
      timestamp: `${date}T09:00:00.000`,
      duration: 60,
      data: { app: "Code", title: "focus.ts" },
    }];
    const sessions: ActivityWatchEvent<FocusSessionData>[] = [{
      timestamp: `${date}T10:00:00.000`,
      duration: 60,
      data: { running: false },
    }];

    const summary = aggregateDailyFocus(date, windows, [], defaultSettings, sessions);
    expect(summary.totalMinutes).toBe(1);
    expect(summary.focusedMinutes).toBe(1);
  });

  it("applies attention threshold changes to valid camera measurements", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:10.000`,
        duration: 50,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const camera: ActivityWatchEvent<CameraMetric>[] = [
      {
        timestamp: `${date}T09:00:20.000`,
        duration: 0,
        data: metric({ attention_score: 0.6 }),
      },
    ];

    const strict = aggregateDailyFocus(date, windows, camera, defaultSettings);
    const relaxed = aggregateDailyFocus(date, windows, camera, {
      ...defaultSettings,
      attentionThreshold: 0.5,
    });

    expect(strict.distractedMinutes).toBe(1);
    expect(relaxed.focusedMinutes).toBe(1);
  });

  it("ignores detector-error zero samples instead of treating them as away", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:10.000`,
        duration: 50,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const camera: ActivityWatchEvent<CameraMetric>[] = [
      {
        timestamp: `${date}T09:00:20.000`,
        duration: 0,
        data: metric({
          present: false,
          face_count: 0,
          attention_score: 0,
          detector_ready: false,
        }),
      },
    ];

    const summary = aggregateDailyFocus(date, windows, camera, defaultSettings);
    expect(summary.focusedMinutes).toBe(1);
    expect(summary.awayMinutes).toBe(0);
    expect(summary.timeline[0]?.attentionScore).toBeNull();
  });

  it("waits for awaySeconds before classifying no-face samples as away", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 120,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const camera: ActivityWatchEvent<CameraMetric>[] = [0, 1, 2].map((minute) => ({
      timestamp: `${date}T09:0${minute}:10.000`,
      duration: 0,
      data: metric({ present: false, face_count: 0, attention_score: 0 }),
    }));
    windows[0].duration = 180;

    const summary = aggregateDailyFocus(date, windows, camera, {
      ...defaultSettings,
      awaySeconds: 90,
    });
    expect(summary.timeline.map((record) => record.state)).toEqual(["focused", "focused", "away"]);
    expect(summary.timeline.map((record) => record.attentionScore)).toEqual([null, null, null]);
  });

  it("marks the current minute away after the default 15-second no-face delay", () => {
    const date = "2026-06-14";
    const camera: ActivityWatchEvent<CameraMetric>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 0,
        data: metric(),
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        timestamp: `${date}T09:00:${String(2 + index * 2).padStart(2, "0")}.000`,
        duration: 0,
        data: metric({ present: false, face_count: 0, attention_score: 0 }),
      })),
    ];
    const summary = aggregateDailyFocus(
      date,
      [{
        timestamp: `${date}T09:00:00.000`,
        duration: 60,
        data: { app: "Code", title: "focus.ts" },
      }],
      camera,
      defaultSettings,
    );

    expect(summary.timeline[0]?.state).toBe("away");
    expect(summary.timeline[0]?.attentionScore).toBeNull();
  });

  it("does not count an initial short no-face period as away", () => {
    const date = "2026-06-14";
    const camera: ActivityWatchEvent<CameraMetric>[] = [0, 2, 4].map((second) => ({
      timestamp: `${date}T09:00:${String(second).padStart(2, "0")}.000`,
      duration: 0,
      data: metric({ present: false, face_count: 0, attention_score: 0 }),
    }));
    const session: ActivityWatchEvent<FocusSessionData>[] = [{
      timestamp: `${date}T09:00:00.000`,
      duration: 5,
      data: { running: true },
    }];

    const summary = aggregateDailyFocus(date, [], camera, defaultSettings, session);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.awayMinutes).toBe(0);
  });

  it("does not average no-face zeroes into measured attention", () => {
    const date = "2026-06-14";
    const windows: ActivityWatchEvent<WindowEventData>[] = [
      {
        timestamp: `${date}T09:00:00.000`,
        duration: 60,
        data: { app: "Code", title: "focus.ts" },
      },
    ];
    const camera: ActivityWatchEvent<CameraMetric>[] = [
      {
        timestamp: `${date}T09:00:10.000`,
        duration: 0,
        data: metric({ attention_score: 0.8 }),
      },
      {
        timestamp: `${date}T09:00:20.000`,
        duration: 0,
        data: metric({ present: false, face_count: 0, attention_score: 0 }),
      },
    ];

    const summary = aggregateDailyFocus(date, windows, camera, defaultSettings);
    expect(summary.timeline[0]?.attentionScore).toBeNull();
    expect(summary.timeline[0]?.state).toBe("focused");
  });

  it("classifies observed activity after the configured workday instead of forcing away", () => {
    const date = "2026-06-14";
    const summary = aggregateDailyFocus(
      date,
      [{
        timestamp: `${date}T23:10:00.000`,
        duration: 60,
        data: { app: "Code", title: "late session" },
      }],
      [{
        timestamp: `${date}T23:10:05.000`,
        duration: 0,
        data: metric({ attention_score: 0.88 }),
      }],
      defaultSettings,
    );

    expect(summary.focusedMinutes).toBe(1);
    expect(summary.awayMinutes).toBe(0);
  });

  it("uses camera attention as a fallback when ActivityWatch has no window event", () => {
    const date = "2026-06-14";
    const summary = aggregateDailyFocus(
      date,
      [],
      [{
        timestamp: `${date}T23:10:05.000`,
        duration: 0,
        data: metric({ attention_score: 0.88 }),
      }],
      defaultSettings,
    );

    expect(summary.focusedMinutes).toBe(1);
    expect(summary.timeline[0]?.attentionScore).toBe(0.88);
  });
});

function metric(overrides: Partial<CameraMetric> = {}): CameraMetric {
  return {
    present: true,
    face_count: 1,
    attention_score: 0.9,
    looking_away: false,
    eyes_visible: true,
    confidence: 0.9,
    detector_ready: true,
    ...overrides,
  };
}

function event(app: string, title: string): ActivityWatchEvent<WindowEventData> {
  return {
    timestamp: "2026-06-15T09:00:00.000Z",
    duration: 60,
    data: { app, title },
  };
}
