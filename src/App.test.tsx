import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App settings activity lists", () => {
  it("renders app and window lists as separate sections", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("ActivityWatch 软件列表");
    expect(markup).toContain("ActivityWatch 窗口列表");
  });
});
