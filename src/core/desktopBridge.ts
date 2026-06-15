export async function startActivityWatchApp(): Promise<"started" | "browser-mode" | "failed"> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<"started" | "failed">("start_activitywatch");
    } catch {
      return "failed";
    }
  }

  const status = await callDevBridge("/__focus_companion/start_activitywatch");
  return status === "started" ? "started" : status === "failed" ? "failed" : "browser-mode";
}

export async function openActivityWatchWindow(): Promise<"opened" | "browser-mode" | "failed"> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<"opened" | "failed">("open_activitywatch_window");
    } catch {
      return "failed";
    }
  }

  const status = await callDevBridge("/__focus_companion/open_activitywatch_window");
  return status === "opened" ? "opened" : status === "failed" ? "failed" : "browser-mode";
}

export async function openAccessibilitySettings(): Promise<"opened" | "browser-mode" | "failed"> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<"opened" | "failed">("open_accessibility_settings");
    } catch {
      return "failed";
    }
  }

  const status = await callDevBridge("/__focus_companion/open_accessibility_settings");
  return status === "opened" ? "opened" : status === "failed" ? "failed" : "browser-mode";
}

export async function requestFocusNotificationPermission(): Promise<boolean> {
  if ("__TAURI_INTERNALS__" in window) return true;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function sendFocusNotification(title: string, body: string): Promise<boolean> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<boolean>("show_notification", { title, body });
    } catch {
      return false;
    }
  }

  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  new Notification(title, { body, tag: "focus-companion-nudge" });
  return true;
}

async function callDevBridge(path: string): Promise<"started" | "opened" | "browser-mode" | "failed"> {
  try {
    const response = await fetch(path, { method: "POST" });
    if (!response.ok) return "browser-mode";
    const data = (await response.json()) as { status?: "started" | "opened" | "failed" };
    return data.status ?? "failed";
  } catch {
    return "browser-mode";
  }
}
