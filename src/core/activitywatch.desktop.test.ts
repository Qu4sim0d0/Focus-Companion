// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ActivityWatchClient } from "./activitywatch";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

afterEach(() => {
  vi.mocked(invoke).mockReset();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("ActivityWatchClient desktop transport", () => {
  it("uses Tauri commands instead of WebView fetch for GET requests", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify({ version: "test" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new ActivityWatchClient();
    await expect(client.info()).resolves.toEqual({ version: "test" });
    expect(invoke).toHaveBeenCalledWith("activitywatch_get", { path: "/info" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("detects the Tauri bridge at request time", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ActivityWatchClient();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify({ version: "test" }));

    await expect(client.info()).resolves.toEqual({ version: "test" });

    expect(invoke).toHaveBeenCalledWith("activitywatch_get", { path: "/info" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Tauri commands for heartbeat POST requests", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValueOnce("{}");
    const client = new ActivityWatchClient();

    await client.heartbeatSession("focus-companion-session_local", false);

    expect(invoke).toHaveBeenCalledWith(
      "activitywatch_post",
      expect.objectContaining({
        path: "/buckets/focus-companion-session_local/heartbeat?pulsetime=65",
        body: expect.stringContaining('"running":false'),
      }),
    );
  });
});
