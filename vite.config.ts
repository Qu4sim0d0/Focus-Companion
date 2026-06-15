import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { request } from "node:http";

function openMacTarget(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("open", args, { stdio: "ignore" });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

function proxyActivityWatch(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:1420");
  const targetPath = url.pathname.replace("/__focus_companion/aw", "/api/0") + url.search;
  const target = request(
    {
      hostname: "127.0.0.1",
      port: 5600,
      path: targetPath,
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] ?? "application/json",
      },
    },
    (targetRes) => {
      res.statusCode = targetRes.statusCode ?? 502;
      for (const [key, value] of Object.entries(targetRes.headers)) {
        if (value !== undefined) res.setHeader(key, value);
      }
      targetRes.pipe(res);
    },
  );
  target.on("error", () => {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "ActivityWatch is not reachable" }));
  });
  req.pipe(target);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "focus-companion-dev-bridge",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith("/__focus_companion/aw/")) {
            proxyActivityWatch(req, res);
            return;
          }

          if (req.method !== "POST") {
            next();
            return;
          }

          if (req.url === "/__focus_companion/start_activitywatch") {
            const candidates = [
              "/Applications/ActivityWatch.app",
              "/Applications/ActivityWatch/ActivityWatch.app",
            ];
            const installedPath = candidates.find((candidate) => existsSync(candidate));
            const ok = installedPath
              ? await openMacTarget([installedPath])
              : await openMacTarget(["-a", "ActivityWatch"]);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ status: ok ? "started" : "failed" }));
            return;
          }

          if (req.url === "/__focus_companion/open_accessibility_settings") {
            const ok = await openMacTarget([
              "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            ]);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ status: ok ? "opened" : "failed" }));
            return;
          }

          if (req.url === "/__focus_companion/open_activitywatch_window") {
            const ok = await openMacTarget(["http://localhost:5600"]);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ status: ok ? "opened" : "failed" }));
            return;
          }

          next();
        });
      },
    },
  ],
  clearScreen: false,
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 1420,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
