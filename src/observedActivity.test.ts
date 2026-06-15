import { describe, expect, it } from "vitest";
import {
  observedWindowMode,
  summarizeObservedWindows,
  type ObservedWindow,
} from "./core/observedActivity";
import { defaultSettings } from "./core/focus";
import type { ActivityWatchEvent, WindowEventData } from "./types";

describe("observed window list", () => {
  it("groups matching app and title pairs independently from the app list", () => {
    const windows = summarizeObservedWindows([
      event("Safari", "Course notes", 20),
      event("Safari", "Course notes", 40),
      event("Safari", "YouTube", 15),
      event("Code", "", 60),
    ]);

    expect(windows).toEqual([
      { app: "Safari", title: "Course notes", seconds: 60 },
      { app: "Safari", title: "YouTube", seconds: 15 },
    ]);
  });

  it("shows the effective window classification", () => {
    const item: ObservedWindow = {
      app: "Safari",
      title: "YouTube - lecture",
      seconds: 60,
    };
    expect(observedWindowMode(item, {
      ...defaultSettings,
      allowedApps: ["Safari"],
      distractingWindowTitles: ["YouTube"],
    })).toBe("distract");
  });
});

function event(
  app: string,
  title: string,
  duration: number,
): ActivityWatchEvent<WindowEventData> {
  return {
    timestamp: "2026-06-15T12:00:00.000Z",
    duration,
    data: { app, title },
  };
}
