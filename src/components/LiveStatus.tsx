import { memo, useEffect, useMemo, type MutableRefObject } from "react";
import { sendFocusNotification } from "../core/desktopBridge";
import {
  explainWindowScore,
  type WindowScoreExplanation,
} from "../core/focus";
import { useInputActivity } from "../core/inputActivity";
import {
  evaluateNudge,
  isFreshTimestamp,
  isWithinWorkday,
  type NudgeTracker,
} from "../core/nudges";
import { useTime } from "../core/time";
import { t, type Locale } from "../i18n";
import type {
  DailySummary,
  FocusSettings,
  FocusState,
  MinuteFocusRecord,
} from "../types";

export interface FocusNudge {
  app: string;
  distractedSeconds: number;
}

export interface LiveInputSnapshot {
  available: boolean;
  idleSeconds: number;
}

export interface LiveStatusModel {
  currentRecord?: MinuteFocusRecord;
  inputActive: boolean;
  state: FocusState;
  windowExplanation: WindowScoreExplanation | null;
}

export function buildLiveStatusModel(
  currentRecord: MinuteFocusRecord | undefined,
  input: LiveInputSnapshot,
  settings: FocusSettings,
): LiveStatusModel {
  const inputActive = input.available
    ? input.idleSeconds < settings.inputIdleThresholdSeconds
    : true;
  const windowExplanation = currentRecord
    ? explainWindowScore({
        timestamp: currentRecord.minuteStart,
        duration: 60,
        data: { app: currentRecord.app, title: currentRecord.title },
      }, settings)
    : null;
  const state: FocusState = input.available && !inputActive
    ? "distracted"
    : windowExplanation?.score === "distract"
      ? "distracted"
      : "focused";

  return {
    currentRecord,
    inputActive,
    state,
    windowExplanation,
  };
}

export function liveStatusAppSignal(
  currentRecord: MinuteFocusRecord | undefined,
  explanation: WindowScoreExplanation | null,
  locale: Locale,
): string {
  return currentRecord?.app
    ? `${currentRecord.app} · ${windowScoreLabel(explanation, locale)}`
    : t(locale, "noCurrentApp");
}

interface LiveStatusProps {
  locale: Locale;
  settings: FocusSettings;
  dailySummary: DailySummary | null;
  sessionRunning: boolean;
  nudgeTrackerRef: MutableRefObject<NudgeTracker>;
  onNudge: (nudge: FocusNudge | null) => void;
}

export const LiveStatus = memo(function LiveStatus({
  locale,
  settings,
  dailySummary,
  sessionRunning,
  nudgeTrackerRef,
  onNudge,
}: LiveStatusProps) {
  const nowMs = useTime();
  const input = useInputActivity();
  const model = useMemo(() => {
    const latestRecord = dailySummary?.timeline[dailySummary.timeline.length - 1];
    const currentRecord = latestRecord && isFreshTimestamp(nowMs, latestRecord.minuteStart)
      ? latestRecord
      : undefined;
    const status = buildLiveStatusModel(currentRecord, input, settings);

    return {
      ...status,
      appSignal: liveStatusAppSignal(currentRecord, status.windowExplanation, locale),
    };
  }, [dailySummary, input, locale, nowMs, settings]);

  useEffect(() => {
    const previousTracker = nudgeTrackerRef.current;
    const evaluation = evaluateNudge(
      nowMs,
      model.state,
      settings.nudgesEnabled && sessionRunning,
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

    if (model.state !== "distracted") {
      if (previousTracker.distractedSince !== null) onNudge(null);
      return;
    }
    if (!evaluation.shouldNotify) return;

    const nextNudge = {
      app: model.currentRecord?.app ?? "",
      distractedSeconds: evaluation.distractedSeconds,
    };
    onNudge(nextNudge);
    void sendFocusNotification(
      t(locale, "focusNudgeTitle"),
      nextNudge.app
        ? `${t(locale, "focusNudgeBody")} · ${nextNudge.app}`
        : t(locale, "focusNudgeBody"),
    );
  }, [
    locale,
    model.currentRecord?.app,
    model.state,
    nowMs,
    onNudge,
    sessionRunning,
    settings.distractNudgeSeconds,
    settings.nudgesEnabled,
    settings.workdayEndHour,
    settings.workdayStartHour,
    nudgeTrackerRef,
  ]);

  return (
    <section className="live-state-card panel" data-state={model.state}>
      <div className="live-state-topline">
        <span className="live-indicator" aria-hidden="true" />
        <span>{t(locale, "currentState")}</span>
      </div>
      <strong>{t(locale, model.state)}</strong>
      <p>
        {!input.available
          ? t(locale, "reasonInputUnavailable")
          : !model.inputActive
          ? t(locale, "reasonInputIdle")
          : model.state === "distracted"
            ? t(locale, "reasonDistractedApp")
            : t(locale, "reasonFocusedApp")}
      </p>
      <div className="live-context">
        <span>{t(locale, "signalApp")} <b>{model.appSignal}</b></span>
        <span>
          {t(locale, "signalInput")}{" "}
          <b>
            {!input.available
              ? t(locale, "inputUnavailable")
              : model.inputActive
                ? t(locale, "active")
                : t(locale, "inputIdle")}
          </b>
        </span>
        <span>{formatIdleDuration(input.idleSeconds, settings.inputIdleThresholdSeconds, locale)}</span>
        <span>{t(locale, input.scope === "system" ? "inputScopeSystem" : "inputScopeWindow")}</span>
      </div>
    </section>
  );
});

export const InputActivityMetric = memo(function InputActivityMetric({
  locale,
  thresholdSeconds,
}: {
  locale: Locale;
  thresholdSeconds: number;
}) {
  const input = useInputActivity();
  const active = input.available ? input.idleSeconds < thresholdSeconds : true;
  return (
    <>
      <strong>
        {!input.available
          ? t(locale, "inputUnavailable")
          : active
            ? t(locale, "active")
            : t(locale, "inputIdle")}
      </strong>
      <span>
        {input.available
          ? `${formatIdleDuration(input.idleSeconds, thresholdSeconds, locale)} · ${
              t(locale, input.scope === "system" ? "inputScopeSystem" : "inputScopeWindow")
            }`
          : t(locale, "inputUnavailableHelp")}
      </span>
    </>
  );
});

export const InputMonitoringStatus = memo(function InputMonitoringStatus({
  locale,
}: {
  locale: Locale;
}) {
  const input = useInputActivity();
  return (
    <span data-ready={input.available && input.scope === "system"}>
      {t(locale, "inputMonitoring")} ·{" "}
      {input.available
        ? t(locale, input.scope === "system" ? "inputScopeSystem" : "inputScopeWindow")
        : t(locale, "inputUnavailable")}
    </span>
  );
});

function windowScoreLabel(
  explanation: WindowScoreExplanation | null,
  locale: Locale,
): string {
  if (!explanation) return t(locale, "appModeFocus");
  if (explanation.source === "allowed-window") return t(locale, "matchedAllowedWindow");
  if (explanation.source === "distracting-window") {
    return t(locale, "matchedDistractingWindow");
  }
  return explanation.score === "distract"
    ? t(locale, "appModeDistract")
    : t(locale, "appModeFocus");
}

function formatIdleDuration(seconds: number, thresholdSeconds: number, locale: Locale): string {
  const rounded = Math.max(0, Math.floor(seconds));
  if (rounded < thresholdSeconds) {
    return locale === "zh"
      ? `${rounded} 秒前有输入`
      : `Input ${rounded}s ago`;
  }
  const minutes = Math.floor(rounded / 60);
  return locale === "zh"
    ? `已无输入 ${minutes} 分钟`
    : `No input for ${minutes}m`;
}
