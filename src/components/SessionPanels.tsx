import { memo } from "react";
import {
  focusSessionElapsedMsAt,
  focusSessionTotalMsAt,
  type FocusSessionClock,
} from "../core/focusSession";
import { useTime } from "../core/time";
import { t, type Locale } from "../i18n";

interface QuickStartProps {
  locale: Locale;
  clock: FocusSessionClock;
  sessionStarting: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export const QuickStart = memo(function QuickStart({
  locale,
  clock,
  sessionStarting,
  onStart,
  onPause,
  onResume,
  onEnd,
}: QuickStartProps) {
  const nowMs = useTime();
  const elapsedMs = focusSessionElapsedMsAt(clock, nowMs);

  return (
    <section className="quick-start panel">
      <div>
        <p className="section-kicker">{t(locale, "quickStart")}</p>
        <h2>
          {clock.status === "running"
            ? t(locale, "sessionRunningTitle")
            : clock.status === "paused"
              ? t(locale, "sessionPausedTitle")
              : t(locale, "readyToFocus")}
        </h2>
        <p>
          {clock.status === "running"
            ? t(locale, "sessionRunningHelp")
            : clock.status === "paused"
              ? t(locale, "sessionPausedHelp")
              : t(locale, "readyToFocusHelp")}
        </p>
      </div>
      <div className="session-clock" data-status={clock.status}>
        <span>{t(locale, "currentSession")}</span>
        <strong>{formatDuration(elapsedMs)}</strong>
        <small>
          {clock.status === "idle" && elapsedMs > 0
            ? t(locale, "sessionStatusFinished")
            : t(locale, `sessionStatus${capitalize(clock.status)}` as
              | "sessionStatusIdle"
              | "sessionStatusRunning"
              | "sessionStatusPaused")}
        </small>
      </div>
      <div className="primary-actions">
        {clock.status === "idle" ? (
          <button
            className="button-primary"
            onClick={onStart}
            disabled={sessionStarting}
          >
            {sessionStarting ? t(locale, "sessionPreparingShort") : t(locale, "startSession")}
          </button>
        ) : null}
        {clock.status === "running" ? (
          <button className="button-primary" onClick={onPause}>
            {t(locale, "pauseSession")}
          </button>
        ) : null}
        {clock.status === "paused" ? (
          <button className="button-primary" onClick={onResume} disabled={sessionStarting}>
            {sessionStarting ? t(locale, "sessionPreparingShort") : t(locale, "resumeSession")}
          </button>
        ) : null}
        {clock.status !== "idle" ? (
          <button onClick={onEnd}>{t(locale, "endSession")}</button>
        ) : null}
      </div>
    </section>
  );
});

export const SessionTotal = memo(function SessionTotal({
  clock,
}: {
  clock: FocusSessionClock;
}) {
  const nowMs = useTime();
  return <>{formatDuration(focusSessionTotalMsAt(clock, nowMs))}</>;
});

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
