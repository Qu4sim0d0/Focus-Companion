import { describe, expect, it } from "vitest";
import { defaultSettings } from "./focus";
import { parseSettingsBackup, serializeSettingsBackup } from "./settingsBackup";

describe("settings backup", () => {
  it("round-trips settings without summaries or raw activity data", () => {
    const text = serializeSettingsBackup("en", {
      ...defaultSettings,
      allowedApps: ["Code", "WPS Office"],
      allowedWindowTitles: ["Online course"],
      distractingWindowTitles: ["YouTube"],
      nudgesEnabled: true,
    }, new Date("2026-06-15T00:00:00.000Z"));
    const parsed = parseSettingsBackup(text);

    expect(parsed.locale).toBe("en");
    expect(parsed.settings.allowedApps).toContain("WPS Office");
    expect(parsed.settings.allowedWindowTitles).toEqual(["Online course"]);
    expect(text).not.toContain("dailySummary");
    expect(text).not.toContain("windowEvents");
  });

  it("normalizes unsafe or invalid imported values", () => {
    const parsed = parseSettingsBackup(JSON.stringify({
      format: "focus-companion-settings",
      version: 1,
      locale: "invalid",
      settings: {
        workdayStartHour: 42,
        allowedApps: [" Code ", "Code", 123],
        allowedWindowTitles: [" Course ", "Course"],
        distractingWindowTitles: ["YouTube"],
        rules: [{ pattern: "Safari", mode: "distract", matchTitle: "yes" }],
      },
    }));

    expect(parsed.locale).toBe("zh");
    expect(parsed.settings.workdayStartHour).toBe(23);
    expect(parsed.settings.allowedApps).toEqual(["Code"]);
    expect(parsed.settings.allowedWindowTitles).toEqual(["Course"]);
    expect(parsed.settings.rules[0]).toEqual({
      pattern: "Safari",
      mode: "distract",
      matchTitle: true,
    });
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseSettingsBackup('{"version":1}')).toThrow("Unsupported");
  });
});
