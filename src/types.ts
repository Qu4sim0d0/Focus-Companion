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

export interface CameraMetric {
  present: boolean;
  face_count: number;
  attention_score: number;
  looking_away: boolean;
  eyes_visible: boolean;
  confidence: number;
  detector_ready?: boolean;
  head_turn?: number;
  eye_look_side_or_up?: number;
  eye_look_down?: number;
}

export interface CameraCalibration {
  headTurn: number;
  eyeLookSideOrUp: number;
  eyeLookDown: number;
  confidence: number;
  calibratedAt: IsoTimestamp;
}

export interface FocusSessionData {
  running: boolean;
}

export interface FocusInputEvents {
  date: string;
  windowEvents: ActivityWatchEvent<WindowEventData>[];
  cameraEvents: ActivityWatchEvent<CameraMetric>[];
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
  awaySeconds: number;
  attentionThreshold: number;
  rules: AppRule[];
  allowedApps: string[];
  distractingApps: string[];
  allowedWindowTitles: string[];
  distractingWindowTitles: string[];
  cameraCalibration?: CameraCalibration;
  reportDir?: string;
}

export interface MinuteFocusRecord {
  minuteStart: IsoTimestamp;
  app: string;
  title: string;
  state: FocusState;
  attentionScore: number | null;
  present: boolean;
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
