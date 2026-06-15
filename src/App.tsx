import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityWatchClient, formatLocalDate, todayRange } from "./core/activitywatch";
import { CameraMetricSource } from "./core/camera";
import { buildCameraCalibration } from "./core/cameraCalibration";
import {
  openAccessibilitySettings,
  openActivityWatchWindow,
  requestFocusNotificationPermission,
  sendFocusNotification,
  startActivityWatchApp,
} from "./core/desktopBridge";
import {
  aggregateDailyFocus,
  buildWeeklySummary,
  defaultSettings,
  explainWindowScore,
  summarizeTimeline,
} from "./core/focus";
import {
  evaluateNudge,
  isFreshTimestamp,
  isWithinWorkday,
  type NudgeTracker,
} from "./core/nudges";
import {
  advanceOpenTimer,
  loadOpenTimer,
  persistOpenTimer,
  resetOpenTimer,
  type OpenTimerState,
} from "./core/openTimer";
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
import { buildSimulatedFocusInputs } from "./core/simulation";
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
import { describeCameraError } from "./core/userErrors";
import { ChartPanel, type ChartPanelHandle } from "./components/ChartPanel";
import { DailyBreakdownChart, WeeklyTrendChart } from "./components/SummaryCharts";
import { dailyTimelineOption } from "./components/charts";
import { t, type Locale } from "./i18n";
import type {
  ActivityWatchEvent,
  CameraMetric,
  DailySummary,
  FocusInputEvents,
  FocusSessionData,
  FocusSettings,
  WeeklySummary,
  WindowEventData,
} from "./types";

const aw = new ActivityWatchClient();
const calibrationSampleTarget = 8;

interface LoadedSummaries {
  dailySummary: DailySummary;
  weeklySummary: WeeklySummary;
  todayInputs: FocusInputEvents;
}

interface ObservedApp {
  name: string;
  seconds: number;
}

interface SimulationSnapshot {
  inputs: FocusInputEvents | null;
  dailySummary: DailySummary | null;
  weeklySummary: WeeklySummary | null;
}

interface ErrorNotice {
  source: "aw" | "camera";
  message: string;
}

interface FocusNudge {
  app: string;
  distractedSeconds: number;
}

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const settingsImportRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<CameraMetricSource | null>(null);
  const cameraTickRef = useRef<number | undefined>(undefined);
  const noFaceSinceRef = useRef<number | null>(null);
  const chartsRef = useRef<Map<string, ChartPanelHandle>>(new Map());
  const todayInputsRef = useRef<FocusInputEvents | null>(null);
  const localCameraEventsRef = useRef<ActivityWatchEvent<CameraMetric>[]>([]);
  const localSessionEventsRef = useRef<ActivityWatchEvent<FocusSessionData>[]>([]);
  const simulationSnapshotRef = useRef<SimulationSnapshot | null>(null);
  const calibrationActiveRef = useRef(false);
  const calibrationSamplesRef = useRef<CameraMetric[]>([]);
  const awBusyRef = useRef(false);
  const cameraStartingRef = useRef(false);
  const nudgeTrackerRef = useRef<NudgeTracker>({
    distractedSince: null,
    lastNudgeAt: null,
  });
  const openTimerRef = useRef<OpenTimerState | null>(null);
  const focusSessionRef = useRef<FocusSessionClock | null>(null);
  if (!openTimerRef.current) {
    openTimerRef.current = loadOpenTimer(
      Date.now(),
      typeof document === "undefined" || document.visibilityState !== "hidden",
    );
  }
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
  const [attentionThreshold, setAttentionThreshold] = useState(storedState.settings.attentionThreshold);
  const [status, setStatus] = useState(() => t(storedState.locale, "ready"));
  const [connected, setConnected] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraMetric, setCameraMetric] = useState<CameraMetric | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(
    currentDailySummary(storedState.dailySummary),
  );
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(storedState.weeklySummary);
  const [todayInputs, setTodayInputs] = useState<FocusInputEvents | null>(null);
  const [observedApps, setObservedApps] = useState<ObservedApp[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "focus" | "neutral" | "distract">("all");
  const [simulationMode, setSimulationMode] = useState(false);
  const [awBusy, setAwBusy] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
  const [focusNudge, setFocusNudge] = useState<FocusNudge | null>(null);
  const [clearDataArmed, setClearDataArmed] = useState(false);
  const [resetSettingsArmed, setResetSettingsArmed] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [openedTodayMs, setOpenedTodayMs] = useState(openTimerRef.current.totalMs);
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
    const updateClock = () => {
      const now = Date.now();
      const next = advanceOpenTimer(
        openTimerRef.current!,
        now,
        typeof document === "undefined" || document.visibilityState !== "hidden",
      );
      openTimerRef.current = next;
      persistOpenTimer(next);
      setOpenedTodayMs(next.totalMs);
      const nextFocusSession = advanceFocusSessionClock(focusSessionRef.current!, now);
      focusSessionRef.current = nextFocusSession;
      persistFocusSessionClock(nextFocusSession);
      setFocusSessionClock(nextFocusSession);
      setNowMs(now);
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1_000);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateClock);
      updateClock();
    };
  }, []);

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
    const snapshot = simulationSnapshotRef.current;
    saveStoredState({
      locale,
      settings,
      dailySummary: simulationMode ? snapshot?.dailySummary ?? null : dailySummary,
      weeklySummary: simulationMode ? snapshot?.weeklySummary ?? null : weeklySummary,
    });
  }, [dailySummary, locale, settings, simulationMode, weeklySummary]);

  const localToday = formatLocalDate(new Date(nowMs));
  useEffect(() => {
    if (simulationMode || !dailySummary || dailySummary.date === localToday) return;
    todayInputsRef.current = null;
    setTodayInputs(null);
    setDailySummary(null);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
  }, [dailySummary, localToday, simulationMode]);

  const loadActivityWatchSummaries = useCallback(async (
    activeSettings: FocusSettings = settings,
  ): Promise<LoadedSummaries> => {
    const today = todayRange();
    const todayDate = today.date;
    const [windowEvents, storedCameraEvents, storedSessionEvents, weeklyDays] = await Promise.all([
      aw.getTodayWindowEvents(),
      aw.getTodayCameraEvents(),
      aw.getTodaySessionEvents(),
      loadWeeklySummaries(activeSettings),
    ]);
    const cameraEvents = mergeEvents(storedCameraEvents, localCameraEventsRef.current);
    const sessionEvents = mergeEvents(storedSessionEvents, localSessionEventsRef.current);
    const todaySummary = aggregateDailyFocus(
      todayDate,
      windowEvents,
      cameraEvents,
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
      todayInputs: { date: todayDate, windowEvents, cameraEvents, sessionEvents },
    };
  }, [settings]);

  const applyLoadedSummaries = useCallback(({ dailySummary, weeklySummary, todayInputs }: LoadedSummaries) => {
    todayInputsRef.current = todayInputs;
    setDailySummary(dailySummary);
    setWeeklySummary(weeklySummary);
    setTodayInputs(todayInputs);
    setObservedApps(summarizeObservedApps(todayInputs.windowEvents));
  }, []);

  const applyInputEvents = useCallback((
    inputs: FocusInputEvents,
    activeSettings: FocusSettings = settings,
  ) => {
    const nextDaily = aggregateDailyFocus(
      inputs.date,
      inputs.windowEvents,
      inputs.cameraEvents,
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
      setConnected(true);
      setStatus(t(locale, "loadedAwApps"));
    } catch (error) {
      setConnected(false);
      const message = error instanceof Error ? `${t(locale, "awFailed")} ${error.message}` : t(locale, "awFailed");
      setStatus(message);
      setErrorNotice({ source: "aw", message });
    } finally {
      awBusyRef.current = false;
      setAwBusy(false);
    }
  }, [locale]);

  const refreshActivityWatch = useCallback(async () => {
    if (simulationMode) {
      await refreshObservedApps();
      return;
    }
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
      setConnected(true);
      applyLoadedSummaries(await loadActivityWatchSummaries());
      setStatus(t(locale, "loadedAw"));
    } catch (error) {
      setConnected(false);
      const message = error instanceof Error ? `${t(locale, "awFailed")} ${error.message}` : t(locale, "awFailed");
      setStatus(message);
      setErrorNotice({ source: "aw", message });
    } finally {
      awBusyRef.current = false;
      setAwBusy(false);
    }
  }, [applyLoadedSummaries, loadActivityWatchSummaries, locale, refreshObservedApps, simulationMode]);

  useEffect(() => {
    if (!connected || !hasLoadedSummaries || simulationMode) return;
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
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyLoadedSummaries, connected, hasLoadedSummaries, loadActivityWatchSummaries, simulationMode]);

  const saveRuleSettings = useCallback(async () => {
    const nextSettings: FocusSettings = {
      ...settings,
      attentionThreshold,
      allowedApps: parseRuleList(allowedAppsText),
      distractingApps: parseRuleList(distractingAppsText),
      allowedWindowTitles: parseRuleList(allowedWindowTitlesText),
      distractingWindowTitles: parseRuleList(distractingWindowTitlesText),
    };
    setSettings(nextSettings);
    if (simulationMode && todayInputsRef.current) {
      applyInputEvents(todayInputsRef.current, nextSettings);
    } else if (connected) {
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
    attentionThreshold,
    connected,
    dailySummary,
    distractingAppsText,
    distractingWindowTitlesText,
    loadActivityWatchSummaries,
    locale,
    settings,
    simulationMode,
    todayInputs,
    weeklySummary,
    applyInputEvents,
  ]);

  const updateAttentionThreshold = useCallback((nextThreshold: number) => {
    setAttentionThreshold(nextThreshold);
    const nextSettings = { ...settings, attentionThreshold: nextThreshold };
    setSettings(nextSettings);
    if (todayInputs) {
      applyInputEvents(todayInputs, nextSettings);
    } else if (dailySummary || weeklySummary) {
      setDailySummary(null);
      setWeeklySummary(null);
      setStatus(t(locale, "rulesReloadRequired"));
    }
  }, [applyInputEvents, dailySummary, locale, settings, todayInputs, weeklySummary]);

  const updateAwaySeconds = useCallback((nextAwaySeconds: number) => {
    const nextSettings = { ...settings, awaySeconds: nextAwaySeconds };
    setSettings(nextSettings);
    if (todayInputs) {
      applyInputEvents(todayInputs, nextSettings);
    } else if (dailySummary || weeklySummary) {
      setDailySummary(null);
      setWeeklySummary(null);
      setStatus(t(locale, "rulesReloadRequired"));
    }
  }, [applyInputEvents, dailySummary, locale, settings, todayInputs, weeklySummary]);

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
    mode: "focus" | "neutral" | "distract",
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
    if (focusSessionClock.status !== "running" || simulationMode) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const pulse = async () => {
      appendSessionEvent(true);
      if (connected) {
        try {
          const bucketId = await aw.ensureSessionBucket("local");
          await aw.heartbeatSession(bucketId, true);
        } catch {
          // Keep the local session active while ActivityWatch reconnects.
        }
      }
      if (!cancelled) timeoutId = window.setTimeout(pulse, 30_000);
    };

    void pulse();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [appendSessionEvent, connected, focusSessionClock.status, simulationMode]);

  const writeSessionBoundary = useCallback((running: boolean) => {
    appendSessionEvent(running);
    if (!connected) return;
    void aw.ensureSessionBucket("local")
      .then((bucketId) => aw.heartbeatSession(bucketId, running))
      .catch(() => {
        // The local boundary remains authoritative until ActivityWatch reconnects.
      });
  }, [appendSessionEvent, connected]);

  const startFocusSession = useCallback(() => {
    if (simulationMode) return;
    const now = Date.now();
    const next = startFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setStatus(t(locale, "sessionStarted"));
  }, [locale, simulationMode]);

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

  const resumeFocusSession = useCallback(() => {
    const now = Date.now();
    const next = resumeFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    setStatus(t(locale, "sessionResumed"));
  }, [locale]);

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

  const appendLiveCameraMetric = useCallback((metric: CameraMetric, sampledAt = new Date()) => {
    const date = formatLocalDate(sampledAt);
    const cameraEvent: ActivityWatchEvent<CameraMetric> = {
      timestamp: sampledAt.toISOString(),
      duration: 0,
      data: metric,
    };
    localCameraEventsRef.current = keepTodayEvents(
      [...localCameraEventsRef.current, cameraEvent],
      date,
    );

    const current = todayInputsRef.current?.date === date
      ? todayInputsRef.current
      : {
          date,
          windowEvents: [],
          cameraEvents: [],
          sessionEvents: localSessionEventsRef.current,
        };
    applyInputEvents(
      {
        ...current,
        cameraEvents: mergeEvents(current.cameraEvents, [cameraEvent]),
      },
      settingsRef.current,
    );
  }, [applyInputEvents]);

  const startSimulation = useCallback(() => {
    if (focusSessionClock.status !== "idle") return;
    if (!simulationMode) {
      simulationSnapshotRef.current = {
        inputs: todayInputsRef.current,
        dailySummary,
        weeklySummary,
      };
    }
    if (cameraTickRef.current) window.clearTimeout(cameraTickRef.current);
    cameraTickRef.current = undefined;
    cameraRef.current?.stop();
    cameraRef.current = null;
    calibrationActiveRef.current = false;
    calibrationSamplesRef.current = [];
    setCalibrationActive(false);
    setCalibrationProgress(0);
    setCameraRunning(false);
    const inputs = buildSimulatedFocusInputs(new Date(), 45);
    const latestMetric = [...inputs.cameraEvents]
      .reverse()
      .find((event) => event.data.present)?.data ?? null;
    setSimulationMode(true);
    setCameraMetric(latestMetric);
    applyInputEvents(inputs);
    setStatus(t(locale, "simulationLoaded"));
    setErrorNotice(null);
  }, [
    applyInputEvents,
    dailySummary,
    focusSessionClock.status,
    locale,
    simulationMode,
    weeklySummary,
  ]);

  const restoreSimulationSnapshot = useCallback(() => {
    const snapshot = simulationSnapshotRef.current;
    simulationSnapshotRef.current = null;
    setSimulationMode(false);
    setCameraMetric(null);
    todayInputsRef.current = snapshot?.inputs ?? null;
    setTodayInputs(snapshot?.inputs ?? null);
    setDailySummary(snapshot?.dailySummary ?? null);
    setWeeklySummary(snapshot?.weeklySummary ?? null);
  }, []);

  const stopSimulation = useCallback(() => {
    restoreSimulationSnapshot();
    setStatus(t(locale, "simulationStopped"));
  }, [locale, restoreSimulationSnapshot]);

  const openPermissions = useCallback(async () => {
    const result = await openAccessibilitySettings();
    setStatus(result === "opened" ? t(locale, "permissionsOpened") : t(locale, "permissionsOpened"));
  }, [locale]);

  const openAwWindow = useCallback(async () => {
    const result = await openActivityWatchWindow();
    setStatus(result === "opened" ? t(locale, "openedAw") : t(locale, "awFailed"));
  }, [locale]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || cameraStartingRef.current || cameraRunning) return;
    cameraStartingRef.current = true;
    setCameraStarting(true);
    setErrorNotice(null);
    noFaceSinceRef.current = null;
    try {
      if (simulationMode) {
        restoreSimulationSnapshot();
      }
      setStatus(t(locale, "startingCamera"));
      const source = new CameraMetricSource(settingsRef.current.cameraCalibration);
      await source.start(videoRef.current);
      cameraRef.current = source;
      setCameraRunning(true);
      let bucketId: string | undefined;
      try {
        bucketId = await aw.ensureCameraBucket("local");
        setConnected(true);
      } catch {
        bucketId = undefined;
      }

      const tick = async () => {
        const activeSource = cameraRef.current;
        if (!activeSource || !videoRef.current) return;
        try {
          const metric = activeSource.sample(videoRef.current);
          setCameraMetric(metric);
          if (calibrationActiveRef.current && metric.present) {
            calibrationSamplesRef.current = [
              ...calibrationSamplesRef.current,
              metric,
            ].slice(-calibrationSampleTarget);
            const progress = calibrationSamplesRef.current.length / calibrationSampleTarget;
            setCalibrationProgress(progress);
            if (calibrationSamplesRef.current.length >= calibrationSampleTarget) {
              const calibration = buildCameraCalibration(calibrationSamplesRef.current);
              if (calibration) {
                const nextSettings = {
                  ...settingsRef.current,
                  cameraCalibration: calibration,
                };
                activeSource.setCalibration(calibration);
                settingsRef.current = nextSettings;
                setSettings(nextSettings);
                calibrationActiveRef.current = false;
                calibrationSamplesRef.current = [];
                setCalibrationActive(false);
                setCalibrationProgress(1);
                setStatus(t(locale, "calibrationComplete"));
              }
            }
          }
          if (metric.present) {
            noFaceSinceRef.current = null;
          } else if (noFaceSinceRef.current === null) {
            noFaceSinceRef.current = Date.now();
          }
          appendLiveCameraMetric(metric);
          if (bucketId) {
            try {
              await aw.heartbeatCameraMetric(bucketId, metric);
            } catch {
              // The local metric remains useful while ActivityWatch reconnects.
            }
          }
        } catch (error) {
          activeSource.stop();
          cameraRef.current = null;
          setCameraRunning(false);
          setCameraMetric(null);
          noFaceSinceRef.current = null;
          const message = describeCameraError(error, locale);
          setStatus(`${t(locale, "cameraFailed")} ${message}`);
          setErrorNotice({ source: "camera", message });
          return;
        }
        cameraTickRef.current = window.setTimeout(
          tick,
          calibrationActiveRef.current ? 600 : 2_000,
        );
      };

      setStatus(t(locale, bucketId ? "cameraActive" : "cameraLocalOnly"));
      await tick();
    } catch (error) {
      setCameraRunning(false);
      noFaceSinceRef.current = null;
      const message = describeCameraError(error, locale);
      setStatus(`${t(locale, "cameraFailed")} ${message}`);
      setErrorNotice({ source: "camera", message });
    } finally {
      cameraStartingRef.current = false;
      setCameraStarting(false);
    }
  }, [appendLiveCameraMetric, cameraRunning, locale, restoreSimulationSnapshot, simulationMode]);

  const stopCamera = useCallback(() => {
    if (cameraTickRef.current) window.clearTimeout(cameraTickRef.current);
    cameraTickRef.current = undefined;
    cameraRef.current?.stop();
    cameraRef.current = null;
    calibrationActiveRef.current = false;
    calibrationSamplesRef.current = [];
    setCalibrationActive(false);
    setCalibrationProgress(0);
    setCameraRunning(false);
    setCameraMetric(null);
    noFaceSinceRef.current = null;
    setStatus(t(locale, "cameraStopped"));
  }, [locale]);

  const startCalibration = useCallback(() => {
    if (!cameraRunning || !cameraRef.current) {
      setStatus(t(locale, "calibrationNeedsCamera"));
      return;
    }
    calibrationSamplesRef.current = [];
    calibrationActiveRef.current = true;
    setCalibrationProgress(0);
    setCalibrationActive(true);
    setStatus(t(locale, "calibrationStarted"));
  }, [cameraRunning, locale]);

  const cancelCalibration = useCallback(() => {
    calibrationActiveRef.current = false;
    calibrationSamplesRef.current = [];
    setCalibrationActive(false);
    setCalibrationProgress(0);
    setStatus(t(locale, "calibrationCancelled"));
  }, [locale]);

  const resetCalibration = useCallback(() => {
    const nextSettings = {
      ...settingsRef.current,
      cameraCalibration: undefined,
    };
    settingsRef.current = nextSettings;
    cameraRef.current?.setCalibration(undefined);
    setSettings(nextSettings);
    setCalibrationProgress(0);
    setStatus(t(locale, "calibrationReset"));
  }, [locale]);

  useEffect(() => () => {
    if (cameraTickRef.current) window.clearTimeout(cameraTickRef.current);
    cameraRef.current?.stop();
  }, []);

  const applySettingsBundle = useCallback(async (
    nextLocale: Locale,
    nextSettings: FocusSettings,
    successMessage: string,
  ) => {
    settingsRef.current = nextSettings;
    calibrationActiveRef.current = false;
    calibrationSamplesRef.current = [];
    setCalibrationActive(false);
    setCalibrationProgress(0);
    setLocale(nextLocale);
    setSettings(nextSettings);
    setAllowedAppsText(nextSettings.allowedApps.join("\n"));
    setDistractingAppsText(nextSettings.distractingApps.join("\n"));
    setAllowedWindowTitlesText(nextSettings.allowedWindowTitles.join("\n"));
    setDistractingWindowTitlesText(nextSettings.distractingWindowTitles.join("\n"));
    setAttentionThreshold(nextSettings.attentionThreshold);
    cameraRef.current?.setCalibration(nextSettings.cameraCalibration);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };

    if (simulationMode && todayInputsRef.current) {
      applyInputEvents(todayInputsRef.current, nextSettings);
    } else if (connected) {
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
    simulationMode,
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
    if (simulationMode) {
      simulationSnapshotRef.current = null;
      setSimulationMode(false);
      setCameraMetric(null);
    }
    localCameraEventsRef.current = [];
    localSessionEventsRef.current = [];
    todayInputsRef.current = null;
    chartsRef.current.clear();
    setTodayInputs(null);
    setDailySummary(null);
    setWeeklySummary(null);
    setObservedApps([]);
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    const nextTimer = resetOpenTimer(
      Date.now(),
      typeof document === "undefined" || document.visibilityState !== "hidden",
    );
    const nextFocusSession = resetFocusSessionClock(Date.now());
    openTimerRef.current = nextTimer;
    focusSessionRef.current = nextFocusSession;
    setOpenedTodayMs(0);
    setFocusSessionClock(nextFocusSession);
    persistFocusSessionClock(nextFocusSession);
    setClearDataArmed(false);
    saveStoredState({ locale, settings, dailySummary: null, weeklySummary: null });
    setStatus(t(locale, "localDataCleared"));
  }, [locale, settings, simulationMode]);

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

  const collectChartAssets = (): ChartAsset[] =>
    Array.from(chartsRef.current.values()).map((handle) => ({
      filename: handle.filename,
      dataUrl: handle.getDataUrl(),
    }));

  const cameraValue = cameraRunning && (!cameraMetric || !cameraMetric.present)
    ? t(locale, "detecting")
    : cameraMetric
      ? `${Math.round(cameraMetric.attention_score * 100)}%`
      : t(locale, "idle");
  const cameraStatus = cameraMetric?.present
    ? t(locale, "facePresent")
    : cameraRunning
      ? t(locale, "cameraRunning")
      : t(locale, "noLiveMetric");
  const latestRecord = dailySummary?.timeline[dailySummary.timeline.length - 1];
  const currentRecord = latestRecord && (
    simulationMode ||
    isFreshTimestamp(nowMs, latestRecord.minuteStart)
  )
    ? latestRecord
    : undefined;
  const cameraAwayConfirmed = Boolean(
    cameraRunning &&
    cameraMetric &&
    !cameraMetric.present &&
    noFaceSinceRef.current !== null &&
    nowMs - noFaceSinceRef.current >= settings.awaySeconds * 1000
  );
  const liveState = currentRecord?.state ?? (
    cameraMetric?.present
      ? cameraMetric.attention_score >= settings.attentionThreshold
        ? "focused"
        : "distracted"
      : "away"
  );
  const liveStateAvailable = Boolean(
    currentRecord ||
    cameraMetric?.present ||
    cameraAwayConfirmed ||
    simulationMode
  );
  const latestCameraEvent = todayInputs?.cameraEvents[todayInputs.cameraEvents.length - 1];
  const currentWindowExplanation = currentRecord
    ? explainWindowScore({
        timestamp: currentRecord.minuteStart,
        duration: 60,
        data: { app: currentRecord.app, title: currentRecord.title },
      }, settings)
    : null;
  const currentAppSignal = currentRecord?.app
    ? `${currentRecord.app} · ${windowScoreLabel(currentWindowExplanation, locale)}`
    : t(locale, "noCurrentApp");
  const currentCameraSignal = cameraMetric?.present
    ? `${Math.round(cameraMetric.attention_score * 100)}% / ${t(locale, "signalThreshold")} ${Math.round(settings.attentionThreshold * 100)}%`
    : cameraRunning
      ? t(locale, "signalNoFace")
      : t(locale, "noCameraSample");
  const filteredApps = useMemo(() => {
    const query = appSearch.trim().toLocaleLowerCase();
    return observedApps.filter((app) => {
      const mode = observedAppMode(app.name, settings);
      return (appFilter === "all" || mode === appFilter) &&
        (!query || app.name.toLocaleLowerCase().includes(query));
    });
  }, [appFilter, appSearch, observedApps, settings]);
  const timelineOption = useMemo(
    () =>
      dailySummary
        ? dailyTimelineOption(
          dailySummary,
          locale,
          new Date(),
          todayInputs?.cameraEvents ?? [],
          settings.attentionThreshold,
        )
        : null,
    [dailySummary, locale, settings.attentionThreshold, todayInputs?.cameraEvents],
  );

  useEffect(() => {
    const evaluation = evaluateNudge(
      nowMs,
      simulationMode || !liveStateAvailable ? null : liveState,
      settings.nudgesEnabled && focusSessionClock.status === "running",
      isWithinWorkday(
        new Date(nowMs),
        settings.workdayStartHour,
        settings.workdayEndHour,
      ),
      settings.distractNudgeSeconds,
      5 * 60,
      nudgeTrackerRef.current,
    );
    nudgeTrackerRef.current = evaluation.tracker;

    if (liveState !== "distracted" || simulationMode) {
      setFocusNudge(null);
      return;
    }
    if (!evaluation.shouldNotify) return;

    const nextNudge = {
      app: currentRecord?.app ?? "",
      distractedSeconds: evaluation.distractedSeconds,
    };
    setFocusNudge(nextNudge);
    void sendFocusNotification(
      t(locale, "focusNudgeTitle"),
      currentRecord?.app
        ? `${t(locale, "focusNudgeBody")} · ${currentRecord.app}`
        : t(locale, "focusNudgeBody"),
    );
  }, [
    currentRecord?.app,
    focusSessionClock.status,
    liveState,
    liveStateAvailable,
    locale,
    nowMs,
    settings.distractNudgeSeconds,
    settings.nudgesEnabled,
    settings.workdayEndHour,
    settings.workdayStartHour,
    simulationMode,
  ]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">FC</div>
          <div>
          <p className="eyebrow">{t(locale, "appEyebrow")}</p>
          <h1>{t(locale, "appTitle")}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="status-pill" data-connected={connected}>
            <span className="status-dot" aria-hidden="true" />
            {connected ? t(locale, "connected") : t(locale, "disconnected")}
          </div>
          <button
            className="settings-menu-button"
            aria-controls="settings-drawer"
            aria-expanded={settingsMenuOpen}
            onClick={() => setSettingsMenuOpen(true)}
          >
            {t(locale, "settingsMenu")}
          </button>
        </div>
      </header>

      {errorNotice ? (
        <section className="error-banner" role="alert">
          <div>
            <strong>{errorNotice.source === "camera" ? t(locale, "cameraFailed") : t(locale, "awFailed")}</strong>
            <p>{errorNotice.message}</p>
          </div>
          <div className="error-actions">
            <button
              onClick={errorNotice.source === "camera" ? startCamera : refreshActivityWatch}
              disabled={awBusy || cameraStarting}
            >
              {t(locale, "retry")}
            </button>
            {errorNotice.source === "camera" ? (
              <button onClick={openPermissions}>{t(locale, "openPermissions")}</button>
            ) : null}
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
        <div className="live-state-card" data-state={liveStateAvailable ? liveState : "idle"}>
          <div className="live-state-topline">
            <span className="live-indicator" aria-hidden="true" />
            <span>{simulationMode ? t(locale, "simulationMode") : t(locale, "currentState")}</span>
          </div>
          <strong>
            {liveStateAvailable ? t(locale, liveState) : t(locale, "waitingForData")}
          </strong>
          <p>{liveStateReason(
            liveStateAvailable ? liveState : null,
            currentRecord,
            cameraMetric,
            settings,
            locale,
            cameraRunning,
          )}</p>
          <div className="live-context">
            <span>{t(locale, "signalApp")} <b>{currentAppSignal}</b></span>
            <span>{t(locale, "signalCamera")} <b>{currentCameraSignal}</b></span>
            <span>{latestCameraEvent ? formatSampleAge(latestCameraEvent.timestamp, nowMs, locale) : t(locale, "noCameraSample")}</span>
          </div>
        </div>

        <div className="quick-start panel">
          <div>
            <p className="section-kicker">{t(locale, "quickStart")}</p>
            <h2>
              {focusSessionClock.status === "running"
                ? t(locale, "sessionRunningTitle")
                : focusSessionClock.status === "paused"
                  ? t(locale, "sessionPausedTitle")
                  : t(locale, "readyToFocus")}
            </h2>
            <p>
              {focusSessionClock.status === "running"
                ? t(locale, "sessionRunningHelp")
                : focusSessionClock.status === "paused"
                  ? t(locale, "sessionPausedHelp")
                  : t(locale, "readyToFocusHelp")}
            </p>
          </div>
          <div className="session-clock" data-status={focusSessionClock.status}>
            <span>{t(locale, "currentSession")}</span>
            <strong>{formatDuration(focusSessionClock.elapsedMs)}</strong>
            <small>
              {focusSessionClock.status === "idle" && focusSessionClock.elapsedMs > 0
                ? t(locale, "sessionStatusFinished")
                : t(locale, `sessionStatus${capitalize(focusSessionClock.status)}` as
                  | "sessionStatusIdle"
                  | "sessionStatusRunning"
                  | "sessionStatusPaused")}
            </small>
          </div>
          <div className="primary-actions">
            {focusSessionClock.status === "idle" ? (
              <button
                className="button-primary"
                onClick={startFocusSession}
                disabled={simulationMode}
              >
                {t(locale, "startSession")}
              </button>
            ) : null}
            {focusSessionClock.status === "running" ? (
              <button className="button-primary" onClick={pauseFocusSession}>
                {t(locale, "pauseSession")}
              </button>
            ) : null}
            {focusSessionClock.status === "paused" ? (
              <button className="button-primary" onClick={resumeFocusSession}>
                {t(locale, "resumeSession")}
              </button>
            ) : null}
            {focusSessionClock.status !== "idle" ? (
              <button onClick={endFocusSession}>{t(locale, "endSession")}</button>
            ) : null}
            <button onClick={refreshActivityWatch} disabled={awBusy}>
              {awBusy ? t(locale, "loadingAw") : t(locale, "loadAw")}
            </button>
          </div>
          <div className="secondary-actions">
            <button onClick={startCamera} disabled={cameraRunning || cameraStarting}>
              <span className="button-icon" aria-hidden="true">●</span>
              {cameraStarting ? t(locale, "startingCameraShort") : t(locale, "startCamera")}
            </button>
            <button onClick={stopCamera} disabled={!cameraRunning}>{t(locale, "stopCamera")}</button>
          </div>
        </div>
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
          <span>{dailySummary ? `${t(locale, "away")} ${dailySummary.awayMinutes}m` : t(locale, "emptyTitle")}</span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "attentionNow")}</p>
          <strong>{cameraValue}</strong>
          <span>{cameraStatus}</span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "openedToday")}</p>
          <strong>{formatDuration(openedTodayMs)}</strong>
          <span>{new Date(nowMs).toLocaleTimeString([], { hour12: false })}</span>
        </div>
      </section>

      {dailySummary && weeklySummary ? (
        <section className="charts-grid">
          <ChartPanel
            title={t(locale, "dailyTimeline")}
            filename={`${dailySummary.date}-timeline.png`}
            option={timelineOption!}
            onReady={registerChart}
            loadingLabel={t(locale, "chartLoading")}
            live={{
              endTime: nowMs,
              windowMs: 60 * 60 * 1000,
              followingLabel: t(locale, "timelineFollowing"),
              pausedLabel: t(locale, "timelinePaused"),
              resumeLabel: t(locale, "timelineResume"),
            }}
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
        <section className="panel setup-guide">
          <div className="setup-heading">
            <p className="section-kicker">{t(locale, "emptyTitle")}</p>
            <h2>{t(locale, "setupTitle")}</h2>
            <p>{t(locale, "setupBody")}</p>
          </div>
          <div className="setup-steps">
            <article>
              <span className="step-number">1</span>
              <div>
                <span className="step-badge">{t(locale, "recommended")}</span>
                <h3>{t(locale, "setupAwTitle")}</h3>
                <p>{t(locale, "setupAwBody")}</p>
                <button className="button-primary" onClick={refreshActivityWatch} disabled={awBusy}>
                  {awBusy ? t(locale, "loadingAw") : t(locale, "loadAw")}
                </button>
              </div>
            </article>
            <article>
              <span className="step-number">2</span>
              <div>
                <span className="step-badge" data-optional="true">{t(locale, "optional")}</span>
                <h3>{t(locale, "setupCameraTitle")}</h3>
                <p>{t(locale, "setupCameraBody")}</p>
                <button onClick={startCamera} disabled={cameraRunning || cameraStarting}>
                  {cameraStarting ? t(locale, "startingCameraShort") : t(locale, "startCamera")}
                </button>
              </div>
            </article>
            <article>
              <span className="step-number">3</span>
              <div>
                <span className="step-badge">{t(locale, "recommended")}</span>
                <h3>{t(locale, "setupClassifyTitle")}</h3>
                <p>{t(locale, "setupClassifyBody")}</p>
                <button onClick={refreshObservedApps} disabled={awBusy}>
                  {awBusy ? t(locale, "refreshingAwApps") : t(locale, "refreshAwApps")}
                </button>
              </div>
            </article>
          </div>
        </section>
      )}

      <footer role="status" aria-live="polite">
        <span className="footer-status-dot" aria-hidden="true" />
        {status}
      </footer>

      <div
        className="settings-overlay"
        data-open={settingsMenuOpen}
        aria-hidden={!settingsMenuOpen}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSettingsMenuOpen(false);
        }}
      >
        <aside
          id="settings-drawer"
          className="settings-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-drawer-title"
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

            <section className="settings-quick-card settings-tools" aria-labelledby="settings-tools-title">
              <div>
                <strong id="settings-tools-title">{t(locale, "toolsTitle")}</strong>
                <span>{t(locale, "toolsHelp")}</span>
              </div>
              <div className="settings-tool-actions">
                <button
                  onClick={startSimulation}
                  disabled={
                    simulationMode ||
                    cameraStarting ||
                    focusSessionClock.status !== "idle"
                  }
                >
                  {t(locale, "startSimulation")}
                </button>
                {simulationMode ? <button onClick={stopSimulation}>{t(locale, "stopSimulation")}</button> : null}
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
            <div className="slider-grid">
              <label className="threshold-control">
                <span>{t(locale, "thresholdLabel")} <b>{Math.round(attentionThreshold * 100)}%</b></span>
                <input
                  type="range"
                  min="0.3"
                  max="0.95"
                  step="0.01"
                  value={attentionThreshold}
                  onChange={(event) => updateAttentionThreshold(Number(event.target.value))}
                />
              </label>
              <label className="threshold-control">
                <span>{t(locale, "awayDelayLabel")} <b>{settings.awaySeconds}s</b></span>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={settings.awaySeconds}
                  onChange={(event) => updateAwaySeconds(Number(event.target.value))}
                />
              </label>
            </div>
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
                {(["all", "focus", "neutral", "distract"] as const).map((filter) => (
                  <button
                    key={filter}
                    data-active={appFilter === filter}
                    onClick={() => setAppFilter(filter)}
                  >
                    {t(locale, `appFilter${filter[0].toUpperCase()}${filter.slice(1)}` as
                      | "appFilterAll"
                      | "appFilterFocus"
                      | "appFilterNeutral"
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
                          <button data-active={mode === "neutral"} onClick={() => setObservedAppMode(app.name, "neutral")}>{t(locale, "appModeNeutral")}</button>
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

            <details className="panel disclosure-panel camera-disclosure">
          <summary>
            <div>
              <span className="summary-icon" aria-hidden="true">◉</span>
              <div><strong>{t(locale, "cameraPreview")}</strong><small>{t(locale, "cameraDiagnostics")}</small></div>
            </div>
            <span className="disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="disclosure-content camera-panel">
            <div className="camera-diagnostics">
              <div><span>{t(locale, "faceDetection")}</span><strong>{cameraMetric?.present ? t(locale, "detected") : t(locale, "notDetected")}</strong></div>
              <div><span>{t(locale, "confidence")}</span><strong>{cameraMetric ? `${Math.round(cameraMetric.confidence * 100)}%` : "--"}</strong></div>
              <div>
                <span>{t(locale, "gazeStatus")}</span>
                <strong>
                  {cameraMetric?.present
                    ? cameraMetric.looking_away
                      ? t(locale, "lookingAway")
                      : t(locale, "lookingForward")
                    : "--"}
                </strong>
              </div>
              <p>{t(locale, "cameraPrivacy")}</p>
            </div>
            <div className="camera-calibration">
              <div className="calibration-heading">
                <div>
                  <strong>{t(locale, "calibrationTitle")}</strong>
                  <span>
                    {calibrationActive
                      ? `${t(locale, "calibrationProgress")} ${Math.round(calibrationProgress * 100)}%`
                      : settings.cameraCalibration
                      ? `${t(locale, "calibrationReady")} · ${formatCalibrationDate(settings.cameraCalibration.calibratedAt, locale)}`
                      : t(locale, "calibrationNotSet")}
                  </span>
                </div>
                <span className="calibration-badge" data-ready={Boolean(settings.cameraCalibration)}>
                  {settings.cameraCalibration ? t(locale, "calibrated") : t(locale, "notCalibrated")}
                </span>
              </div>
              <p>{t(locale, "calibrationBody")}</p>
              {calibrationActive ? (
                <div
                  className="calibration-progress"
                  role="progressbar"
                  aria-label={t(locale, "calibrationProgress")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(calibrationProgress * 100)}
                >
                  <span style={{ width: `${Math.round(calibrationProgress * 100)}%` }} />
                </div>
              ) : null}
              <div className="calibration-actions">
                {calibrationActive ? (
                  <button onClick={cancelCalibration}>{t(locale, "cancelCalibration")}</button>
                ) : (
                  <button
                    className="button-primary"
                    onClick={startCalibration}
                    disabled={!cameraRunning}
                  >
                    {!cameraRunning
                      ? t(locale, "startCameraFirst")
                      : settings.cameraCalibration
                      ? t(locale, "recalibrate")
                      : t(locale, "startCalibration")}
                  </button>
                )}
                {settings.cameraCalibration && !calibrationActive ? (
                  <button onClick={resetCalibration}>{t(locale, "resetCalibration")}</button>
                ) : null}
              </div>
              <p className="calibration-limit">{t(locale, "calibrationLimit")}</p>
            </div>
            <video ref={videoRef} muted playsInline />
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
              <li>{t(locale, "introFeatureCamera")}</li>
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
        </aside>
      </div>
    </main>
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
      const [windowEvents, cameraEvents, sessionEvents] = await Promise.all([
        windowBucketId ? aw.getEvents<WindowEventData>(windowBucketId, start, end) : Promise.resolve([]),
        aw.getEvents<CameraMetric>(`focus-camera_local`, start, end).catch(() => []),
        aw.getEvents<FocusSessionData>(`focus-companion-session_local`, start, end).catch(() => []),
      ]);
      return aggregateDailyFocus(date, windowEvents, cameraEvents, settings, sessionEvents);
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

function summarizeObservedApps(
  events: ActivityWatchEvent<WindowEventData>[],
): ObservedApp[] {
  const durations = new Map<string, number>();
  for (const event of events) {
    const name = event.data.app?.trim();
    if (!name) continue;
    durations.set(name, (durations.get(name) ?? 0) + Math.max(0, event.duration));
  }
  return Array.from(durations, ([name, seconds]) => ({ name, seconds }))
    .sort((left, right) => right.seconds - left.seconds || left.name.localeCompare(right.name));
}

function observedAppMode(
  app: string,
  settings: FocusSettings,
): "focus" | "neutral" | "distract" {
  const normalized = app.toLocaleLowerCase();
  if (settings.distractingApps.some((value) => value.toLocaleLowerCase() === normalized)) {
    return "distract";
  }
  if (settings.allowedApps.some((value) => value.toLocaleLowerCase() === normalized)) {
    return "focus";
  }
  return "neutral";
}

function appModeLabel(
  mode: "focus" | "neutral" | "distract",
  locale: Locale,
): string {
  if (mode === "focus") return t(locale, "appModeFocus");
  if (mode === "distract") return t(locale, "appModeDistract");
  return t(locale, "appModeNeutral");
}

function windowScoreLabel(
  explanation: ReturnType<typeof explainWindowScore> | null,
  locale: Locale,
): string {
  if (!explanation) return t(locale, "appModeNeutral");
  if (explanation.source === "allowed-window") return t(locale, "matchedAllowedWindow");
  if (explanation.source === "distracting-window") return t(locale, "matchedDistractingWindow");
  if (explanation.score === "focus") return t(locale, "appModeFocus");
  if (explanation.score === "distract") return t(locale, "appModeDistract");
  return t(locale, "appModeNeutral");
}

function formatAppDuration(seconds: number, locale: Locale): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return locale === "zh" ? `今日 ${minutes} 分钟` : `${minutes} min today`;
}

function formatCalibrationDate(timestamp: string, locale: Locale): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSampleAge(timestamp: string, nowMs: number, locale: Locale): string {
  const seconds = Math.max(0, Math.round((nowMs - new Date(timestamp).getTime()) / 1000));
  if (seconds < 5) return locale === "zh" ? "刚刚更新" : "Updated just now";
  if (seconds < 60) return locale === "zh" ? `${seconds} 秒前更新` : `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return locale === "zh" ? `${minutes} 分钟前更新` : `Updated ${minutes}m ago`;
}

function liveStateReason(
  state: "focused" | "distracted" | "away" | null,
  record: DailySummary["timeline"][number] | undefined,
  metric: CameraMetric | null,
  settings: FocusSettings,
  locale: Locale,
  cameraRunning: boolean,
): string {
  if (!state) return t(locale, cameraRunning ? "reasonDetectingFace" : "reasonWaiting");
  if (state === "away") return t(locale, "reasonAway");
  if (state === "focused") {
    return record?.app ? t(locale, "reasonFocusedApp") : t(locale, "reasonFocusedCamera");
  }
  if (metric?.present && metric.attention_score < settings.attentionThreshold) {
    return t(locale, "reasonDistractedAttention");
  }
  return t(locale, "reasonDistractedApp");
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

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
