import { t, type Locale } from "../i18n";

export function describeCameraError(error: unknown, locale: Locale): string {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return t(locale, "cameraPermissionDenied");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return t(locale, "cameraNotFound");
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return t(locale, "cameraBusy");
  }
  if (
    message.includes("face_landmarker") ||
    message.includes("wasm") ||
    message.includes("failed to fetch")
  ) {
    return t(locale, "cameraModelFailed");
  }
  return t(locale, "cameraUnknown");
}
