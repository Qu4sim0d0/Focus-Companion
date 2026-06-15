# Focus Companion

Focus Companion is a local-first macOS focus monitor built with React, Tauri,
ActivityWatch, and ECharts.

## Data sources

- ActivityWatch provides foreground app and window-title events.
- macOS CoreGraphics provides only the elapsed time since the latest keyboard,
  mouse, trackpad, or tablet input.
- Focus session boundaries limit report totals to user-controlled sessions.

The app never records key contents, pointer coordinates, or gesture paths.

## Classification

Each observed minute is classified in this order:

1. At least 60 seconds without system input is distracted.
2. A distracting app or window rule is distracted.
3. Other observed time is focused.
4. A minute without window or input observations is away.

Window rules take priority over app rules. A distracting window rule wins when
allowed and distracting window rules both match.

## Charts

- The main timeline shows the latest three hours.
- It renders one bar per minute.
- Focused, distracted, and away use distinct colors and heights.
- Charts and ActivityWatch summaries refresh once per minute.

## ActivityWatch buckets

Focus Companion reads the normal window watcher bucket and writes:

- `focus-input_<hostname>` with event type `focus.input.metric`
- `focus-companion-session_<hostname>` with event type `focus.session`

Input event payload:

```json
{
  "idleSeconds": 12,
  "active": true
}
```

## Development

```bash
npm install
npm run dev
npm test
npm run build
npm run tauri:dev
```
