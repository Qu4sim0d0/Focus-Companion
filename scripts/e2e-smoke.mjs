import { spawn } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:1420";

const serverAlreadyRunning = await isReachable(baseUrl);
const server = serverAlreadyRunning
  ? null
  : spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

try {
  if (!serverAlreadyRunning) {
    await waitForServer(baseUrl, 20_000);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.route("**/__focus_companion/start_activitywatch", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "failed" }),
    }),
  );
  await page.route("**/__focus_companion/aw/**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "ActivityWatch is not reachable" }),
    }),
  );

  await page.addInitScript((state) => {
    localStorage.setItem("focus-companion.state.v2", JSON.stringify(state));
  }, buildStoredState());

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "专注伴侣" }).waitFor();
  await page.locator(".chart canvas").first().waitFor({ state: "visible" });
  await page.locator(".native-chart").first().waitFor({ state: "visible" });

  const timelineBox = await page.locator(".chart canvas").first().boundingBox();
  assert(timelineBox && timelineBox.width > 100 && timelineBox.height > 100, "timeline chart should render non-empty canvas");

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("heading", { name: "设置与工具" }).waitFor();
  await page.getByRole("button", { name: "导出日报" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "导出日报" }).isDisabled(), false);
  assert.equal(await page.getByRole("button", { name: "导出周报" }).isDisabled(), false);

  await page.getByRole("button", { name: "重新连接 ActivityWatch" }).click();
  await page.getByRole("alert").waitFor();
  const alertText = await page.getByRole("alert").innerText();
  assert.match(alertText, /ActivityWatch 连接失败/);

  await browser.close();
} finally {
  if (server) {
    server.kill("SIGTERM");
  }
}

function buildStoredState() {
  const date = localDate(new Date());
  const now = new Date();
  now.setSeconds(0, 0);
  const previous = new Date(now.getTime() - 60_000);
  const timeline = [
    {
      minuteStart: previous.toISOString(),
      app: "Code",
      title: "focus.ts",
      state: "focused",
      activityScore: 1,
      inputActive: true,
      reason: {
        code: "allowed-app",
        label: "App matched an allowed rule.",
        pattern: "Code",
      },
    },
    {
      minuteStart: now.toISOString(),
      app: "Safari",
      title: "YouTube",
      state: "distracted",
      activityScore: 0.6,
      inputActive: true,
      reason: {
        code: "distracting-window",
        label: "Window title matched a distracting rule.",
        pattern: "YouTube",
      },
    },
  ];
  const dailySummary = {
    date,
    totalMinutes: 2,
    focusedMinutes: 1,
    distractedMinutes: 1,
    awayMinutes: 0,
    focusRatio: 0.5,
    longestFocusRunMinutes: 1,
    timeline,
  };
  return {
    locale: "zh",
    settings: {
      allowedApps: ["Code"],
      distractingApps: ["Safari"],
      allowedWindowTitles: [],
      distractingWindowTitles: ["YouTube"],
      rules: [],
    },
    dailySummary,
    weeklySummary: {
      weekLabel: `${date} - ${date}`,
      days: [dailySummary],
    },
  };
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function isReachable(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}
