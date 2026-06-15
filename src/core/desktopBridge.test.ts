// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getSystemIdleSeconds } from "./desktopBridge";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSystemIdleSeconds", () => {
  it("uses the local development bridge outside Tauri", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ seconds: 4.25 }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSystemIdleSeconds()).resolves.toBe(4.25);
    expect(fetchMock).toHaveBeenCalledWith(
      "/__focus_companion/system_idle",
      { method: "POST" },
    );
  });

  it("returns null when the development bridge is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(getSystemIdleSeconds()).resolves.toBeNull();
  });
});
