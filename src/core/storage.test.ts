import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentDailySummary,
  loadStoredState,
  normalizeSettings,
  saveStoredState,
} from "./storage";
import { defaultSettings, summarizeTimeline } from "./focus";

describe("local storage persistence", () => {
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

  it("defaults to Chinese and empty data", () => {
    const state = loadStoredState();
    expect(state.locale).toBe("zh");
    expect(state.dailySummary).toBeNull();
    expect(state.weeklySummary).toBeNull();
  });

  it("round-trips stored summaries", () => {
    const dailySummary = summarizeTimeline("2026-06-14", []);
    saveStoredState({
      locale: "en",
      settings: defaultSettings,
      dailySummary,
      weeklySummary: { weekLabel: "2026-06-08 - 2026-06-14", days: [dailySummary] },
    });

    const state = loadStoredState();
    expect(state.locale).toBe("en");
    expect(state.dailySummary?.date).toBe("2026-06-14");
    expect(state.weeklySummary?.days).toHaveLength(1);
  });

  it("migrates the old fixed away delay once but preserves a new explicit 90 seconds", () => {
    backing.set("focus-companion.state.v1", JSON.stringify({
      locale: "zh",
      settings: { ...defaultSettings, awaySeconds: 90 },
    }));
    expect(loadStoredState().settings.awaySeconds).toBe(15);

    saveStoredState({
      locale: "zh",
      settings: { ...defaultSettings, awaySeconds: 90 },
      dailySummary: null,
      weeklySummary: null,
    });
    expect(loadStoredState().settings.awaySeconds).toBe(90);
  });

  it("adds the default nudge preference to older stored settings", () => {
    backing.set("focus-companion.state.v2", JSON.stringify({
      locale: "zh",
      settings: {
        ...defaultSettings,
        nudgesEnabled: undefined,
      },
    }));
    expect(loadStoredState().settings.nudgesEnabled).toBe(false);
  });

  it("drops a cached daily summary from a previous local date", () => {
    const summary = summarizeTimeline("2026-06-14", []);
    expect(currentDailySummary(summary, new Date(2026, 5, 14, 23, 59))).toBe(summary);
    expect(currentDailySummary(summary, new Date(2026, 5, 15, 0, 1))).toBeNull();
  });

  it("normalizes malformed settings into supported ranges", () => {
    const settings = normalizeSettings({
      attentionThreshold: 12,
      awaySeconds: -5,
      distractNudgeSeconds: 12_000,
      workdayStartHour: -2,
      workdayEndHour: 30,
      allowedApps: [" Code ", "Code", ""],
      distractingApps: ["Safari"],
      allowedWindowTitles: ["  在线课程 ", "在线课程"],
      distractingWindowTitles: ["YouTube"],
      rules: [{ pattern: "  YouTube  ", mode: "distract", matchTitle: true }],
    });

    expect(settings.attentionThreshold).toBe(0.95);
    expect(settings.awaySeconds).toBe(5);
    expect(settings.distractNudgeSeconds).toBe(600);
    expect(settings.workdayStartHour).toBe(0);
    expect(settings.workdayEndHour).toBe(23);
    expect(settings.allowedApps).toEqual(["Code"]);
    expect(settings.allowedWindowTitles).toEqual(["在线课程"]);
    expect(settings.rules[0]?.pattern).toBe("YouTube");
  });

  it("reports storage quota failures instead of crashing", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      },
    });

    expect(saveStoredState({
      locale: "zh",
      settings: defaultSettings,
      dailySummary: null,
      weeklySummary: null,
    })).toBe(false);
  });

  it("keeps valid camera calibration and drops malformed profiles", () => {
    const valid = normalizeSettings({
      cameraCalibration: {
        headTurn: 0.1,
        eyeLookSideOrUp: 0.2,
        eyeLookDown: 0.6,
        confidence: 0.8,
        calibratedAt: "2026-06-15T00:00:00.000Z",
      },
    });
    const invalid = normalizeSettings({
      cameraCalibration: {
        headTurn: 4,
        eyeLookSideOrUp: 0.2,
        eyeLookDown: 0.6,
        confidence: 0.8,
        calibratedAt: "not-a-date",
      },
    });

    expect(valid.cameraCalibration?.eyeLookDown).toBe(0.6);
    expect(invalid.cameraCalibration).toBeUndefined();
  });

  it("migrates old title rules into the separate window lists", () => {
    const settings = normalizeSettings({
      rules: [
        { pattern: "课堂", mode: "focus", matchTitle: true },
        { pattern: "YouTube", mode: "distract", matchTitle: true },
      ],
      allowedWindowTitles: undefined,
      distractingWindowTitles: undefined,
    });

    expect(settings.allowedWindowTitles).toEqual(["课堂"]);
    expect(settings.distractingWindowTitles).toEqual(["YouTube"]);
  });
});
