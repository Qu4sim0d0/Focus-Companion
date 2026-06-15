import { describe, expect, it } from "vitest";
import { buildDailyMarkdown } from "./report";
import { summarizeTimeline } from "./focus";
import type { MinuteFocusRecord } from "../types";

describe("report generation", () => {
  it("includes metrics, assets, and timeline rows", () => {
    const timeline: MinuteFocusRecord[] = [
      {
        minuteStart: "2026-06-14T09:00:00.000Z",
        app: "Code",
        title: "App.tsx",
        state: "focused",
        activityScore: 1,
        inputActive: true,
      },
    ];
    const markdown = buildDailyMarkdown(summarizeTimeline("2026-06-14", timeline), [
      { filename: "timeline.png", dataUrl: "data:image/png;base64,abc" },
    ]);

    expect(markdown).toContain("# Focus Report: 2026-06-14");
    expect(markdown).toContain("![timeline.png](assets/timeline.png)");
    const localTime = new Date("2026-06-14T09:00:00.000Z").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(markdown).toContain(`| ${localTime} | focused | Code | App.tsx | 1.00 |`);
  });
});
