import type {
  ActivityWatchEvent,
  FocusSettings,
  WindowEventData,
} from "../types";
import { explainWindowScore } from "./focus";

export interface ObservedApp {
  name: string;
  seconds: number;
}

export interface ObservedWindow {
  app: string;
  title: string;
  seconds: number;
}

export function summarizeObservedApps(
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

export function summarizeObservedWindows(
  events: ActivityWatchEvent<WindowEventData>[],
): ObservedWindow[] {
  const durations = new Map<string, ObservedWindow>();
  for (const event of events) {
    const app = event.data.app?.trim() ?? "";
    const title = event.data.title?.trim() ?? "";
    if (!title) continue;
    const key = `${app.toLocaleLowerCase()}\u0000${title.toLocaleLowerCase()}`;
    const current = durations.get(key);
    durations.set(key, {
      app: current?.app ?? app,
      title: current?.title ?? title,
      seconds: (current?.seconds ?? 0) + Math.max(0, event.duration),
    });
  }
  return Array.from(durations.values())
    .sort((left, right) =>
      right.seconds - left.seconds ||
      left.app.localeCompare(right.app) ||
      left.title.localeCompare(right.title));
}

export function observedAppMode(
  app: string,
  settings: FocusSettings,
): "focus" | "distract" {
  const normalized = app.toLocaleLowerCase();
  if (settings.distractingApps.some((value) => value.toLocaleLowerCase() === normalized)) {
    return "distract";
  }
  return "focus";
}

export function observedWindowMode(
  item: ObservedWindow,
  settings: FocusSettings,
): "focus" | "distract" {
  const explanation = explainWindowScore({
    timestamp: new Date().toISOString(),
    duration: 0,
    data: { app: item.app, title: item.title },
  }, settings);
  return explanation.score === "distract" ? "distract" : "focus";
}
