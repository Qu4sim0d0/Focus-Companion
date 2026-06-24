import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:1420";
const outputDir = "output/playwright";

await mkdir(outputDir, { recursive: true });

const serverAlreadyRunning = await isReachable(baseUrl);
const server = serverAlreadyRunning
  ? null
  : spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

try {
  if (!serverAlreadyRunning) await waitForServer(baseUrl, 20_000);
  const browser = await chromium.launch();
  const state = buildStoredState();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await seedState(desktop, state);
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.locator(".app-shell").waitFor();
  await desktop.screenshot({ path: `${outputDir}/ui-desktop.png`, fullPage: true });

  await desktop.getByRole("button", { name: "设置" }).click();
  await desktop.locator(".settings-drawer").waitFor();
  await desktop.screenshot({ path: `${outputDir}/ui-settings.png` });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 900 },
    isMobile: true,
  });
  await seedState(mobile, state);
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.locator(".app-shell").waitFor();
  await mobile.screenshot({ path: `${outputDir}/ui-mobile.png`, fullPage: true });

  await browser.close();
  console.log(`${outputDir}/ui-desktop.png`);
  console.log(`${outputDir}/ui-settings.png`);
  console.log(`${outputDir}/ui-mobile.png`);
} finally {
  if (server) server.kill("SIGTERM");
}

async function seedState(page, state) {
  await page.addInitScript((storedState) => {
    localStorage.setItem("focus-companion.state.v2", JSON.stringify(storedState));
  }, state);
}

function buildStoredState() {
  const date = localDate(new Date());
  const now = new Date();
  now.setSeconds(0, 0);
  const timeline = Array.from({ length: 90 }, (_, index) => {
    const minuteStart = new Date(now.getTime() - (89 - index) * 60_000).toISOString();
    const distracted = index % 17 === 0 || index % 29 === 0;
    return {
      minuteStart,
      app: distracted ? "Safari" : "Code",
      title: distracted ? "YouTube - 课程推荐" : "Focus Companion / App.tsx",
      state: distracted ? "distracted" : "focused",
      activityScore: distracted ? 0.6 : 1,
      inputActive: true,
      reason: distracted
        ? {
            code: "distracting-window",
            label: "Window title matched a distracting rule.",
            pattern: "YouTube",
          }
        : {
            code: "allowed-app",
            label: "App matched an allowed rule.",
            pattern: "Code",
          },
    };
  });
  const focusedMinutes = timeline.filter((record) => record.state === "focused").length;
  const distractedMinutes = timeline.length - focusedMinutes;
  const dailySummary = {
    date,
    totalMinutes: timeline.length,
    focusedMinutes,
    distractedMinutes,
    awayMinutes: 0,
    focusRatio: focusedMinutes / timeline.length,
    longestFocusRunMinutes: 16,
    timeline,
  };
  return {
    locale: "zh",
    settings: {
      workdayStartHour: 8,
      workdayEndHour: 22,
      nudgesEnabled: false,
      inputIdleThresholdSeconds: 60,
      distractNudgeSeconds: 60,
      allowedApps: ["Code", "Terminal", "Xcode"],
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
