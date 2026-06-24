import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ActivityWatchClient, formatLocalDate, todayRange } from "../core/activitywatch";
import { startActivityWatchApp } from "../core/desktopBridge";
import { aggregateDailyFocus, buildWeeklySummary, summarizeTimeline } from "../core/focus";
import { getInputActivitySnapshot } from "../core/inputActivity";
import {
  summarizeObservedApps,
  summarizeObservedWindows,
  type ObservedApp,
  type ObservedWindow,
} from "../core/observedActivity";
import { t, type Locale } from "../i18n";
import type {
  ActivityWatchEvent,
  DailySummary,
  FocusInputEvents,
  FocusSessionData,
  FocusSettings,
  InputMetric,
  WeeklySummary,
  WindowEventData,
} from "../types";

export interface LoadedSummaries {
  dailySummary: DailySummary;
  weeklySummary: WeeklySummary;
  todayInputs: FocusInputEvents;
}

export interface ErrorNotice {
  message: string;
}

interface UseActivityWatchSyncOptions {
  aw: ActivityWatchClient;
  locale: Locale;
  settings: FocusSettings;
  connected: boolean;
  hasLoadedSummaries: boolean;
  todayInputsRef: RefObject<FocusInputEvents | null>;
  settingsRef: RefObject<FocusSettings>;
  localInputEventsRef: RefObject<ActivityWatchEvent<InputMetric>[]>;
  localSessionEventsRef: RefObject<ActivityWatchEvent<FocusSessionData>[]>;
  setConnected: (connected: boolean) => void;
  setStatus: (status: string) => void;
  setDailySummary: (summary: DailySummary | null) => void;
  setWeeklySummary: (
    summary: WeeklySummary | null | ((current: WeeklySummary | null) => WeeklySummary | null),
  ) => void;
}

export function useActivityWatchSync({
  aw,
  locale,
  settings,
  connected,
  hasLoadedSummaries,
  todayInputsRef,
  settingsRef,
  localInputEventsRef,
  localSessionEventsRef,
  setConnected,
  setStatus,
  setDailySummary,
  setWeeklySummary,
}: UseActivityWatchSyncOptions) {
  const inputBucketIdRef = useRef<string | undefined>(undefined);
  const awBusyRef = useRef(false);
  const [awBusy, setAwBusy] = useState(false);
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
  const [observedApps, setObservedApps] = useState<ObservedApp[]>([]);
  const [observedWindows, setObservedWindows] = useState<ObservedWindow[]>([]);

  const loadActivityWatchSummaries = useCallback(async (
    activeSettings: FocusSettings = settings,
  ): Promise<LoadedSummaries> => {
    const today = todayRange();
    const todayDate = today.date;
    const [windowEvents, storedInputEvents, storedSessionEvents, weeklyDays] = await Promise.all([
      aw.getTodayWindowEvents(),
      aw.getTodayInputEvents(),
      aw.getTodaySessionEvents(),
      loadWeeklySummaries(aw, activeSettings),
    ]);
    const inputEvents = mergeEvents(storedInputEvents, localInputEventsRef.current ?? []);
    const sessionEvents = mergeEvents(storedSessionEvents, localSessionEventsRef.current ?? []);
    const todaySummary = aggregateDailyFocus(
      todayDate,
      windowEvents,
      inputEvents,
      activeSettings,
      sessionEvents,
    );
    const mergedDays = weeklyDays.map((day) => (day.date === todayDate ? todaySummary : day));
    const nextWeeklySummary = buildWeeklySummary(
      `${mergedDays[0]?.date ?? todayDate} - ${mergedDays[6]?.date ?? todayDate}`,
      mergedDays,
    );
    return {
      dailySummary: todaySummary,
      weeklySummary: nextWeeklySummary,
      todayInputs: { date: todayDate, windowEvents, inputEvents, sessionEvents },
    };
  }, [aw, localInputEventsRef, localSessionEventsRef, settings]);

  const applyLoadedSummaries = useCallback(({ dailySummary, weeklySummary, todayInputs }: LoadedSummaries) => {
    todayInputsRef.current = todayInputs;
    setDailySummary(dailySummary);
    setWeeklySummary(weeklySummary);
    setObservedApps(summarizeObservedApps(todayInputs.windowEvents));
    setObservedWindows(summarizeObservedWindows(todayInputs.windowEvents));
  }, [
    setDailySummary,
    setWeeklySummary,
    todayInputsRef,
  ]);

  const applyInputEvents = useCallback((
    inputs: FocusInputEvents,
    activeSettings: FocusSettings = settings,
  ) => {
    const nextDaily = aggregateDailyFocus(
      inputs.date,
      inputs.windowEvents,
      inputs.inputEvents,
      activeSettings,
      inputs.sessionEvents,
    );
    todayInputsRef.current = inputs;
    setDailySummary(nextDaily);
    setWeeklySummary((current) => mergeTodayIntoWeekly(current, nextDaily));
  }, [
    setDailySummary,
    setWeeklySummary,
    settings,
    todayInputsRef,
  ]);

  const refreshObservedApps = useCallback(async () => {
    if (awBusyRef.current) return;
    awBusyRef.current = true;
    setAwBusy(true);
    setErrorNotice(null);
    try {
      setStatus(t(locale, "autoStartAw"));
      const startResult = await startActivityWatchApp();
      if (startResult === "browser-mode") {
        setStatus(t(locale, "awBrowserMode"));
      }
      await waitForActivityWatch(aw);
      setStatus(t(locale, "connectingAw"));
      const windowEvents = await aw.getTodayWindowEvents();
      setObservedApps(summarizeObservedApps(windowEvents));
      setObservedWindows(summarizeObservedWindows(windowEvents));
      setConnected(true);
      setStatus(t(locale, "loadedAwActivity"));
    } catch (error) {
      setConnected(false);
      const message = error instanceof Error ? `${t(locale, "awFailed")} ${error.message}` : t(locale, "awFailed");
      setStatus(message);
      setErrorNotice({ message });
    } finally {
      awBusyRef.current = false;
      setAwBusy(false);
    }
  }, [aw, locale, setConnected, setStatus]);

  const refreshActivityWatch = useCallback(async (): Promise<boolean> => {
    if (awBusyRef.current) return connected;
    awBusyRef.current = true;
    setAwBusy(true);
    setErrorNotice(null);
    try {
      setStatus(t(locale, "autoStartAw"));
      const startResult = await startActivityWatchApp();
      if (startResult === "browser-mode") {
        setStatus(t(locale, "awBrowserMode"));
      }
      await waitForActivityWatch(aw);
      setStatus(t(locale, "connectingAw"));
      setConnected(true);
      applyLoadedSummaries(await loadActivityWatchSummaries());
      setStatus(t(locale, "loadedAw"));
      return true;
    } catch (error) {
      setConnected(false);
      const message = error instanceof Error ? `${t(locale, "awFailed")} ${error.message}` : t(locale, "awFailed");
      setStatus(message);
      setErrorNotice({ message });
      return false;
    } finally {
      awBusyRef.current = false;
      setAwBusy(false);
    }
  }, [
    applyLoadedSummaries,
    aw,
    connected,
    loadActivityWatchSummaries,
    locale,
    setConnected,
    setStatus,
  ]);

  const appendSessionEvent = useCallback((
    running: boolean,
    sampledAt = new Date(),
  ) => {
    const date = formatLocalDate(sampledAt);
    const sessionEvent: ActivityWatchEvent<FocusSessionData> = {
      timestamp: sampledAt.toISOString(),
      duration: 0,
      data: { running },
    };
    localSessionEventsRef.current = keepTodayEvents(
      [...(localSessionEventsRef.current ?? []), sessionEvent],
      date,
    );
    const current = todayInputsRef.current?.date === date
      ? todayInputsRef.current
      : null;
    if (!current) return;
    applyInputEvents({
      ...current,
      sessionEvents: mergeEvents(current.sessionEvents, [sessionEvent]),
    }, settingsRef.current);
  }, [
    applyInputEvents,
    localSessionEventsRef,
    settingsRef,
    todayInputsRef,
  ]);

  const appendInputMetric = useCallback((metric: InputMetric, sampledAt = new Date()) => {
    const date = formatLocalDate(sampledAt);
    const inputEvent: ActivityWatchEvent<InputMetric> = {
      timestamp: sampledAt.toISOString(),
      duration: 65,
      data: metric,
    };
    localInputEventsRef.current = keepTodayEvents(
      [...(localInputEventsRef.current ?? []), inputEvent],
      date,
    );

    const current = todayInputsRef.current?.date === date
      ? todayInputsRef.current
      : {
          date,
          windowEvents: [],
          inputEvents: [],
          sessionEvents: localSessionEventsRef.current ?? [],
        };
    applyInputEvents(
      {
        ...current,
        inputEvents: mergeEvents(current.inputEvents, [inputEvent]),
      },
      settingsRef.current,
    );
  }, [
    applyInputEvents,
    localInputEventsRef,
    localSessionEventsRef,
    settingsRef,
    todayInputsRef,
  ]);

  const writeSessionBoundary = useCallback((running: boolean) => {
    appendSessionEvent(running);
    if (!connected) return;
    void aw.ensureSessionBucket("local")
      .then((bucketId) => aw.heartbeatSession(bucketId, running))
      .catch(() => {
        // The local boundary remains authoritative until ActivityWatch reconnects.
      });
  }, [appendSessionEvent, aw, connected]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const checkConnection = async () => {
      try {
        await aw.info();
        if (!cancelled) setConnected(true);
      } catch {
        if (!cancelled) setConnected(false);
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(checkConnection, 30_000);
      }
    };

    void checkConnection();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [aw, connected, setConnected]);

  useEffect(() => {
    if (!connected || !hasLoadedSummaries) return;
    let cancelled = false;
    let inFlight = false;

    const intervalId = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      loadActivityWatchSummaries()
        .then((summaries) => {
          if (!cancelled) {
            applyLoadedSummaries(summaries);
            setConnected(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setConnected(false);
          }
        })
        .finally(() => {
          inFlight = false;
        });
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    applyLoadedSummaries,
    connected,
    hasLoadedSummaries,
    loadActivityWatchSummaries,
    setConnected,
  ]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const pulse = async () => {
      const snapshot = getInputActivitySnapshot();
      if (!snapshot.available) {
        if (!cancelled) timeoutId = window.setTimeout(pulse, 60_000);
        return;
      }
      const metric: InputMetric = {
        idleSeconds: Math.round(snapshot.idleSeconds),
        active: snapshot.idleSeconds < settingsRef.current.inputIdleThresholdSeconds,
      };
      appendInputMetric(metric);
      try {
        inputBucketIdRef.current ??= await aw.ensureInputBucket("local");
        await aw.heartbeatInputMetric(inputBucketIdRef.current, metric);
      } catch {
        inputBucketIdRef.current = undefined;
      }
      if (!cancelled) timeoutId = window.setTimeout(pulse, 60_000);
    };

    void pulse();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [appendInputMetric, aw, connected, settingsRef]);

  const clearObservedActivity = useCallback(() => {
    setObservedApps([]);
    setObservedWindows([]);
  }, []);

  return {
    awBusy,
    errorNotice,
    observedApps,
    observedWindows,
    setErrorNotice,
    applyLoadedSummaries,
    applyInputEvents,
    refreshActivityWatch,
    refreshObservedApps,
    loadActivityWatchSummaries,
    appendSessionEvent,
    writeSessionBoundary,
    clearObservedActivity,
  };
}

async function loadWeeklySummaries(
  aw: ActivityWatchClient,
  settings: FocusSettings,
): Promise<DailySummary[]> {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return formatLocalDate(date);
  });

  const windowBucketId = await aw.findWindowBucket();
  const summaries = await Promise.all(
    days.map(async (date) => {
      const start = new Date(`${date}T00:00:00.000`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const [windowEvents, inputEvents, sessionEvents] = await Promise.all([
        windowBucketId ? aw.getEvents<WindowEventData>(windowBucketId, start, end) : Promise.resolve([]),
        aw.getEvents<InputMetric>(`focus-input_local`, start, end).catch(() => []),
        aw.getEvents<FocusSessionData>(`focus-companion-session_local`, start, end).catch(() => []),
      ]);
      return aggregateDailyFocus(date, windowEvents, inputEvents, settings, sessionEvents);
    }),
  );

  return summaries;
}

async function waitForActivityWatch(
  aw: ActivityWatchClient,
  retries = 12,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await aw.info();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 750));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ActivityWatch is not reachable.");
}

export function mergeEvents<TData>(
  ...groups: Array<ActivityWatchEvent<TData>[]>
): ActivityWatchEvent<TData>[] {
  const events = new Map<string, ActivityWatchEvent<TData>>();
  for (const event of groups.flat()) {
    const key = `${event.timestamp}:${JSON.stringify(event.data)}`;
    events.set(key, event);
  }
  return Array.from(events.values()).sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}

function keepTodayEvents<TData>(
  events: ActivityWatchEvent<TData>[],
  date: string,
): ActivityWatchEvent<TData>[] {
  return events.filter((event) => formatLocalDate(new Date(event.timestamp)) === date);
}

export function mergeTodayIntoWeekly(
  current: WeeklySummary | null,
  today: DailySummary,
): WeeklySummary {
  if (current) {
    const existingIndex = current.days.findIndex((day) => day.date === today.date);
    const days = existingIndex >= 0
      ? current.days.map((day) => (day.date === today.date ? today : day))
      : [...current.days, today].sort((left, right) => left.date.localeCompare(right.date)).slice(-7);
    return {
      weekLabel: `${days[0]?.date ?? today.date} - ${days[days.length - 1]?.date ?? today.date}`,
      days,
    };
  }

  const target = new Date(`${today.date}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(target);
    date.setDate(target.getDate() - (6 - index));
    const label = formatLocalDate(date);
    return label === today.date ? today : summarizeTimeline(label, []);
  });
  return buildWeeklySummary(`${days[0].date} - ${days[6].date}`, days);
}
