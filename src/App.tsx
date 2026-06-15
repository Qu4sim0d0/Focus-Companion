import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityWatchClient, formatLocalDate, todayRange } from "./core/activitywatch";
import {
  openAccessibilitySettings,
  openActivityWatchWindow,
  requestFocusNotificationPermission,
  startActivityWatchApp,
} from "./core/desktopBridge";
import {
  aggregateDailyFocus,
  buildWeeklySummary,
  defaultSettings,
  summarizeTimeline,
} from "./core/focus";
import { getInputActivitySnapshot } from "./core/inputActivity";
import { type NudgeTracker } from "./core/nudges";
import {
  observedAppMode,
  observedWindowMode,
  summarizeObservedApps,
  summarizeObservedWindows,
  type ObservedApp,
  type ObservedWindow,
} from "./core/observedActivity";
import {
  advanceFocusSessionClock,
  endFocusSessionClock,
  loadFocusSessionClock,
  pauseFocusSessionClock,
  persistFocusSessionClock,
  resetFocusSessionClock,
  resumeFocusSessionClock,
  startFocusSessionClock,
  type FocusSessionClock,
} from "./core/focusSession";
import { buildDailyMarkdown, buildWeeklyMarkdown, type ChartAsset, saveMarkdownReport } from "./core/report";
import {
  currentDailySummary,
  loadStoredState,
  normalizeSettings,
  saveStoredState,
} from "./core/storage";
import {
  downloadSettingsBackup,
  parseSettingsBackup,
  serializeSettingsBackup,
} from "./core/settingsBackup";
import { TimelineChartPanel, type ChartPanelHandle } from "./components/ChartPanel";
import { DailyBreakdownChart, WeeklyTrendChart } from "./components/SummaryCharts";
import { Layout, MainContent, Sidebar } from "./components/AppLayout";
import {
  InputActivityMetric,
  InputMonitoringStatus,
  LiveStatus,
  type FocusNudge,
} from "./components/LiveStatus";
import { QuickStart, SessionTotal } from "./components/SessionPanels";
import { t, type Locale } from "./i18n";
import type {
  ActivityWatchEvent,
  DailySummary,
  FocusInputEvents,
  FocusSessionData,
  FocusSettings,
  InputMetric,
  WeeklySummary,
  WindowEventData,
} from "./types";

const aw = new ActivityWatchClient();

interface LoadedSummaries {
  dailySummary: DailySummary;
  weeklySummary: WeeklySummary;
  todayInputs: FocusInputEvents;
}

interface ErrorNotice {
  message: string;
}

export function App() {
  const settingsImportRef = useRef<HTMLInputElement | null>(null);
  const inputBucketIdRef = useRef<string | undefined>(undefined);
  const chartsRef = useRef<Map<string, ChartPanelHandle>>(new Map());
  const todayInputsRef = useRef<FocusInputEvents | null>(null);
  const localInputEventsRef = useRef<ActivityWatchEvent<InputMetric>[]>([]);
  const localSessionEventsRef = useRef<ActivityWatchEvent<FocusSessionData>[]>([]);
  const awBusyRef = useRef(false);
  const sessionStartingRef = useRef(false);
  const monitoringReadyRef = useRef(false);
  const nudgeTrackerRef = useRef<NudgeTracker>({
    distractedSince: null,
    lastNudgeAt: null,
  });
  const focusSessionRef = useRef<FocusSessionClock | null>(null);
  if (!focusSessionRef.current) {
    focusSessionRef.current = loadFocusSessionClock(Date.now());
  }
  const [storedState] = useState(() => loadStoredState());
  const [locale, setLocale] = useState<Locale>(storedState.locale);
  const [settings, setSettings] = useState<FocusSettings>(storedState.settings);
  const [allowedAppsText, setAllowedAppsText] = useState(storedState.settings.allowedApps.join("\n"));
  const [distractingAppsText, setDistractingAppsText] = useState(storedState.settings.distractingApps.join("\n"));
  const [allowedWindowTitlesText, setAllowedWindowTitlesText] = useState(
    storedState.settings.allowedWindowTitles.join("\n"),
  );
  const [distractingWindowTitlesText, setDistractingWindowTitlesText] = useState(
    storedState.settings.distractingWindowTitles.join("\n"),
  );
  const [status, setStatus] = useState(() => t(storedState.locale, "ready"));
  const [connected, setConnected] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(
    currentDailySummary(storedState.dailySummary),
  );
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(storedState.weeklySummary);
  const [todayInputs, setTodayInputs] = useState<FocusInputEvents | null>(null);
  const [observedApps, setObservedApps] = useState<ObservedApp[]>([]);
  const [observedWindows, setObservedWindows] = useState<ObservedWindow[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "focus" | "distract">("all");
  const [windowSearch, setWindowSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<"all" | "focus" | "distract">("all");
  const [awBusy, setAwBusy] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
  const [focusNudge, setFocusNudge] = useState<FocusNudge | null>(null);
  const [clearDataArmed, setClearDataArmed] = useState(false);
  const [resetSettingsArmed, setResetSettingsArmed] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [focusSessionClock, setFocusSessionClock] = useState<FocusSessionClock>(
    () => focusSessionRef.current!,
  );
  const hasLoadedSummaries = dailySummary !== null;
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    document.body.style.overflow = settingsMenuOpen ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsMenuOpen]);

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
  }, [connected]);

  useEffect(() => {
    saveStoredState({
      locale,
      settings,
      dailySummary,
      weeklySummary,
    });
  }, [dailySummary, locale, settings, weeklySummary]);

  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 1, 0);
    const timeoutId = window.setTimeout(() => {
      const localToday = formatLocalDate(new Date());
      if (dailySummary && dailySummary.date !== localToday) {
        todayInputsRef.current = null;
        setTodayInputs(null);
        setDailySummary(null);
        setFocusNudge(null);
        nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
      }
      const nextFocusSession = resetFocusSessionClock(Date.now());
      focusSessionRef.current = nextFocusSession;
      setFocusSessionClock(nextFocusSession);
      persistFocusSessionClock(nextFocusSession);
    }, Math.max(1_000, nextDay.getTime() - now.getTime()));
    return () => window.clearTimeout(timeoutId);
  }, [dailySummary, focusSessionClock.date]);

  const loadActivityWatchSummaries = useCallback(async (
    activeSettings: FocusSettings = settings,
  ): Promise<LoadedSummaries> => {
    const today = todayRange();
    const todayDate = today.date;
    const [windowEvents, storedInputEvents, storedSessionEvents, weeklyDays] = await Promise.all([
      aw.getTodayWindowEvents(),
      aw.getTodayInputEvents(),
      aw.getTodaySessionEvents(),
      loadWeeklySummaries(activeSettings),
    ]);
    const inputEvents = mergeEvents(storedInputEvents, localInputEventsRef.current);
    const sessionEvents = mergeEvents(storedSessionEvents, localSessionEventsRef.current);
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
  }, [settings]);

  const applyLoadedSummaries = useCallback(({ dailySummary, weeklySummary, todayInputs }: LoadedSummaries) => {
    todayInputsRef.current = todayInputs;
    setDailySummary(dailySummary);
    setWeeklySummary(weeklySummary);
    setTodayInputs(todayInputs);
    setObservedApps(summarizeObservedApps(todayInputs.windowEvents));
    setObservedWindows(summarizeObservedWindows(todayInputs.windowEvents));
  }, []);

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
    setTodayInputs(inputs);
    setDailySummary(nextDaily);
    setWeeklySummary((current) => mergeTodayIntoWeekly(current, nextDaily));
  }, [settings]);

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
      await waitForActivityWatch();
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
  }, [locale]);

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
      await waitForActivityWatch();
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
  }, [applyLoadedSummaries, connected, loadActivityWatchSummaries, locale]);

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
  }, [applyLoadedSummaries, connected, hasLoadedSummaries, loadActivityWatchSummaries]);

  const saveRuleSettings = useCallback(async () => {
    const nextSettings: FocusSettings = {
      ...settings,
      allowedApps: parseRuleList(allowedAppsText),
      distractingApps: parseRuleList(distractingAppsText),
      allowedWindowTitles: parseRuleList(allowedWindowTitlesText),
      distractingWindowTitles: parseRuleList(distractingWindowTitlesText),
    };
    setSettings(nextSettings);
    if (connected) {
      try {
        applyLoadedSummaries(await loadActivityWatchSummaries(nextSettings));
      } catch {
        // Keep the saved rules even if ActivityWatch disconnects during recalculation.
      }
    } else if (todayInputs) {
      applyInputEvents(todayInputs, nextSettings);
    } else if (dailySummary || weeklySummary) {
      setDailySummary(null);
      setWeeklySummary(null);
      setStatus(t(locale, "rulesReloadRequired"));
      return;
    }
    setStatus(t(locale, "rulesSaved"));
  }, [
    allowedAppsText,
    allowedWindowTitlesText,
    applyLoadedSummaries,
    connected,
    dailySummary,
    distractingAppsText,
    distractingWindowTitlesText,
    loadActivityWatchSummaries,
    locale,
    settings,
    todayInputs,
    weeklySummary,
    applyInputEvents,
  ]);

  const updateNudgesEnabled = useCallback(async (enabled: boolean) => {
    setSettings((current) => ({ ...current, nudgesEnabled: enabled }));
    if (!enabled) {
      nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
      setFocusNudge(null);
      return;
    }
    const granted = await requestFocusNotificationPermission();
    setStatus(t(locale, granted ? "nudgePermissionEnabled" : "nudgePermissionUnavailable"));
  }, [locale]);

  const updateNudgeDelay = useCallback((seconds: number) => {
    setSettings((current) => ({ ...current, distractNudgeSeconds: seconds }));
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setFocusNudge(null);
  }, []);

  const updateWorkdayHour = useCallback((
    field: "workdayStartHour" | "workdayEndHour",
    hour: number,
  ) => {
    setSettings((current) => ({ ...current, [field]: hour }));
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setFocusNudge(null);
  }, []);

  const setObservedAppMode = useCallback((
    app: string,
    mode: "focus" | "distract",
  ) => {
    const sameApp = (value: string) => value.toLocaleLowerCase() === app.toLocaleLowerCase();
    const nextAllowed = settings.allowedApps.filter((value) => !sameApp(value));
    const nextDistracting = settings.distractingApps.filter((value) => !sameApp(value));
    if (mode === "focus") nextAllowed.push(app);
    if (mode === "distract") nextDistracting.push(app);
    const nextSettings: FocusSettings = {
      ...settings,
      allowedApps: nextAllowed,
      distractingApps: nextDistracting,
      rules: settings.rules.filter((rule) => !sameApp(rule.pattern)),
    };
    setSettings(nextSettings);
    setAllowedAppsText(nextAllowed.join("\n"));
    setDistractingAppsText(nextDistracting.join("\n"));
    if (todayInputs) {
      applyInputEvents(todayInputs, nextSettings);
    } else if (dailySummary || weeklySummary) {
      setDailySummary(null);
      setWeeklySummary(null);
    }
    setStatus(t(locale, "appRuleUpdated"));
  }, [
    applyInputEvents,
    dailySummary,
    locale,
    settings,
    todayInputs,
    weeklySummary,
  ]);

  const setObservedWindowMode = useCallback((
    item: ObservedWindow,
    mode: "focus" | "distract",
  ) => {
    const sameTitle = (value: string) =>
      value.toLocaleLowerCase() === item.title.toLocaleLowerCase();
    const nextAllowed = settings.allowedWindowTitles.filter((value) => !sameTitle(value));
    const nextDistracting = settings.distractingWindowTitles.filter((value) => !sameTitle(value));
    if (mode === "focus") nextAllowed.push(item.title);
    if (mode === "distract") nextDistracting.push(item.title);
    const nextSettings: FocusSettings = {
      ...settings,
      allowedWindowTitles: nextAllowed,
      distractingWindowTitles: nextDistracting,
      rules: settings.rules.filter((rule) => !(rule.matchTitle && sameTitle(rule.pattern))),
    };
    setSettings(nextSettings);
    setAllowedWindowTitlesText(nextAllowed.join("\n"));
    setDistractingWindowTitlesText(nextDistracting.join("\n"));
    if (todayInputs) {
      applyInputEvents(todayInputs, nextSettings);
    } else if (dailySummary || weeklySummary) {
      setDailySummary(null);
      setWeeklySummary(null);
    }
    setStatus(t(locale, "windowRuleUpdated"));
  }, [
    applyInputEvents,
    dailySummary,
    locale,
    settings,
    todayInputs,
    weeklySummary,
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
      [...localSessionEventsRef.current, sessionEvent],
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
  }, [applyInputEvents]);

  useEffect(() => {
    if (focusSessionClock.status !== "running") return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const pulse = async () => {
      const now = Date.now();
      const persistedClock = advanceFocusSessionClock(focusSessionRef.current!, now);
      focusSessionRef.current = persistedClock;
      persistFocusSessionClock(persistedClock);
      appendSessionEvent(true, new Date(now));
      if (connected) {
        try {
          const bucketId = await aw.ensureSessionBucket("local");
          await aw.heartbeatSession(bucketId, true);
        } catch {
          setConnected(false);
        }
      }
      if (!cancelled) timeoutId = window.setTimeout(pulse, 60_000);
    };

    void pulse();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [appendSessionEvent, connected, focusSessionClock.status]);

  const writeSessionBoundary = useCallback((running: boolean) => {
    appendSessionEvent(running);
    if (!connected) return;
    void aw.ensureSessionBucket("local")
      .then((bucketId) => aw.heartbeatSession(bucketId, running))
      .catch(() => {
        // The local boundary remains authoritative until ActivityWatch reconnects.
      });
  }, [appendSessionEvent, connected]);

  const pauseFocusSession = useCallback(() => {
    const now = Date.now();
    const next = pauseFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    writeSessionBoundary(false);
    setFocusNudge(null);
    setStatus(t(locale, "sessionPaused"));
  }, [locale, writeSessionBoundary]);

  useEffect(() => {
    if (
      focusSessionClock.status !== "running" ||
      connected ||
      !monitoringReadyRef.current ||
      sessionStartingRef.current
    ) {
      return;
    }
    pauseFocusSession();
    setStatus(t(locale, "sessionPausedMonitoringLost"));
  }, [connected, focusSessionClock.status, locale, pauseFocusSession]);

  const appendInputMetric = useCallback((metric: InputMetric, sampledAt = new Date()) => {
    const date = formatLocalDate(sampledAt);
    const inputEvent: ActivityWatchEvent<InputMetric> = {
      timestamp: sampledAt.toISOString(),
      duration: 65,
      data: metric,
    };
    localInputEventsRef.current = keepTodayEvents(
      [...localInputEventsRef.current, inputEvent],
      date,
    );

    const current = todayInputsRef.current?.date === date
      ? todayInputsRef.current
      : {
          date,
          windowEvents: [],
          inputEvents: [],
          sessionEvents: localSessionEventsRef.current,
        };
    applyInputEvents(
      {
        ...current,
        inputEvents: mergeEvents(current.inputEvents, [inputEvent]),
      },
      settingsRef.current,
    );
  }, [applyInputEvents]);

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
        active: snapshot.active,
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
  }, [appendInputMetric, connected]);

  const openPermissions = useCallback(async () => {
    const result = await openAccessibilitySettings();
    setStatus(result === "opened" ? t(locale, "permissionsOpened") : t(locale, "permissionsOpened"));
  }, [locale]);

  const openAwWindow = useCallback(async () => {
    const result = await openActivityWatchWindow();
    setStatus(result === "opened" ? t(locale, "openedAw") : t(locale, "awFailed"));
  }, [locale]);

  const prepareSessionMonitoring = useCallback(async (): Promise<boolean> => {
    if (sessionStartingRef.current) return false;
    sessionStartingRef.current = true;
    setSessionStarting(true);
    setErrorNotice(null);
    setStatus(t(locale, "sessionPreparing"));
    try {
      const awReady = await refreshActivityWatch();
      if (!awReady) return false;
      monitoringReadyRef.current = true;
      return true;
    } finally {
      sessionStartingRef.current = false;
      setSessionStarting(false);
    }
  }, [locale, refreshActivityWatch]);

  const startFocusSession = useCallback(async () => {
    if (!await prepareSessionMonitoring()) return;
    const now = Date.now();
    const next = startFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setStatus(t(locale, "sessionStarted"));
  }, [locale, prepareSessionMonitoring]);

  const resumeFocusSession = useCallback(async () => {
    if (!await prepareSessionMonitoring()) return;
    const now = Date.now();
    const next = resumeFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    setStatus(t(locale, "sessionResumed"));
  }, [locale, prepareSessionMonitoring]);

  const endFocusSession = useCallback(() => {
    const now = Date.now();
    const next = endFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    writeSessionBoundary(false);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setStatus(t(locale, "sessionEnded"));
  }, [locale, writeSessionBoundary]);

  const applySettingsBundle = useCallback(async (
    nextLocale: Locale,
    nextSettings: FocusSettings,
    successMessage: string,
  ) => {
    settingsRef.current = nextSettings;
    setLocale(nextLocale);
    setSettings(nextSettings);
    setAllowedAppsText(nextSettings.allowedApps.join("\n"));
    setDistractingAppsText(nextSettings.distractingApps.join("\n"));
    setAllowedWindowTitlesText(nextSettings.allowedWindowTitles.join("\n"));
    setDistractingWindowTitlesText(nextSettings.distractingWindowTitles.join("\n"));
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };

    if (connected) {
      try {
        applyLoadedSummaries(await loadActivityWatchSummaries(nextSettings));
      } catch {
        setDailySummary(null);
        setWeeklySummary(null);
      }
    } else if (todayInputsRef.current) {
      applyInputEvents(todayInputsRef.current, nextSettings);
    } else {
      setDailySummary(null);
      setWeeklySummary(null);
    }
    setStatus(successMessage);
  }, [
    applyInputEvents,
    applyLoadedSummaries,
    connected,
    loadActivityWatchSummaries,
  ]);

  const exportSettings = useCallback(() => {
    const filename = `focus-companion-settings-${formatLocalDate(new Date())}.json`;
    downloadSettingsBackup(filename, serializeSettingsBackup(locale, settings));
    setStatus(t(locale, "settingsExported"));
  }, [locale, settings]);

  const importSettings = useCallback(async (file: File) => {
    try {
      const imported = parseSettingsBackup(await file.text());
      await applySettingsBundle(
        imported.locale,
        imported.settings,
        t(imported.locale, "settingsImported"),
      );
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      setStatus(`${t(locale, "settingsImportFailed")}${detail}`);
    }
  }, [applySettingsBundle, locale]);

  const restoreDefaultSettings = useCallback(async () => {
    const nextSettings = normalizeSettings(defaultSettings);
    setResetSettingsArmed(false);
    await applySettingsBundle(locale, nextSettings, t(locale, "defaultsRestored"));
  }, [applySettingsBundle, locale]);

  const clearLocalAggregates = useCallback(() => {
    localInputEventsRef.current = [];
    localSessionEventsRef.current = [];
    todayInputsRef.current = null;
    chartsRef.current.clear();
    setTodayInputs(null);
    setDailySummary(null);
    setWeeklySummary(null);
    setObservedApps([]);
    setObservedWindows([]);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    const nextFocusSession = resetFocusSessionClock(Date.now());
    focusSessionRef.current = nextFocusSession;
    setFocusSessionClock(nextFocusSession);
    persistFocusSessionClock(nextFocusSession);
    setClearDataArmed(false);
    saveStoredState({ locale, settings, dailySummary: null, weeklySummary: null });
    setStatus(t(locale, "localDataCleared"));
  }, [locale, settings]);

  const exportDailyReport = useCallback(async () => {
    if (!dailySummary) {
      setStatus(t(locale, "noDailyData"));
      return;
    }
    const assets = collectChartAssets();
    const markdown = buildDailyMarkdown(dailySummary, assets);
    const saved = await saveMarkdownReport(`${dailySummary.date}.md`, markdown, assets, settings.reportDir);
    setStatus(saved ? `${t(locale, "savedReport")} ${saved}` : t(locale, "downloadedReport"));
  }, [dailySummary, locale, settings.reportDir]);

  const exportWeeklyReport = useCallback(async () => {
    if (!weeklySummary) {
      setStatus(t(locale, "noWeeklyData"));
      return;
    }
    const assets = collectChartAssets();
    const markdown = buildWeeklyMarkdown(weeklySummary, assets);
    const filename = `${weeklySummary.weekLabel.replaceAll(" ", "_")}.md`;
    const saved = await saveMarkdownReport(filename, markdown, assets, settings.reportDir);
    setStatus(saved ? `${t(locale, "savedReport")} ${saved}` : t(locale, "downloadedReport"));
  }, [locale, settings.reportDir, weeklySummary]);

  const registerChart = useCallback((handle: ChartPanelHandle) => {
    chartsRef.current.set(handle.filename, handle);
  }, []);

  const handleNudge = useCallback((nudge: FocusNudge | null) => {
    setFocusNudge(nudge);
  }, []);

  const collectChartAssets = (): ChartAsset[] =>
    Array.from(chartsRef.current.values()).map((handle) => ({
      filename: handle.filename,
      dataUrl: handle.getDataUrl(),
    }));

  const deferredAppSearch = useDeferredValue(appSearch);
  const deferredWindowSearch = useDeferredValue(windowSearch);
  const filteredApps = useMemo(() => {
    const query = deferredAppSearch.trim().toLocaleLowerCase();
    return observedApps.filter((app) => {
      const mode = observedAppMode(app.name, settings);
      return (appFilter === "all" || mode === appFilter) &&
        (!query || app.name.toLocaleLowerCase().includes(query));
    });
  }, [appFilter, deferredAppSearch, observedApps, settings]);
  const filteredWindows = useMemo(() => {
    const query = deferredWindowSearch.trim().toLocaleLowerCase();
    return observedWindows.filter((item) => {
      const mode = observedWindowMode(item, settings);
      const searchable = `${item.app} ${item.title}`.toLocaleLowerCase();
      return (windowFilter === "all" || mode === windowFilter) &&
        (!query || searchable.includes(query));
    });
  }, [deferredWindowSearch, observedWindows, settings, windowFilter]);

  return (
    <Layout
      locale={locale}
      connected={connected}
      settingsOpen={settingsMenuOpen}
      onOpenSettings={() => setSettingsMenuOpen(true)}
    >
      <MainContent>

      {errorNotice ? (
        <section className="error-banner" role="alert">
          <div>
            <strong>{t(locale, "awFailed")}</strong>
            <p>{errorNotice.message}</p>
          </div>
          <div className="error-actions">
            <button
              onClick={() => void refreshActivityWatch()}
              disabled={awBusy}
            >
              {t(locale, "retry")}
            </button>
            <button onClick={() => setErrorNotice(null)}>{t(locale, "dismiss")}</button>
          </div>
        </section>
      ) : null}

      {focusNudge ? (
        <section className="focus-nudge" role="status" aria-live="assertive">
          <div className="nudge-copy">
            <strong>{t(locale, "focusNudgeTitle")}</strong>
            <p>{t(locale, "focusNudgeBody")}</p>
            <span>
              {t(locale, "nudgeDurationLabel")} {formatShortDuration(focusNudge.distractedSeconds, locale)}
              {focusNudge.app ? ` · ${focusNudge.app}` : ""}
            </span>
          </div>
          <div className="nudge-actions">
            <button className="button-primary" onClick={() => setFocusNudge(null)}>
              {t(locale, "backToFocus")}
            </button>
            {focusNudge.app && observedAppMode(focusNudge.app, settings) !== "focus" ? (
              <button
                onClick={() => {
                  setObservedAppMode(focusNudge.app, "focus");
                  setFocusNudge(null);
                }}
              >
                {t(locale, "allowCurrentApp")}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="workspace-hero">
        <LiveStatus
          locale={locale}
          settings={settings}
          dailySummary={dailySummary}
          sessionRunning={focusSessionClock.status === "running"}
          nudgeTrackerRef={nudgeTrackerRef}
          onNudge={handleNudge}
        />
        <QuickStart
          locale={locale}
          clock={focusSessionClock}
          sessionStarting={sessionStarting}
          onStart={startFocusSession}
          onPause={pauseFocusSession}
          onResume={resumeFocusSession}
          onEnd={endFocusSession}
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel metric-panel">
          <p className="label">{t(locale, "today")}</p>
          <strong>{dailySummary?.date ?? "--"}</strong>
          <span>{dailySummary ? `${Math.round(dailySummary.focusRatio * 100)}% ${t(locale, "focusRatio")}` : t(locale, "emptyTitle")}</span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "focused")}</p>
          <strong>{dailySummary ? `${dailySummary.focusedMinutes}m` : "--"}</strong>
          <span>{dailySummary ? `${t(locale, "longestRun")} ${dailySummary.longestFocusRunMinutes}m` : t(locale, "emptyTitle")}</span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "distracted")}</p>
          <strong>{dailySummary ? `${dailySummary.distractedMinutes}m` : "--"}</strong>
          <span>
            {dailySummary
              ? `${t(locale, "away")} ${dailySummary.awayMinutes}m`
              : t(locale, "emptyTitle")}
          </span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "inputActivity")}</p>
          <InputActivityMetric locale={locale} />
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "todaySessionTotal")}</p>
          <strong><SessionTotal clock={focusSessionClock} /></strong>
          <span>{t(locale, "todaySessionTotalHelp")}</span>
        </div>
      </section>

      {dailySummary && weeklySummary ? (
        <section className="charts-grid">
          <TimelineChartPanel
            title={t(locale, "dailyTimeline")}
            filename={`${dailySummary.date}-timeline.png`}
            summary={dailySummary}
            locale={locale}
            onReady={registerChart}
            loadingLabel={t(locale, "chartLoading")}
          />
          <DailyBreakdownChart
            summary={dailySummary}
            filename={`${dailySummary.date}-breakdown.svg`}
            locale={locale}
            onReady={registerChart}
          />
          <WeeklyTrendChart
            summary={weeklySummary}
            filename={`${dailySummary.date}-weekly-trend.svg`}
            locale={locale}
            onReady={registerChart}
          />
        </section>
      ) : (
        <section className="panel empty-workspace">
          <div className="setup-heading">
            <p className="section-kicker">{t(locale, "emptyTitle")}</p>
            <h2>{t(locale, "setupTitle")}</h2>
            <p>{t(locale, "setupBody")}</p>
          </div>
        </section>
      )}

      <footer role="status" aria-live="polite">
        <span className="footer-status-dot" aria-hidden="true" />
        {status}
      </footer>
      </MainContent>

      <Sidebar
        open={settingsMenuOpen}
        labelledBy="settings-drawer-title"
        onClose={() => setSettingsMenuOpen(false)}
      >
          <div className="settings-drawer-header">
            <div>
              <p className="section-kicker">{t(locale, "settingsMenu")}</p>
              <h2 id="settings-drawer-title">{t(locale, "settingsPanelTitle")}</h2>
              <p>{t(locale, "settingsPanelHelp")}</p>
            </div>
            <button className="settings-drawer-close" onClick={() => setSettingsMenuOpen(false)}>
              {t(locale, "closeSettings")}
            </button>
          </div>

          <div className="settings-quick-grid">
            <section className="settings-quick-card" aria-labelledby="language-setting-title">
              <div>
                <strong id="language-setting-title">{t(locale, "language")}</strong>
                <span>{t(locale, "languageHelp")}</span>
              </div>
              <div className="language-switch" role="group" aria-label={t(locale, "language")}>
                <button data-active={locale === "zh"} onClick={() => setLocale("zh")}>中文</button>
                <button data-active={locale === "en"} onClick={() => setLocale("en")}>English</button>
              </div>
            </section>

            <section className="settings-quick-card settings-tools" aria-labelledby="monitoring-tools-title">
              <div>
                <strong id="monitoring-tools-title">{t(locale, "monitoringToolsTitle")}</strong>
                <span>{t(locale, "monitoringToolsHelp")}</span>
              </div>
              <div className="monitoring-status-row">
                <span data-ready={connected}>{t(locale, connected ? "connected" : "disconnected")}</span>
                <InputMonitoringStatus locale={locale} />
              </div>
              <div className="settings-tool-actions">
                <button onClick={() => void refreshActivityWatch()} disabled={awBusy}>
                  {awBusy ? t(locale, "loadingAw") : t(locale, "reconnectAw")}
                </button>
              </div>
            </section>

            <section className="settings-quick-card settings-tools" aria-labelledby="settings-tools-title">
              <div>
                <strong id="settings-tools-title">{t(locale, "toolsTitle")}</strong>
                <span>{t(locale, "toolsHelp")}</span>
              </div>
              <div className="settings-tool-actions">
                <button onClick={exportDailyReport} disabled={!dailySummary}>{t(locale, "exportDailyShort")}</button>
                <button onClick={exportWeeklyReport} disabled={!weeklySummary}>{t(locale, "exportWeeklyShort")}</button>
              </div>
            </section>
          </div>

          <section className="settings-stack">
            <details className="panel disclosure-panel">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">⌁</span>
              <div><strong>{t(locale, "criteriaTitle")}</strong><small>{t(locale, "criteriaSummary")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content rules-panel">
            <p>{t(locale, "criteriaBody")}</p>
            <div className="nudge-settings">
              <div className="nudge-settings-heading">
                <div>
                  <strong>{t(locale, "nudgeSettingsTitle")}</strong>
                  <p>{t(locale, "nudgeSettingsHelp")}</p>
                </div>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={settings.nudgesEnabled}
                    onChange={(event) => void updateNudgesEnabled(event.target.checked)}
                  />
                  <span aria-hidden="true" />
                  {t(locale, "nudgesEnabled")}
                </label>
              </div>
              <div className="nudge-controls">
                <label className="threshold-control">
                  <span>
                    {t(locale, "nudgeDelayLabel")} <b>{formatShortDuration(settings.distractNudgeSeconds, locale)}</b>
                  </span>
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="30"
                    disabled={!settings.nudgesEnabled}
                    value={settings.distractNudgeSeconds}
                    onChange={(event) => updateNudgeDelay(Number(event.target.value))}
                  />
                </label>
                <label className="time-control">
                  <span>{t(locale, "workdayStartLabel")}</span>
                  <select
                    disabled={!settings.nudgesEnabled}
                    value={settings.workdayStartHour}
                    onChange={(event) => updateWorkdayHour("workdayStartHour", Number(event.target.value))}
                  >
                    {hourOptions()}
                  </select>
                </label>
                <label className="time-control">
                  <span>{t(locale, "workdayEndLabel")}</span>
                  <select
                    disabled={!settings.nudgesEnabled}
                    value={settings.workdayEndHour}
                    onChange={(event) => updateWorkdayHour("workdayEndHour", Number(event.target.value))}
                  >
                    {hourOptions()}
                  </select>
                </label>
              </div>
            </div>
            <p className="rules-help">{t(locale, "rulesHelp")}</p>
            <div className="rules-grid">
              <label>
                <span>{t(locale, "allowedApps")}</span>
                <textarea value={allowedAppsText} onChange={(event) => setAllowedAppsText(event.target.value)} />
              </label>
              <label>
                <span>{t(locale, "distractingApps")}</span>
                <textarea value={distractingAppsText} onChange={(event) => setDistractingAppsText(event.target.value)} />
              </label>
              <label>
                <span>{t(locale, "allowedWindowTitles")}</span>
                <small>{t(locale, "allowedWindowTitlesHelp")}</small>
                <textarea
                  value={allowedWindowTitlesText}
                  onChange={(event) => setAllowedWindowTitlesText(event.target.value)}
                  placeholder={t(locale, "allowedWindowTitlesPlaceholder")}
                />
              </label>
              <label>
                <span>{t(locale, "distractingWindowTitles")}</span>
                <small>{t(locale, "distractingWindowTitlesHelp")}</small>
                <textarea
                  value={distractingWindowTitlesText}
                  onChange={(event) => setDistractingWindowTitlesText(event.target.value)}
                  placeholder={t(locale, "distractingWindowTitlesPlaceholder")}
                />
              </label>
            </div>
            <button className="button-primary" onClick={saveRuleSettings}>{t(locale, "saveRules")}</button>
          </div>
            </details>

            <details className="panel disclosure-panel">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">▦</span>
              <div><strong>{t(locale, "awAppsTitle")}</strong><small>{t(locale, "awAppsSummary")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content aw-apps-panel">
            <p className="rules-help">{t(locale, "awAppsHelp")}</p>
            <div className="aw-app-toolbar">
              <label className="app-search">
                <span className="sr-only">{t(locale, "searchApps")}</span>
                <input
                  type="search"
                  placeholder={t(locale, "searchApps")}
                  value={appSearch}
                  onChange={(event) => setAppSearch(event.target.value)}
                />
              </label>
              <div className="filter-pills" role="group" aria-label={t(locale, "filterApps")}>
                {(["all", "focus", "distract"] as const).map((filter) => (
                  <button
                    key={filter}
                    data-active={appFilter === filter}
                    onClick={() => setAppFilter(filter)}
                  >
                    {t(locale, `appFilter${filter[0].toUpperCase()}${filter.slice(1)}` as
                      | "appFilterAll"
                      | "appFilterFocus"
                      | "appFilterDistract")}
                  </button>
                ))}
              </div>
              <button onClick={refreshObservedApps} disabled={awBusy}>
                {awBusy ? t(locale, "refreshingAwApps") : t(locale, "refreshAwApps")}
              </button>
            </div>
            {observedApps.length > 0 ? (
              <>
                <p className="app-count">{t(locale, "showingApps")} {filteredApps.length}/{observedApps.length}</p>
                <div className="aw-app-list">
                  {filteredApps.map((app) => {
                    const mode = observedAppMode(app.name, settings);
                    return (
                      <div className="aw-app-row" key={app.name}>
                        <div>
                          <strong>{app.name}</strong>
                          <span>{formatAppDuration(app.seconds, locale)}</span>
                        </div>
                        <div className="app-mode-control">
                          <button data-active={mode === "focus"} onClick={() => setObservedAppMode(app.name, "focus")}>{t(locale, "appModeFocus")}</button>
                          <button data-active={mode === "distract"} onClick={() => setObservedAppMode(app.name, "distract")}>{t(locale, "appModeDistract")}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <p className="aw-apps-empty">{t(locale, "awAppsEmpty")}</p>}
          </div>
            </details>

            <details className="panel disclosure-panel">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">▤</span>
              <div><strong>{t(locale, "awWindowsTitle")}</strong><small>{t(locale, "awWindowsSummary")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content aw-apps-panel">
            <p className="rules-help">{t(locale, "awWindowsHelp")}</p>
            <div className="aw-app-toolbar">
              <label className="app-search">
                <span className="sr-only">{t(locale, "searchWindows")}</span>
                <input
                  type="search"
                  placeholder={t(locale, "searchWindows")}
                  value={windowSearch}
                  onChange={(event) => setWindowSearch(event.target.value)}
                />
              </label>
              <div className="filter-pills" role="group" aria-label={t(locale, "filterWindows")}>
                {(["all", "focus", "distract"] as const).map((filter) => (
                  <button
                    key={filter}
                    data-active={windowFilter === filter}
                    onClick={() => setWindowFilter(filter)}
                  >
                    {t(locale, `appFilter${filter[0].toUpperCase()}${filter.slice(1)}` as
                      | "appFilterAll"
                      | "appFilterFocus"
                      | "appFilterDistract")}
                  </button>
                ))}
              </div>
              <button onClick={refreshObservedApps} disabled={awBusy}>
                {awBusy ? t(locale, "refreshingAwApps") : t(locale, "refreshAwWindows")}
              </button>
            </div>
            {observedWindows.length > 0 ? (
              <>
                <p className="app-count">{t(locale, "showingWindows")} {filteredWindows.length}/{observedWindows.length}</p>
                <div className="aw-app-list">
                  {filteredWindows.map((item) => {
                    const mode = observedWindowMode(item, settings);
                    return (
                      <div className="aw-app-row aw-window-row" key={`${item.app}:${item.title}`}>
                        <div>
                          <strong title={item.title}>{item.title}</strong>
                          <span>{item.app} · {formatAppDuration(item.seconds, locale)}</span>
                        </div>
                        <div className="app-mode-control">
                          <button data-active={mode === "focus"} onClick={() => setObservedWindowMode(item, "focus")}>{t(locale, "appModeFocus")}</button>
                          <button data-active={mode === "distract"} onClick={() => setObservedWindowMode(item, "distract")}>{t(locale, "appModeDistract")}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <p className="aw-apps-empty">{t(locale, "awWindowsEmpty")}</p>}
          </div>
            </details>

            <details className="panel disclosure-panel">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">FC</span>
              <div><strong>{t(locale, "dataTitle")}</strong><small>{t(locale, "dataSummary")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content data-panel">
            <div>
              <p>{t(locale, "dataBody")}</p>
              <p className="data-privacy">{t(locale, "backupPrivacy")}</p>
            </div>
            <div className="data-actions">
              <button className="button-primary" onClick={exportSettings}>{t(locale, "exportSettings")}</button>
              <button onClick={() => settingsImportRef.current?.click()}>{t(locale, "importSettings")}</button>
              <button
                onClick={() => {
                  setResetSettingsArmed(true);
                  setClearDataArmed(false);
                }}
              >
                {t(locale, "restoreDefaults")}
              </button>
              <button
                className="button-danger-quiet"
                onClick={() => {
                  setClearDataArmed(true);
                  setResetSettingsArmed(false);
                }}
              >
                {t(locale, "clearLocalData")}
              </button>
              <input
                ref={settingsImportRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (file) void importSettings(file).finally(() => {
                    input.value = "";
                  });
                }}
              />
            </div>
            {resetSettingsArmed ? (
              <div className="confirm-panel" role="alert">
                <div>
                  <strong>{t(locale, "restoreDefaultsConfirmTitle")}</strong>
                  <p>{t(locale, "restoreDefaultsConfirmBody")}</p>
                </div>
                <div>
                  <button className="button-danger" onClick={() => void restoreDefaultSettings()}>
                    {t(locale, "confirmRestore")}
                  </button>
                  <button onClick={() => setResetSettingsArmed(false)}>{t(locale, "cancel")}</button>
                </div>
              </div>
            ) : null}
            {clearDataArmed ? (
              <div className="confirm-panel" role="alert">
                <div>
                  <strong>{t(locale, "clearLocalConfirmTitle")}</strong>
                  <p>{t(locale, "clearLocalConfirmBody")}</p>
                </div>
                <div>
                  <button className="button-danger" onClick={clearLocalAggregates}>
                    {t(locale, "confirmClear")}
                  </button>
                  <button onClick={() => setClearDataArmed(false)}>{t(locale, "cancel")}</button>
                </div>
              </div>
            ) : null}
          </div>
            </details>

            <details className="panel disclosure-panel">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">?</span>
              <div><strong>{t(locale, "introTitle")}</strong><small>{t(locale, "introSummary")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content intro-panel">
            <p>{t(locale, "introBody")}</p>
            <ul>
              <li>{t(locale, "introFeatureInput")}</li>
              <li>{t(locale, "introFeatureActivity")}</li>
              <li>{t(locale, "introFeatureReports")}</li>
              <li>{t(locale, "introPrivacy")}</li>
              <li>{t(locale, "introObservedTime")}</li>
            </ul>
            <div className="about-actions">
              <button onClick={openAwWindow}>{t(locale, "openAw")}</button>
              <button onClick={openPermissions}>{t(locale, "openPermissions")}</button>
            </div>
          </div>
            </details>
          </section>
      </Sidebar>
    </Layout>
  );
}

async function loadWeeklySummaries(settings: FocusSettings): Promise<DailySummary[]> {
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

async function waitForActivityWatch(retries = 12): Promise<void> {
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

function parseRuleList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAppDuration(seconds: number, locale: Locale): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return locale === "zh" ? `今日 ${minutes} 分钟` : `${minutes} min today`;
}

function mergeEvents<TData>(
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

function mergeTodayIntoWeekly(
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

function formatShortDuration(seconds: number, locale: Locale): string {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  if (roundedSeconds < 60) {
    return locale === "zh" ? `${roundedSeconds} 秒` : `${roundedSeconds}s`;
  }
  const minutes = Math.max(1, Math.round(roundedSeconds / 60));
  return locale === "zh" ? `${minutes} 分钟` : `${minutes} min`;
}

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => (
    <option key={hour} value={hour}>
      {String(hour).padStart(2, "0")}:00
    </option>
  ));
}
