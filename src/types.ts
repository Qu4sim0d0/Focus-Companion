export type IsoTimestamp = string;

export type FocusState = "focused" | "distracted" | "away";

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
