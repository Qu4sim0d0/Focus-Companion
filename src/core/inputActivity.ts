import { useSyncExternalStore } from "react";
import { getSystemIdleSeconds } from "./desktopBridge";
import { inputIdleThresholdSeconds } from "./focus";

export interface InputActivitySnapshot {
  idleSeconds: number;
  active: boolean;
  available: boolean;
  scope: "system" | "window";
  updatedAt: number;
}

const listeners = new Set<() => void>();
let intervalId: number | undefined;
let lastWindowInputAt = Date.now();
let windowListenersInstalled = false;
let snapshot: InputActivitySnapshot = {
  idleSeconds: 0,
  active: true,
  available: true,
  scope: typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? "system"
    : "window",
  updatedAt: Date.now(),
};

export function useInputActivity(): InputActivitySnapshot {
  return useSyncExternalStore(subscribe, getInputActivitySnapshot, getServerSnapshot);
}

export function getInputActivitySnapshot(): InputActivitySnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) startMonitoring();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopMonitoring();
  };
}

function getServerSnapshot(): InputActivitySnapshot {
  return snapshot;
}

function startMonitoring(): void {
  if (typeof window === "undefined" || intervalId !== undefined) return;
  if (!("__TAURI_INTERNALS__" in window)) installWindowListeners();
  void updateSnapshot();
  intervalId = window.setInterval(() => void updateSnapshot(), 1_000);
}

function stopMonitoring(): void {
  if (typeof window === "undefined" || intervalId === undefined) return;
  window.clearInterval(intervalId);
  intervalId = undefined;
}

async function updateSnapshot(): Promise<void> {
  const now = Date.now();
  const isDesktop = "__TAURI_INTERNALS__" in window;
  const systemIdleSeconds = await getSystemIdleSeconds();
  if (isDesktop && systemIdleSeconds === null) {
    snapshot = {
      idleSeconds: 0,
      active: true,
      available: false,
      scope: "system",
      updatedAt: now,
    };
    listeners.forEach((listener) => listener());
    return;
  }
  const usingSystemIdle = systemIdleSeconds !== null;
  const idleSeconds = Math.max(
    0,
    usingSystemIdle ? systemIdleSeconds : (now - lastWindowInputAt) / 1_000,
  );
  snapshot = {
    idleSeconds,
    active: idleSeconds < inputIdleThresholdSeconds,
    available: true,
    scope: usingSystemIdle ? "system" : "window",
    updatedAt: now,
  };
  listeners.forEach((listener) => listener());
}

function installWindowListeners(): void {
  if (windowListenersInstalled || typeof window === "undefined") return;
  windowListenersInstalled = true;
  const recordInput = () => {
    lastWindowInputAt = Date.now();
  };
  for (const eventName of [
    "keydown",
    "pointerdown",
    "pointermove",
    "wheel",
    "touchstart",
  ]) {
    window.addEventListener(eventName, recordInput, { passive: true });
  }
}
