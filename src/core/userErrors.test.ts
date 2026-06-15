import { describe, expect, it } from "vitest";
import { describeCameraError } from "./userErrors";

describe("camera error descriptions", () => {
  it("turns browser camera errors into actionable Chinese messages", () => {
    expect(describeCameraError(new DOMException("", "NotAllowedError"), "zh")).toContain("权限");
    expect(describeCameraError(new DOMException("", "NotFoundError"), "zh")).toContain("摄像头");
    expect(describeCameraError(new DOMException("", "NotReadableError"), "zh")).toContain("占用");
  });

  it("recognizes a missing local model", () => {
    expect(describeCameraError(new Error("Failed to fetch face_landmarker.task"), "en"))
      .toContain("model");
  });
});
