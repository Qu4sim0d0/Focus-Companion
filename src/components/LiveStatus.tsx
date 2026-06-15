import { memo, useEffect, useMemo, type MutableRefObject } from "react";
import { sendFocusNotification } from "../core/desktopBridge";
import {
  explainWindowScore,
  inputIdleThresholdSeconds,
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
} from "../types";

export interface FocusNudge {
  app: string;
  distractedSeconds: number;
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
    const liveWindowEvent = currentRecord
      ? {
          timestamp: currentRecord.minuteStart,
          duration: 60,
          data: { app: currentRecord.app, title: currentRecord.title },
        }
      : undefined;
    const windowExplanation = currentRecord
      ? explainWindowScore(liveWindowEvent, settings)
      : null;
    const state: FocusState = input.available && !input.active
      ? "distracted"
      : currentRecord?.state === "distracted"
        ? "distracted"
        : "focused";

    return {
      currentRecord,
      state,
      appSignal: currentRecord?.app
        ? `${currentRecord.app} · ${windowScoreLabel(windowExplanation, locale)}`
        : t(locale, "noCurrentApp"),
    };
  }, [dailySummary, input.active, locale, nowMs, settings]);

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
          : !input.active
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
              : input.active
                ? t(locale, "active")
                : t(locale, "inputIdle")}
          </b>
        </span>
        <span>{formatIdleDuration(input.idleSeconds, locale)}</span>
        <span>{t(locale, input.scope === "system" ? "inputScopeSystem" : "inputScopeWindow")}</span>
      </div>
    </section>
  );
});

export const InputActivityMetric = memo(function InputActivityMetric({
  locale,
}: {
  locale: Locale;
}) {
  const input = useInputActivity();
  return (
    <>
      <strong>
        {!input.available
          ? t(locale, "inputUnavailable")
          : input.active
            ? t(locale, "active")
            : t(locale, "inputIdle")}
      </strong>
      <span>
        {input.available
          ? `${formatIdleDuration(input.idleSeconds, locale)} · ${
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

function formatIdleDuration(seconds: number, locale: Locale): string {
  const rounded = Math.max(0, Math.floor(seconds));
  if (rounded < inputIdleThresholdSeconds) {
    return locale === "zh"
      ? `${rounded} 秒前有输入`
      : `Input ${rounded}s ago`;
  }
  const minutes = Math.floor(rounded / 60);
  return locale === "zh"
    ? `已无输入 ${minutes} 分钟`
    : `No input for ${minutes}m`;
}
