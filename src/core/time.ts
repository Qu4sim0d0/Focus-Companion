import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let nowMs = Date.now();
let intervalId: number | undefined;

function emitTick() {
  nowMs = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    emitTick();
    intervalId = window.setInterval(emitTick, 1_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== undefined) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}

function getSnapshot() {
  return nowMs;
}

export function useTime(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
