import { describe, expect, it } from "vitest";
import { buildLiveStatusModel } from "./LiveStatus";
import { defaultSettings } from "../core/focus";
import type { MinuteFocusRecord } from "../types";

describe("live status model", () => {
  it("re-evaluates the current app with updated rules immediately", () => {
    const currentRecord: MinuteFocusRecord = {
      minuteStart: "2026-06-17T09:00:00.000Z",
      app: "Code",
      title: "focus.ts",
      state: "distracted",
      activityScore: 0.6,
      inputActive: true,
    };

    const model = buildLiveStatusModel(currentRecord, {
      available: true,
      idleSeconds: 0,
    }, {
      ...defaultSettings,
      allowedApps: [],
      distractingApps: ["Code"],
      allowedWindowTitles: [],
      distractingWindowTitles: [],
      rules: [],
    });

    expect(model.state).toBe("distracted");

    const updated = buildLiveStatusModel(currentRecord, {
      available: true,
      idleSeconds: 0,
    }, {
      ...defaultSettings,
      allowedApps: ["Code"],
      distractingApps: [],
      allowedWindowTitles: [],
      distractingWindowTitles: [],
      rules: [],
    });

    expect(updated.state).toBe("focused");
  });
});
