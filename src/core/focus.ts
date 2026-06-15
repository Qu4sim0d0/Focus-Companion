import type {
  ActivityWatchEvent,
  CameraMetric,
  DailySummary,
  FocusSettings,
  FocusState,
  FocusSessionData,
  MinuteFocusRecord,
  WeeklySummary,
  WindowEventData,
} from "../types";

export const defaultSettings: FocusSettings = {
  workdayStartHour: 8,
  workdayEndHour: 22,
  nudgesEnabled: false,
  distractNudgeSeconds: 60,
  awaySeconds: 15,
  attentionThreshold: 0.65,
  allowedApps: ["Code", "Terminal", "Xcode"],
  distractingApps: ["YouTube", "TikTok", "Instagram"],
  allowedWindowTitles: [],
  distractingWindowTitles: ["YouTube", "TikTok", "Instagram"],
  rules: [
    { pattern: "Code", mode: "focus", matchTitle: false },
    { pattern: "Terminal", mode: "focus", matchTitle: false },
    { pattern: "Xcode", mode: "focus", matchTitle: false },
    { pattern: "YouTube", mode: "distract", matchTitle: true },
    { pattern: "TikTok", mode: "distract", matchTitle: true },
    { pattern: "Instagram", mode: "distract", matchTitle: true },
  ],
};

const minuteMs = 60_000;

export function startOfMinute(date: Date): Date {
  const normalized = new Date(date);
  normalized.setSeconds(0, 0);
  return normalized;
}

export function scoreWindow(
  event: ActivityWatchEvent<WindowEventData> | undefined,
  settings: FocusSettings,
): "focus" | "distract" | "neutral" {
  return explainWindowScore(event, settings).score;
}

export interface WindowScoreExplanation {
  score: "focus" | "distract" | "neutral";
  source: "self" | "allowed-window" | "distracting-window" | "allowed-app" | "distracting-app" | "legacy" | "none";
  pattern?: string;
}

export function explainWindowScore(
  event: ActivityWatchEvent<WindowEventData> | undefined,
  settings: FocusSettings,
): WindowScoreExplanation {
  if (!event) return { score: "neutral", source: "none" };
  const app = event.data.app ?? "";
  const title = event.data.title ?? "";
  const normalizedApp = app.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedApp.includes("focus companion") ||
    normalizedApp.includes("focus-companion")
  ) {
    return { score: "focus", source: "self" };
  }

  const distractingWindow = matchingPattern(
    normalizedTitle,
    settings.distractingWindowTitles,
  );
  if (distractingWindow) {
    return {
      score: "distract",
      source: "distracting-window",
      pattern: distractingWindow,
    };
  }

  const allowedWindow = matchingPattern(normalizedTitle, settings.allowedWindowTitles);
  if (allowedWindow) {
    return { score: "focus", source: "allowed-window", pattern: allowedWindow };
  }

  const distractingApp = matchingPattern(normalizedApp, settings.distractingApps);
  if (distractingApp) {
    return { score: "distract", source: "distracting-app", pattern: distractingApp };
  }
  const allowedApp = matchingPattern(normalizedApp, settings.allowedApps);
  if (allowedApp) {
    return { score: "focus", source: "allowed-app", pattern: allowedApp };
  }

  for (const rule of settings.rules) {
    const haystack = rule.matchTitle ? `${app} ${title}` : app;
    if (haystack.toLowerCase().includes(rule.pattern.toLowerCase())) {
      return { score: rule.mode, source: "legacy", pattern: rule.pattern };
    }
  }

  return { score: "neutral", source: "none" };
}

function matchingPattern(value: string, patterns: string[]): string | undefined {
  return patterns.find((pattern) => value.includes(pattern.toLowerCase()));
}

export function classifyMinute(
  windowEvent: ActivityWatchEvent<WindowEventData> | undefined,
  cameraMetric: CameraMetric | undefined,
  settings: FocusSettings,
): FocusState {
  if (!windowEvent && !cameraMetric) return "away";
  if (cameraMetric && !cameraMetric.present) return "away";
  if (cameraMetric && cameraMetric.attention_score < settings.attentionThreshold) {
    return "distracted";
  }
  if (!windowEvent && cameraMetric) return "focused";

  const windowScore = scoreWindow(windowEvent, settings);
  if (windowScore === "focus" && (!cameraMetric || cameraMetric.attention_score >= settings.attentionThreshold)) {
    return "focused";
  }
  if (windowScore === "distract") return "distracted";

  return "distracted";
}

export function aggregateDailyFocus(
  date: string,
  windowEvents: ActivityWatchEvent<WindowEventData>[],
  cameraEvents: ActivityWatchEvent<CameraMetric>[],
  settings: FocusSettings = defaultSettings,
  sessionEvents: ActivityWatchEvent<FocusSessionData>[] = [],
): DailySummary {
  const start = new Date(`${date}T00:00:00.000`);
  const end = new Date(start.getTime() + 24 * 60 * minuteMs);
  const timeline: MinuteFocusRecord[] = [];
  const observedMinutes = observedMinuteStarts(start, end, sessionEvents, windowEvents, cameraEvents);
  const sortedCameraEvents = cameraEvents
    .filter((event) => event.data.detector_ready !== false)
    .slice()
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  for (const t of observedMinutes) {
    const minuteStart = new Date(t);
    const windowEvent = findEventAt(windowEvents, minuteStart);
    const cameraState = cameraStateAtMinute(sortedCameraEvents, minuteStart);
    const cameraMetric = cameraState.metric;
    const app = windowEvent?.data.app ?? "";
    const title = windowEvent?.data.title ?? "";
    const previousState = timeline[timeline.length - 1]?.state;
    if (
      cameraMetric &&
      !cameraMetric.present &&
      cameraState.absentSeconds < settings.awaySeconds &&
      !previousState &&
      !windowEvent
    ) {
      continue;
    }
    const state = cameraMetric && !cameraMetric.present
      ? cameraState.absentSeconds >= settings.awaySeconds
        ? "away"
        : previousState ?? classifyMinute(windowEvent, undefined, settings)
      : classifyMinute(windowEvent, cameraMetric, settings);

    timeline.push({
      minuteStart: minuteStart.toISOString(),
      app,
      title,
      state,
      attentionScore: cameraMetric?.present ? cameraMetric.attention_score : null,
      present: cameraMetric?.present ?? false,
    });
  }

  return summarizeTimeline(date, timeline);
}

export function summarizeTimeline(date: string, timeline: MinuteFocusRecord[]): DailySummary {
  const counts = countStates(timeline);
  const totalMinutes = timeline.length;
  const activeMinutes = counts.focused + counts.distracted;
  const focusRatio = activeMinutes === 0 ? 0 : counts.focused / activeMinutes;

  return {
    date,
    totalMinutes,
    focusedMinutes: counts.focused,
    distractedMinutes: counts.distracted,
    awayMinutes: counts.away,
    focusRatio,
    longestFocusRunMinutes: longestRun(timeline, "focused"),
    timeline,
  };
}

export function buildWeeklySummary(weekLabel: string, days: DailySummary[]): WeeklySummary {
  return { weekLabel, days };
}

export function compressTimeline(timeline: MinuteFocusRecord[], blockMinutes = 5): MinuteFocusRecord[] {
  const compressed: MinuteFocusRecord[] = [];
  for (let index = 0; index < timeline.length; index += blockMinutes) {
    const slice = timeline.slice(index, index + blockMinutes);
    if (slice.length === 0) continue;
    const dominant = dominantState(slice);
    compressed.push({
      ...slice[0],
      state: dominant,
      attentionScore: averageNullable(slice.map((record) => record.attentionScore)),
      present: slice.some((record) => record.present),
    });
  }
  return compressed;
}

function findEventAt<TData>(
  events: ActivityWatchEvent<TData>[],
  minuteStart: Date,
): ActivityWatchEvent<TData> | undefined {
  const minuteStartMs = minuteStart.getTime();
  const minuteEndMs = minuteStartMs + minuteMs;
  let bestEvent: ActivityWatchEvent<TData> | undefined;
  let bestOverlap = 0;

  for (const event of events) {
    const eventStart = new Date(event.timestamp).getTime();
    const eventEnd = eventStart + Math.max(1, event.duration * 1000);
    const overlap = Math.max(
      0,
      Math.min(minuteEndMs, eventEnd) - Math.max(minuteStartMs, eventStart),
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestEvent = event;
    }
  }

  return bestEvent;
}

function observedMinuteStarts(
  dayStart: Date,
  dayEnd: Date,
  sessionEvents: ActivityWatchEvent<FocusSessionData>[],
  windowEvents: ActivityWatchEvent<WindowEventData>[],
  cameraEvents: ActivityWatchEvent<CameraMetric>[],
): number[] {
  const activeSessionEvents = sessionEvents.filter((event) => event.data.running);
  const sourceEvents = activeSessionEvents.length > 0
    ? activeSessionEvents
    : [...windowEvents, ...cameraEvents];
  const minutes = new Set<number>();
  for (const event of sourceEvents) {
    const eventStart = new Date(event.timestamp).getTime();
    const start = Math.max(startOfMinute(new Date(eventStart)).getTime(), dayStart.getTime());
    const rawEnd = eventStart + Math.max(event.duration * 1000, 1);
    const end = Math.min(startOfMinute(new Date(rawEnd - 1)).getTime(), dayEnd.getTime() - minuteMs);
    for (let t = start; t <= end; t += minuteMs) {
      minutes.add(t);
    }
  }
  return Array.from(minutes).sort((a, b) => a - b);
}

function cameraStateAtMinute(
  events: ActivityWatchEvent<CameraMetric>[],
  minuteStart: Date,
): { metric: CameraMetric | undefined; absentSeconds: number } {
  const start = minuteStart.getTime();
  const end = start + minuteMs;
  const eventsThroughMinute = events.filter(
    (event) => new Date(event.timestamp).getTime() < end,
  );
  const minuteEvents = eventsThroughMinute.filter(
    (event) => new Date(event.timestamp).getTime() >= start,
  );

  if (minuteEvents.length === 0) return { metric: undefined, absentSeconds: 0 };

  const latestEvent = eventsThroughMinute[eventsThroughMinute.length - 1];
  const latestMetric = latestEvent.data;
  const presentMetrics = minuteEvents.map((event) => event.data).filter((metric) => metric.present);
  const metric: CameraMetric = {
    present: latestMetric.present,
    face_count: Math.max(...minuteEvents.map((event) => event.data.face_count)),
    attention_score: average(presentMetrics.map((metric) => metric.attention_score)),
    looking_away:
      minuteEvents.filter((event) => event.data.looking_away).length > minuteEvents.length / 2,
    eyes_visible:
      minuteEvents.filter((event) => event.data.eyes_visible).length > minuteEvents.length / 2,
    confidence: average(presentMetrics.map((metric) => metric.confidence)),
    detector_ready: true,
  };

  if (latestMetric.present) return { metric, absentSeconds: 0 };

  let absenceStart = new Date(latestEvent.timestamp).getTime();
  for (let index = eventsThroughMinute.length - 2; index >= 0; index -= 1) {
    const event = eventsThroughMinute[index];
    if (event.data.present) break;
    absenceStart = new Date(event.timestamp).getTime();
  }
  const latestTimestamp = new Date(latestEvent.timestamp).getTime();
  const sampleIntervalSeconds = estimateSampleIntervalSeconds(eventsThroughMinute);
  return {
    metric,
    absentSeconds: Math.max(0, (latestTimestamp - absenceStart) / 1000 + sampleIntervalSeconds),
  };
}

function estimateSampleIntervalSeconds(events: ActivityWatchEvent<CameraMetric>[]): number {
  if (events.length < 2) return 0;
  const recent = events.slice(-6);
  const intervals = recent
    .slice(1)
    .map((event, index) =>
      (new Date(event.timestamp).getTime() - new Date(recent[index].timestamp).getTime()) / 1000,
    )
    .filter((seconds) => seconds > 0 && seconds <= 30)
    .sort((left, right) => left - right);
  return intervals[Math.floor(intervals.length / 2)] ?? 0;
}

function countStates(records: MinuteFocusRecord[]): Record<FocusState, number> {
  return records.reduce<Record<FocusState, number>>(
    (acc, record) => {
      acc[record.state] += 1;
      return acc;
    },
    { focused: 0, distracted: 0, away: 0 },
  );
}

function dominantState(records: MinuteFocusRecord[]): FocusState {
  const counts = countStates(records);
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "away") as FocusState;
}

function longestRun(records: MinuteFocusRecord[], state: FocusState): number {
  let current = 0;
  let best = 0;
  for (const record of records) {
    if (record.state === state) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  return measured.length > 0 ? average(measured) : null;
}
