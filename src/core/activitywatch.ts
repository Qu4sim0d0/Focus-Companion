import type {
  ActivityWatchEvent,
  FocusSessionData,
  InputMetric,
  WindowEventData,
} from "../types";

export interface ActivityWatchBucket {
  id: string;
  type: string;
  client?: string;
  hostname?: string;
  created?: string;
}

export class ActivityWatchClient {
  constructor(private readonly baseUrl = defaultActivityWatchBaseUrl()) {}

  async info(): Promise<Record<string, unknown>> {
    return this.getJson("/info");
  }

  async listBuckets(): Promise<Record<string, ActivityWatchBucket>> {
    return this.getJson("/buckets/");
  }

  async findWindowBucket(): Promise<string | undefined> {
    const buckets = await this.listBuckets();
    return Object.keys(buckets).find((id) => id.startsWith("aw-watcher-window"));
  }

  async ensureInputBucket(hostname = "local"): Promise<string> {
    const id = `focus-input_${hostname}`;
    const buckets = await this.listBuckets();
    if (buckets[id]) return id;

    await this.postJson(`/buckets/${encodeURIComponent(id)}`, {
      client: "focus-companion",
      type: "focus.input.metric",
      hostname,
    });
    return id;
  }

  async ensureSessionBucket(hostname = "local"): Promise<string> {
    const id = `focus-companion-session_${hostname}`;
    const buckets = await this.listBuckets();
    if (buckets[id]) return id;

    await this.postJson(`/buckets/${encodeURIComponent(id)}`, {
      client: "focus-companion",
      type: "focus.session",
      hostname,
    });
    return id;
  }

  async heartbeatInputMetric(
    bucketId: string,
    metric: InputMetric,
    pulsetimeSeconds = 65,
  ): Promise<void> {
    const event: ActivityWatchEvent<InputMetric> = {
      timestamp: new Date().toISOString(),
      duration: 0,
      data: metric,
    };

    await this.postJson(
      `/buckets/${encodeURIComponent(bucketId)}/heartbeat?pulsetime=${pulsetimeSeconds}`,
      event,
    );
  }

  async heartbeatSession(
    bucketId: string,
    running = true,
    pulsetimeSeconds = 65,
  ): Promise<void> {
    const event: ActivityWatchEvent<FocusSessionData> = {
      timestamp: new Date().toISOString(),
      duration: 0,
      data: { running },
    };
    await this.postJson(
      `/buckets/${encodeURIComponent(bucketId)}/heartbeat?pulsetime=${pulsetimeSeconds}`,
      event,
    );
  }

  async getEvents<TData>(
    bucketId: string,
    start: Date,
    end: Date,
  ): Promise<ActivityWatchEvent<TData>[]> {
    const query = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    return this.getJson(`/buckets/${encodeURIComponent(bucketId)}/events?${query.toString()}`);
  }

  async getTodayWindowEvents(): Promise<ActivityWatchEvent<WindowEventData>[]> {
    const bucketId = await this.findWindowBucket();
    if (!bucketId) return [];
    const { start, end } = todayRange();
    return this.getEvents<WindowEventData>(bucketId, start, end);
  }

  async getTodayInputEvents(hostname = "local"): Promise<ActivityWatchEvent<InputMetric>[]> {
    const bucketId = `focus-input_${hostname}`;
    const { start, end } = todayRange();
    return this.getEvents<InputMetric>(bucketId, start, end).catch(() => []);
  }

  async getTodaySessionEvents(hostname = "local"): Promise<ActivityWatchEvent<FocusSessionData>[]> {
    const bucketId = `focus-companion-session_${hostname}`;
    const { start, end } = todayRange();
    return this.getEvents<FocusSessionData>(bucketId, start, end).catch(() => []);
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`ActivityWatch GET ${path} failed with ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private async postJson(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`ActivityWatch POST ${path} failed with ${response.status}`);
    }
  }
}

function defaultActivityWatchBaseUrl(): string {
  if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
    return "/__focus_companion/aw";
  }
  return "http://localhost:5600/api/0";
}

export function todayRange(now = new Date()): { start: Date; end: Date; date: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date: formatLocalDate(start) };
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
