import { defaultSettings } from "./focus";
import type {
  CameraCalibration,
  DailySummary,
  FocusSettings,
  WeeklySummary,
} from "../types";
import type { Locale } from "../i18n";

const storageKey = "focus-companion.state.v2";
const legacyStorageKey = "focus-companion.state.v1";

export interface StoredAppState {
  locale: Locale;
  settings: FocusSettings;
  dailySummary: DailySummary | null;
  weeklySummary: WeeklySummary | null;
}

export function loadStoredState(): StoredAppState {
  if (typeof window === "undefined") return defaultStoredState();
  const currentRaw = window.localStorage.getItem(storageKey);
  const legacyRaw = currentRaw ? null : window.localStorage.getItem(legacyStorageKey);
  const raw = currentRaw ?? legacyRaw;
  if (!raw) return defaultStoredState();

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppState>;
    const state: StoredAppState = {
      locale: parsed.locale === "en" ? "en" : "zh",
      settings: normalizeSettings(parsed.settings, legacyRaw !== null),
      dailySummary: parsed.dailySummary ?? null,
      weeklySummary: parsed.weeklySummary ?? null,
    };
    if (legacyRaw !== null) saveStoredState(state);
    return state;
  } catch {
    return defaultStoredState();
  }
}

export function normalizeSettings(
  settings: Partial<FocusSettings> | undefined,
  migrateLegacyAwayDelay = false,
): FocusSettings {
  const workdayStartHour = clampInteger(settings?.workdayStartHour, 0, 23, defaultSettings.workdayStartHour);
  const workdayEndHour = clampInteger(settings?.workdayEndHour, 0, 23, defaultSettings.workdayEndHour);
  return {
    ...defaultSettings,
    ...(settings ?? {}),
    workdayStartHour,
    workdayEndHour,
    attentionThreshold: clampNumber(
      settings?.attentionThreshold,
      0.3,
      0.95,
      defaultSettings.attentionThreshold,
    ),
    awaySeconds: migrateLegacyAwayDelay && settings?.awaySeconds === 90
      ? defaultSettings.awaySeconds
      : clampInteger(settings?.awaySeconds, 5, 120, defaultSettings.awaySeconds),
    nudgesEnabled: settings?.nudgesEnabled ?? defaultSettings.nudgesEnabled,
    distractNudgeSeconds: clampInteger(
      settings?.distractNudgeSeconds,
      30,
      600,
      defaultSettings.distractNudgeSeconds,
    ),
    rules: normalizeRules(settings?.rules),
    allowedApps: normalizeStringList(settings?.allowedApps, defaultSettings.allowedApps),
    distractingApps: normalizeStringList(settings?.distractingApps, defaultSettings.distractingApps),
    allowedWindowTitles: normalizeStringList(
      settings?.allowedWindowTitles,
      legacyTitlePatterns(settings?.rules, "focus", defaultSettings.allowedWindowTitles),
    ),
    distractingWindowTitles: normalizeStringList(
      settings?.distractingWindowTitles,
      legacyTitlePatterns(
        settings?.rules,
        "distract",
        defaultSettings.distractingWindowTitles,
      ),
    ),
    cameraCalibration: normalizeCameraCalibration(settings?.cameraCalibration),
    reportDir: normalizeOptionalString(settings?.reportDir),
  };
}

export function saveStoredState(state: StoredAppState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function currentDailySummary(
  summary: DailySummary | null,
  now = new Date(),
): DailySummary | null {
  return summary?.date === localDateLabel(now) ? summary : null;
}

function defaultStoredState(): StoredAppState {
  return {
    locale: "zh",
    settings: defaultSettings,
    dailySummary: null,
    weeklySummary: null,
  };
}

function normalizeRules(rules: FocusSettings["rules"] | undefined): FocusSettings["rules"] {
  if (!Array.isArray(rules)) return defaultSettings.rules;
  return rules
    .filter((rule) =>
      rule &&
      typeof rule.pattern === "string" &&
      (rule.mode === "focus" || rule.mode === "distract"),
    )
    .slice(0, 200)
    .map((rule) => ({
      pattern: rule.pattern.trim().slice(0, 100),
      mode: rule.mode,
      matchTitle: Boolean(rule.matchTitle),
    }))
    .filter((rule) => rule.pattern.length > 0);
}

function normalizeStringList(values: string[] | undefined, fallback: string[]): string[] {
  if (!Array.isArray(values)) return fallback;
  return Array.from(new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().slice(0, 100))
      .filter(Boolean),
  )).slice(0, 200);
}

function legacyTitlePatterns(
  rules: FocusSettings["rules"] | undefined,
  mode: "focus" | "distract",
  fallback: string[],
): string[] {
  if (!Array.isArray(rules)) return fallback;
  const migrated = rules
    .filter((rule) => rule?.matchTitle && rule.mode === mode)
    .map((rule) => rule.pattern);
  return migrated.length > 0 ? migrated : fallback;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 1_000);
  return normalized || undefined;
}

function normalizeCameraCalibration(
  value: CameraCalibration | undefined,
): CameraCalibration | undefined {
  if (
    !value ||
    !isFiniteInRange(value.headTurn, 0, 1) ||
    !isFiniteInRange(value.eyeLookSideOrUp, 0, 1) ||
    !isFiniteInRange(value.eyeLookDown, 0, 1) ||
    !isFiniteInRange(value.confidence, 0.05, 1) ||
    typeof value.calibratedAt !== "string" ||
    !Number.isFinite(new Date(value.calibratedAt).getTime())
  ) {
    return undefined;
  }
  return {
    headTurn: value.headTurn,
    eyeLookSideOrUp: value.eyeLookSideOrUp,
    eyeLookDown: value.eyeLookDown,
    confidence: value.confidence,
    calibratedAt: value.calibratedAt,
  };
}

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function localDateLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
