# Focus Companion

Local-first macOS focus companion. It combines webcam-derived attention metrics with ActivityWatch foreground-window data, then turns a period of work into daily and weekly review charts.

默认界面为中文，并可在右上角切换 English。

## Status

This is an MVP scaffold:

- Tauri v2 app shell with React/Vite frontend.
- ActivityWatch client for bucket discovery, foreground-window reads, and camera metric heartbeats.
- Browser-local MediaPipe camera metric pipeline.
- Focus aggregation, timeline/trend charts, and Markdown report generation.
- Empty first-run state. The app does not show demo data unless real ActivityWatch data is loaded.
- Local persistence for language, settings, and the latest aggregated daily/weekly summaries.
- User-editable allowed/distracting app lists and camera attention threshold.
- Separate allowed and distracting window-title rules, so different pages inside the same browser can be classified independently.
- Optional personal posture calibration for normal reading and downward writing posture.
- Explicit focus sessions with start, pause, resume, and end controls. Paused time is excluded from reports.
- Tests for aggregation and report output.

The current machine must have Rust/Cargo installed before the Tauri shell can be compiled. The frontend and core TypeScript tests can run with Node alone.

## Requirements

- Node.js 24+
- ActivityWatch running locally on `http://localhost:5600`
- `aw-watcher-window` enabled in ActivityWatch
- Rust + Cargo for `npm run tauri:dev` / `npm run tauri:build`

## Setup

```sh
npm install
npm run setup:assets
npm run dev
```

Open `http://127.0.0.1:1420` for browser-mode development. Browser mode can read ActivityWatch if CORS allows it and can download Markdown reports; the packaged Tauri app also exposes a native report-save command.

## Privacy Defaults

- No webcam images or videos are persisted.
- Camera frames stay in the local WebView and are reduced to numeric metrics.
- Window titles are read from the local ActivityWatch instance and are not uploaded.
- Reports are written locally.
- UI language, app settings, and the latest aggregate summaries are stored in browser/Tauri `localStorage`.
- Settings backups may include the optional numeric posture baseline, but never camera frames or per-sample camera history.

## Focus Rules

The default attention threshold is `0.65`.

Focus is classified from two signals:

- Foreground activity: app/window title from ActivityWatch.
- Camera attention: local face-landmark inference reduced to an `attention_score`.

By default, foreground activity is classified first. When a valid camera measurement exists, a minute is focused when the foreground app matches the allowed app list and attention is above the threshold. It is distracted when the app matches the distracting list or attention falls below the threshold. Missing/failed camera measurements remain empty rather than becoming `0%`. Consecutive no-face samples retain the previous state during a configurable grace period, then become away (`awaySeconds`, 15 seconds by default).

Optional posture calibration stores only median numeric face-landmark signals and adapts scoring to the user's usual reading/writing posture and camera distance. It does not save frames. Face landmarks alone cannot reliably distinguish writing homework from looking at a phone.

The daily attention timeline is a smoothed live 0-100% price-style line chart using the computer's local time. It follows the latest hour automatically; pressing the chart pauses live following so the time axis can be dragged or zoomed.

After loading ActivityWatch, the UI lists today's foreground apps by duration and lets the user classify each app as allowed, neutral, or distracting.

Daily totals only include observed time. If Focus Companion has written session events, totals are limited to those session minutes. If there are no session events yet, the app falls back to minutes covered by ActivityWatch/camera events. It does not count the rest of the unopened day as away.

Focus sessions are user-controlled. Connecting ActivityWatch or starting the camera no longer starts a session implicitly. The local session clock survives a reload, pauses after a stale/sleep-sized gap, and resets at the next local calendar day. Distraction nudges only run while a focus session is active.

The interactive attention timeline loads the chart engine on demand. The daily breakdown and weekly trend use lightweight native SVG charts, keeping them crisp on Retina displays and exportable without loading additional chart modules.

Entertainment apps are not inherently distracting. The user decides by editing the allowed/distracting app lists in the UI.

Window-title rules take priority over app rules. For example, Safari can be an allowed app while a title containing `YouTube` is distracting, or Safari can be distracting by default while a title containing `Online course` is allowed. Distracting window rules win if both window lists match the same title.

## ActivityWatch Startup And Permissions

In the packaged Tauri desktop app, clicking `读取 ActivityWatch` tries to open ActivityWatch before polling `http://localhost:5600/api/0/info`.

In browser development mode, the app cannot launch local macOS apps directly; start ActivityWatch manually or build/run the Tauri app.

macOS accessibility permission cannot be granted programmatically. Use `打开辅助功能权限`, then manually enable ActivityWatch and the packaged app in System Settings.

## Data Model

The app writes webcam metrics into ActivityWatch bucket `focus-camera_<hostname>` with event type `focus.camera.metric`.

Camera event payload:

```json
{
  "present": true,
  "face_count": 1,
  "attention_score": 0.82,
  "looking_away": false,
  "eyes_visible": true,
  "confidence": 0.9
}
```

Focus records are aggregated into one-minute buckets. Focus Companion also keeps a local, per-day timer for how long FC has been open.
