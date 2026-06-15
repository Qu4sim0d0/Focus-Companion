import type { FocusSettings } from "../types";
import type { Locale } from "../i18n";
import { normalizeSettings } from "./storage";

const backupFormat = "focus-companion-settings";
const backupVersion = 1;

export interface ImportedSettingsBackup {
  locale: Locale;
  settings: FocusSettings;
}

export function serializeSettingsBackup(
  locale: Locale,
  settings: FocusSettings,
  exportedAt = new Date(),
): string {
  return JSON.stringify({
    format: backupFormat,
    version: backupVersion,
    exportedAt: exportedAt.toISOString(),
    locale,
    settings: normalizeSettings(settings),
  }, null, 2);
}

export function parseSettingsBackup(text: string): ImportedSettingsBackup {
  if (text.length > 1_000_000) throw new Error("Backup file is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }
  if (!isRecord(parsed) || parsed.format !== backupFormat || parsed.version !== backupVersion) {
    throw new Error("Unsupported Focus Companion backup.");
  }
  if (!isRecord(parsed.settings)) {
    throw new Error("Backup settings are missing.");
  }
  return {
    locale: parsed.locale === "en" ? "en" : "zh",
    settings: normalizeSettings(parsed.settings as Partial<FocusSettings>),
  };
}

export function downloadSettingsBackup(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
