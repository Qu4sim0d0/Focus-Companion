// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTime } from "./time";

describe("useTime", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("updates subscribers without rerendering their parent", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let parentRenders = 0;
    let subscriberRenders = 0;

    function TimeSubscriber() {
      useTime();
      subscriberRenders += 1;
      return null;
    }

    function Parent() {
      parentRenders += 1;
      return <TimeSubscriber />;
    }

    act(() => root.render(<Parent />));
    const initialSubscriberRenders = subscriberRenders;

    act(() => vi.advanceTimersByTime(2_100));

    expect(parentRenders).toBe(1);
    expect(subscriberRenders).toBeGreaterThan(initialSubscriberRenders);

    act(() => root.unmount());
  });
});
