// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInputActivity } from "./inputActivity";

describe("useInputActivity", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("updates its subscriber without rerendering the parent", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let parentRenders = 0;
    let subscriberRenders = 0;

    function Subscriber() {
      useInputActivity();
      subscriberRenders += 1;
      return null;
    }

    function Parent() {
      parentRenders += 1;
      return <Subscriber />;
    }

    await act(async () => root.render(<Parent />));
    const initialSubscriberRenders = subscriberRenders;
    await act(async () => {
      vi.advanceTimersByTime(2_100);
      await Promise.resolve();
    });

    expect(parentRenders).toBe(1);
    expect(subscriberRenders).toBeGreaterThan(initialSubscriberRenders);

    act(() => root.unmount());
  });
});
