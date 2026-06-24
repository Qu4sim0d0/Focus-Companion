export type IsoTimestamp = string;

export type FocusState = "focused" | "distracted";

export interface ActivityWatchEvent<TData = Record<string, unknown>> {
  id?: number;
  timestamp: IsoTimestamp;
  duration: number;
  data: TData;
}

export interface WindowEventData {
  app?: string;
  title?: string;
  url?: string;
}

export interface InputMetric {
  idleSeconds: number;
  active: boolean;
}

export interface FocusSessionData {
  running: boolean;
}

export interface FocusInputEvents {
  date: string;
  windowEvents: ActivityWatchEvent<WindowEventData>[];
  inputEvents: ActivityWatchEvent<InputMetric>[];
  sessionEvents: ActivityWatchEvent<FocusSessionData>[];
}

export interface AppRule {
  pattern: string;
  mode: "focus" | "distract";
  matchTitle: boolean;
}

export interface FocusSettings {
  workdayStartHour: number;
  workdayEndHour: number;
  nudgesEnabled: boolean;
  inputIdleThresholdSeconds: number;
  distractNudgeSeconds: number;
  rules: AppRule[];
  allowedApps: string[];
  distractingApps: string[];
  allowedWindowTitles: string[];
  distractingWindowTitles: string[];
  reportDir?: string;
}

export interface MinuteFocusRecord {
  minuteStart: IsoTimestamp;
  app: string;
  title: string;
  state: FocusState;
  activityScore: number;
  inputActive: boolean;
  reason?: MinuteFocusReason;
}

export interface MinuteFocusReason {
  code:
    | "input-idle"
    | "distracting-window"
    | "distracting-app"
    | "allowed-window"
    | "allowed-app"
    | "legacy-rule"
    | "self"
    | "unclassified-active"
    | "no-observation";
  label: string;
  pattern?: string;
  idleSeconds?: number;
  thresholdSeconds?: number;
}

export interface DailySummary {
  date: string;
  totalMinutes: number;
  focusedMinutes: number;
  distractedMinutes: number;
  awayMinutes: number;
  focusRatio: number;
  longestFocusRunMinutes: number;
  timeline: MinuteFocusRecord[];
}

export interface WeeklySummary {
  weekLabel: string;
  days: DailySummary[];
}
