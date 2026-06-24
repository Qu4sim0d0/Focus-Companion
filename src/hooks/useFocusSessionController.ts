import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { ActivityWatchClient } from "../core/activitywatch";
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
} from "../core/focusSession";
import type { NudgeTracker } from "../core/nudges";
import { t, type Locale } from "../i18n";

interface UseFocusSessionControllerOptions {
  aw: ActivityWatchClient;
  locale: Locale;
  connected: boolean;
  refreshActivityWatch: () => Promise<boolean>;
  appendSessionEvent: (running: boolean, sampledAt?: Date) => void;
  writeSessionBoundary: (running: boolean) => void;
  setConnected: (connected: boolean) => void;
  setStatus: (status: string) => void;
  setFocusNudge: (nudge: null) => void;
  nudgeTrackerRef: MutableRefObject<NudgeTracker>;
}

export function useFocusSessionController({
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
}: UseFocusSessionControllerOptions) {
  const sessionStartingRef = useRef(false);
  const monitoringReadyRef = useRef(false);
  const focusSessionRef = useRef<FocusSessionClock | null>(null);
  if (!focusSessionRef.current) {
    focusSessionRef.current = loadFocusSessionClock(Date.now());
  }
  const [sessionStarting, setSessionStarting] = useState(false);
  const [focusSessionClock, setFocusSessionClock] = useState<FocusSessionClock>(
    () => focusSessionRef.current!,
  );

  const resetNudgeTracking = useCallback(() => {
    setFocusNudge(null);
    nudgeTrackerRef.current = { distractedSince: null, lastNudgeAt: null };
  }, [nudgeTrackerRef, setFocusNudge]);

  const resetSessionClock = useCallback((now = Date.now()) => {
    const nextFocusSession = resetFocusSessionClock(now);
    focusSessionRef.current = nextFocusSession;
    setFocusSessionClock(nextFocusSession);
    persistFocusSessionClock(nextFocusSession);
    return nextFocusSession;
  }, []);

  const pauseFocusSession = useCallback(() => {
    const now = Date.now();
    const next = pauseFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    writeSessionBoundary(false);
    setFocusNudge(null);
    setStatus(t(locale, "sessionPaused"));
  }, [locale, setFocusNudge, setStatus, writeSessionBoundary]);

  const prepareSessionMonitoring = useCallback(async (): Promise<boolean> => {
    if (sessionStartingRef.current) return false;
    sessionStartingRef.current = true;
    setSessionStarting(true);
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
  }, [locale, refreshActivityWatch, setStatus]);

  const startFocusSession = useCallback(async () => {
    if (!await prepareSessionMonitoring()) return;
    const now = Date.now();
    const next = startFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    resetNudgeTracking();
    setStatus(t(locale, "sessionStarted"));
  }, [locale, prepareSessionMonitoring, resetNudgeTracking, setStatus]);

  const resumeFocusSession = useCallback(async () => {
    if (!await prepareSessionMonitoring()) return;
    const now = Date.now();
    const next = resumeFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    setStatus(t(locale, "sessionResumed"));
  }, [locale, prepareSessionMonitoring, setStatus]);

  const endFocusSession = useCallback(() => {
    const now = Date.now();
    const next = endFocusSessionClock(focusSessionRef.current!, now);
    focusSessionRef.current = next;
    persistFocusSessionClock(next);
    setFocusSessionClock(next);
    writeSessionBoundary(false);
    resetNudgeTracking();
    setStatus(t(locale, "sessionEnded"));
  }, [locale, resetNudgeTracking, setStatus, writeSessionBoundary]);

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
  }, [
    appendSessionEvent,
    aw,
    connected,
    focusSessionClock.status,
    setConnected,
  ]);

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
  }, [connected, focusSessionClock.status, locale, pauseFocusSession, setStatus]);

  return {
    focusSessionClock,
    sessionStarting,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    endFocusSession,
    resetSessionClock,
  };
}
