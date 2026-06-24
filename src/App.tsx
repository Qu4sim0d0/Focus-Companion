import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityWatchClient, formatLocalDate } from "./core/activitywatch";
import {
  openAccessibilitySettings,
  openActivityWatchWindow,
  requestFocusNotificationPermission,
} from "./core/desktopBridge";
import {
  defaultSettings,
  reclassifyDailySummary,
} from "./core/focus";
import { type NudgeTracker } from "./core/nudges";
import {
  observedAppMode,
  observedWindowMode,
  type ObservedWindow,
} from "./core/observedActivity";
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
import {
  mergeTodayIntoWeekly,
  useActivityWatchSync,
} from "./hooks/useActivityWatchSync";
import { useFocusSessionController } from "./hooks/useFocusSessionController";
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
} from "./types";

const aw = new ActivityWatchClient();

export function App() {
  const settingsImportRef = useRef<HTMLInputElement | null>(null);
  const chartsRef = useRef<Map<string, ChartPanelHandle>>(new Map());
  const todayInputsRef = useRef<FocusInputEvents | null>(null);
  const localInputEventsRef = useRef<ActivityWatchEvent<InputMetric>[]>([]);
  const localSessionEventsRef = useRef<ActivityWatchEvent<FocusSessionData>[]>([]);
  const nudgeTrackerRef = useRef<NudgeTracker>({
    distractedSince: null,
    lastNudgeAt: null,
  });
  const [storedState] = useState(() => loadStoredState());
  const initialDailySummary = currentDailySummary(storedState.dailySummary);
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
  const [status, setStatus] = useState(() =>
    t(storedState.locale, initialDailySummary ? "readyCached" : "ready"),
  );
  const [connected, setConnected] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(initialDailySummary);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(storedState.weeklySummary);
  const [appSearch, setAppSearch] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "focus" | "distract">("all");
  const [windowSearch, setWindowSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<"all" | "focus" | "distract">("all");
  const [focusNudge, setFocusNudge] = useState<FocusNudge | null>(null);
  const [clearDataArmed, setClearDataArmed] = useState(false);
  const [resetSettingsArmed, setResetSettingsArmed] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const hasLoadedSummaries = dailySummary !== null;
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const {
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
  } = useActivityWatchSync({
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
  });

  const {
    focusSessionClock,
    sessionStarting,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    endFocusSession,
    resetSessionClock,
  } = useFocusSessionController({
    aw,
    locale,
    connected,
    refreshActivityWatch,
    appendSessionEvent,
    writeSessionBoundary,
    setConnected,
    setStatus,
    setFocusNudge,
    nudgeTrackerRef,
  });

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
        setDailySummary(null);
        setFocusNudge(null);
        nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
      }
      resetSessionClock();
    }, Math.max(1_000, nextDay.getTime() - now.getTime()));
    return () => window.clearTimeout(timeoutId);
  }, [dailySummary, focusSessionClock.date, resetSessionClock]);

  const applyRuleChangeToSummaries = useCallback((nextSettings: FocusSettings) => {
    const currentInputs = todayInputsRef.current;
    if (currentInputs) {
      applyInputEvents(currentInputs, nextSettings);
      return;
    }

    if (dailySummary) {
      const nextDaily = reclassifyDailySummary(dailySummary, nextSettings);
      setDailySummary(nextDaily);
      setWeeklySummary((current) => mergeTodayIntoWeekly(current, nextDaily));
      return;
    }

    if (weeklySummary) {
      setWeeklySummary(null);
    }
  }, [applyInputEvents, dailySummary, weeklySummary]);

  const saveRuleSettings = useCallback(async () => {
    const nextSettings: FocusSettings = {
      ...settings,
      allowedApps: parseRuleList(allowedAppsText),
      distractingApps: parseRuleList(distractingAppsText),
      allowedWindowTitles: parseRuleList(allowedWindowTitlesText),
      distractingWindowTitles: parseRuleList(distractingWindowTitlesText),
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    applyRuleChangeToSummaries(nextSettings);
    if (connected) {
      try {
        applyLoadedSummaries(await loadActivityWatchSummaries(nextSettings));
      } catch {
        // Keep the saved rules even if ActivityWatch disconnects during recalculation.
      }
    }
    setStatus(t(locale, "rulesSaved"));
  }, [
    allowedAppsText,
    allowedWindowTitlesText,
    applyRuleChangeToSummaries,
    applyLoadedSummaries,
    connected,
    distractingAppsText,
    distractingWindowTitlesText,
    loadActivityWatchSummaries,
    locale,
    settings,
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

  const updateInputIdleThreshold = useCallback((seconds: number) => {
    const nextSeconds = Math.max(30, Math.min(1_800, Math.round(seconds)));
    setSettings((current) => ({ ...current, inputIdleThresholdSeconds: nextSeconds }));
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    setFocusNudge(null);
    if (todayInputsRef.current) {
      applyInputEvents(
        todayInputsRef.current,
        { ...settingsRef.current, inputIdleThresholdSeconds: nextSeconds },
      );
    }
  }, [applyInputEvents]);

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
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setAllowedAppsText(nextAllowed.join("\n"));
    setDistractingAppsText(nextDistracting.join("\n"));
    applyRuleChangeToSummaries(nextSettings);
    setStatus(t(locale, "appRuleUpdated"));
  }, [
    applyRuleChangeToSummaries,
    locale,
    settings,
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
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setAllowedWindowTitlesText(nextAllowed.join("\n"));
    setDistractingWindowTitlesText(nextDistracting.join("\n"));
    applyRuleChangeToSummaries(nextSettings);
    setStatus(t(locale, "windowRuleUpdated"));
  }, [
    applyRuleChangeToSummaries,
    locale,
    settings,
  ]);

  const openPermissions = useCallback(async () => {
    const result = await openAccessibilitySettings();
    setStatus(result === "opened" ? t(locale, "permissionsOpened") : t(locale, "permissionsOpened"));
  }, [locale]);

  const openAwWindow = useCallback(async () => {
    const result = await openActivityWatchWindow();
    setStatus(result === "opened" ? t(locale, "openedAw") : t(locale, "awFailed"));
  }, [locale]);

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
    setDailySummary(null);
    setWeeklySummary(null);
    clearObservedActivity();
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
    resetSessionClock();
    setClearDataArmed(false);
    saveStoredState({ locale, settings, dailySummary: null, weeklySummary: null });
    setStatus(t(locale, "localDataCleared"));
  }, [clearObservedActivity, locale, resetSessionClock, settings]);

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
          <span>{dailySummary ? t(locale, "distractedHelp") : t(locale, "emptyTitle")}</span>
        </div>
        <div className="panel metric-panel">
          <p className="label">{t(locale, "inputActivity")}</p>
          <InputActivityMetric locale={locale} thresholdSeconds={settings.inputIdleThresholdSeconds} />
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
                    {t(locale, "inputIdleThresholdLabel")} <b>{formatShortDuration(settings.inputIdleThresholdSeconds, locale)}</b>
                  </span>
                  <input
                    type="range"
                    min="30"
                    max="1800"
                    step="30"
                    value={settings.inputIdleThresholdSeconds}
                    onChange={(event) => updateInputIdleThreshold(Number(event.target.value))}
                  />
                  <small>{t(locale, "inputIdleThresholdHelp")}</small>
                </label>
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
