import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityWatchClient, formatLocalDate, todayRange } from "./activitywatch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ActivityWatch date helpers", () => {
  it("formats dates from local calendar components", () => {
    expect(formatLocalDate(new Date(2026, 5, 14, 20, 30))).toBe("2026-06-14");
  });

  it("returns a local date label for the local day range", () => {
    const range = todayRange(new Date(2026, 5, 14, 20, 30));
    expect(range.date).toBe("2026-06-14");
  });

  it("creates custom buckets with the ActivityWatch POST API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ActivityWatchClient("http://activitywatch.test/api/0");
    await client.ensureSessionBucket("local");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://activitywatch.test/api/0/buckets/focus-companion-session_local",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("writes paused session boundaries explicitly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ActivityWatchClient("http://activitywatch.test/api/0");

    await client.heartbeatSession("focus-companion-session_local", false);

    const request = fetchMock.mock.calls[0];
    expect(JSON.parse(request[1].body)).toEqual(expect.objectContaining({
      data: { running: false },
    }));
  });

  it("writes input idle metrics without input contents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ActivityWatchClient("http://activitywatch.test/api/0");

    await client.heartbeatInputMetric("focus-input_local", {
      idleSeconds: 60,
      active: false,
    });

    const request = fetchMock.mock.calls[0];
    expect(JSON.parse(request[1].body)).toEqual(expect.objectContaining({
      data: { idleSeconds: 60, active: false },
    }));
  });
});
