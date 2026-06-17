import type {
  ActivityWatchEvent,
  DailySummary,
  FocusSettings,
  FocusState,
  FocusSessionData,
  InputMetric,
  MinuteFocusRecord,
  WeeklySummary,
  WindowEventData,
} from "../types";

export const inputIdleThresholdSeconds = 60;

export const defaultSettings: FocusSettings = {
  workdayStartHour: 8,
  workdayEndHour: 22,
  nudgesEnabled: false,
  inputIdleThresholdSeconds,
  distractNudgeSeconds: 60,
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
): "focus" | "distract" | "unclassified" {
  return explainWindowScore(event, settings).score;
}

export interface WindowScoreExplanation {
  score: "focus" | "distract" | "unclassified";
  source:
    | "self"
    | "allowed-window"
    | "distracting-window"
    | "allowed-app"
    | "distracting-app"
    | "legacy"
    | "none";
  pattern?: string;
}

export function explainWindowScore(
  event: ActivityWatchEvent<WindowEventData> | undefined,
  settings: FocusSettings,
): WindowScoreExplanation {
  if (!event) return { score: "unclassified", source: "none" };
  const app = event.data.app ?? "";
  const title = event.data.title ?? "";
  const normalizedApp = app.toLowerCase();
  const normalizedTitle = title.toLowerCase();

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

  if (
    normalizedApp.includes("focus companion") ||
    normalizedApp.includes("focus-companion")
  ) {
    return { score: "focus", source: "self" };
  }

  return { score: "unclassified", source: "none" };
}

export function classifyMinute(
  windowEvent: ActivityWatchEvent<WindowEventData> | undefined,
  inputMetric: InputMetric | undefined,
  settings: FocusSettings,
): FocusState {
  if (!windowEvent && !inputMetric) return "distracted";
  if (inputMetric && inputMetric.idleSeconds >= settings.inputIdleThresholdSeconds) {
    return "distracted";
  }
  return scoreWindow(windowEvent, settings) === "distract" ? "distracted" : "focused";
}

export function activityScoreForState(state: FocusState): number {
  if (state === "focused") return 1;
  return 0.6;
}

export function aggregateDailyFocus(
  date: string,
  windowEvents: ActivityWatchEvent<WindowEventData>[],
  inputEvents: ActivityWatchEvent<InputMetric>[],
  settings: FocusSettings = defaultSettings,
  sessionEvents: ActivityWatchEvent<FocusSessionData>[] = [],
): DailySummary {
  const start = new Date(`${date}T00:00:00.000`);
  const end = new Date(start.getTime() + 24 * 60 * minuteMs);
  const timeline: MinuteFocusRecord[] = [];
  const observedMinutes = observedMinuteStarts(
    start,
    end,
    sessionEvents,
    windowEvents,
    inputEvents,
  );

  for (const timestamp of observedMinutes) {
    const minuteStart = new Date(timestamp);
    const windowEvent = findEventAt(windowEvents, minuteStart);
    const inputEvent = findEventAt(inputEvents, minuteStart);
    const inputMetric = inputEvent?.data;
    const state = classifyMinute(windowEvent, inputMetric, settings);

    timeline.push({
      minuteStart: minuteStart.toISOString(),
      app: windowEvent?.data.app ?? "",
      title: windowEvent?.data.title ?? "",
      state,
      activityScore: activityScoreForState(state),
      inputActive: Boolean(
        inputMetric && inputMetric.idleSeconds < settings.inputIdleThresholdSeconds,
      ),
    });
  }

  return summarizeTimeline(date, timeline);
}

export function summarizeTimeline(
  date: string,
  timeline: MinuteFocusRecord[],
): DailySummary {
  const counts = countStates(timeline);
  const totalMinutes = timeline.length;
  const focusRatio = totalMinutes === 0 ? 0 : counts.focused / totalMinutes;

  return {
    date,
    totalMinutes,
    focusedMinutes: counts.focused,
    distractedMinutes: counts.distracted,
    awayMinutes: 0,
    focusRatio,
    longestFocusRunMinutes: longestRun(timeline, "focused"),
    timeline,
  };
}

export function reclassifyDailySummary(
  summary: DailySummary,
  settings: FocusSettings,
): DailySummary {
  const timeline = summary.timeline.map((record) => {
    const windowEvent: ActivityWatchEvent<WindowEventData> | undefined = record.app || record.title
      ? {
          timestamp: record.minuteStart,
          duration: 60,
          data: { app: record.app, title: record.title },
        }
      : undefined;
    const inputMetric: InputMetric | undefined = record.inputActive
      ? { idleSeconds: 0, active: true }
      : undefined;
    const state = classifyMinute(windowEvent, inputMetric, settings);
    return {
      ...record,
      state,
      activityScore: activityScoreForState(state),
    };
  });
  return summarizeTimeline(summary.date, timeline);
}

export function buildWeeklySummary(
  weekLabel: string,
  days: DailySummary[],
): WeeklySummary {
  return { weekLabel, days };
}

export function compressTimeline(
  timeline: MinuteFocusRecord[],
  blockMinutes = 5,
): MinuteFocusRecord[] {
  const compressed: MinuteFocusRecord[] = [];
  for (let index = 0; index < timeline.length; index += blockMinutes) {
    const slice = timeline.slice(index, index + blockMinutes);
    if (slice.length === 0) continue;
    const dominant = dominantState(slice);
    compressed.push({
      ...slice[0],
      state: dominant,
      activityScore: average(slice.map((record) => record.activityScore)),
      inputActive: slice.some((record) => record.inputActive),
    });
  }
  return compressed;
}

function matchingPattern(value: string, patterns: string[]): string | undefined {
  return patterns.find((pattern) => value.includes(pattern.toLowerCase()));
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
  inputEvents: ActivityWatchEvent<InputMetric>[],
): number[] {
  const minutes = new Set<number>();
  const sessionMinutes = activeSessionMinuteStarts(dayStart, dayEnd, sessionEvents);
  const sourceEvents = sessionMinutes.length > 0
    ? []
    : [...windowEvents, ...inputEvents];

  for (const timestamp of sessionMinutes) {
    minutes.add(timestamp);
  }

  for (const event of sourceEvents) {
    addEventMinutes(minutes, dayStart, dayEnd, event);
  }

  return Array.from(minutes).sort((left, right) => left - right);
}

function activeSessionMinuteStarts(
  dayStart: Date,
  dayEnd: Date,
  sessionEvents: ActivityWatchEvent<FocusSessionData>[],
): number[] {
  const sortedEvents = [...sessionEvents].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
  const minutes = new Set<number>();

  for (let index = 0; index < sortedEvents.length; index += 1) {
    const event = sortedEvents[index];
    if (!event.data.running) continue;

    const eventStart = new Date(event.timestamp).getTime();
    const nextEvent = sortedEvents[index + 1];
    const nextStart = nextEvent ? new Date(nextEvent.timestamp).getTime() : undefined;
    let rawEnd = eventStart + Math.max(event.duration * 1000, 1);

    if (nextStart !== undefined && nextStart > eventStart) {
      rawEnd = nextEvent.data.running
        ? Math.max(rawEnd, nextStart)
        : nextStart;
    }

    addMinutesInRange(minutes, dayStart, dayEnd, eventStart, rawEnd);
  }

  return Array.from(minutes).sort((left, right) => left - right);
}

function addEventMinutes(
  minutes: Set<number>,
  dayStart: Date,
  dayEnd: Date,
  event: ActivityWatchEvent<unknown>,
): void {
  const eventStart = new Date(event.timestamp).getTime();
  const rawEnd = eventStart + Math.max(event.duration * 1000, 1);
  addMinutesInRange(minutes, dayStart, dayEnd, eventStart, rawEnd);
}

function addMinutesInRange(
  minutes: Set<number>,
  dayStart: Date,
  dayEnd: Date,
  rawStart: number,
  rawEnd: number,
): void {
  const start = Math.max(
    startOfMinute(new Date(rawStart)).getTime(),
    dayStart.getTime(),
  );
  const end = Math.min(
    startOfMinute(new Date(rawEnd - 1)).getTime(),
    dayEnd.getTime() - minuteMs,
  );
  for (let timestamp = start; timestamp <= end; timestamp += minuteMs) {
    minutes.add(timestamp);
  }
}

function countStates(records: MinuteFocusRecord[]): Record<FocusState, number> {
  return records.reduce<Record<FocusState, number>>(
    (counts, record) => {
      counts[record.state] += 1;
      return counts;
    },
    { focused: 0, distracted: 0 },
  );
}

function dominantState(records: MinuteFocusRecord[]): FocusState {
  const counts = countStates(records);
  return (Object.entries(counts).sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0] ?? "distracted") as FocusState;
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
