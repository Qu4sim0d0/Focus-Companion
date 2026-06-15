import type { DailySummary, WeeklySummary } from "../types";
import { compressTimeline } from "./focus";

export interface ChartAsset {
  filename: string;
  dataUrl: string;
}

export function buildDailyMarkdown(summary: DailySummary, chartAssets: ChartAsset[] = []): string {
  const lines = [
    `# Focus Report: ${summary.date}`,
    "",
    metricLine("Focused", summary.focusedMinutes),
    metricLine("Distracted", summary.distractedMinutes),
    metricLine("Away", summary.awayMinutes),
    `- Focus ratio: ${(summary.focusRatio * 100).toFixed(1)}%`,
    `- Longest focus run: ${summary.longestFocusRunMinutes} minutes`,
    "",
  ];

  for (const asset of chartAssets) {
    lines.push(`![${asset.filename}](assets/${asset.filename})`, "");
  }

  lines.push("## Timeline", "", "| Time | State | App | Title | Activity |", "| --- | --- | --- | --- | --- |");
  for (const record of compressTimeline(summary.timeline)) {
    lines.push(
      `| ${new Date(record.minuteStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} | ${record.state} | ${escapeCell(record.app)} | ${escapeCell(record.title)} | ${record.activityScore.toFixed(2)} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildWeeklyMarkdown(summary: WeeklySummary, chartAssets: ChartAsset[] = []): string {
  const lines = [`# Focus Weekly Report: ${summary.weekLabel}`, ""];
  for (const asset of chartAssets) {
    lines.push(`![${asset.filename}](assets/${asset.filename})`, "");
  }

  lines.push("| Date | Focused | Distracted | Away | Focus ratio |", "| --- | ---: | ---: | ---: | ---: |");
  for (const day of summary.days) {
    lines.push(
      `| ${day.date} | ${day.focusedMinutes}m | ${day.distractedMinutes}m | ${day.awayMinutes}m | ${(day.focusRatio * 100).toFixed(1)}% |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function saveMarkdownReport(
  filename: string,
  markdown: string,
  assets: ChartAsset[],
  reportDir?: string,
): Promise<string | undefined> {
  if (!("__TAURI_INTERNALS__" in window)) {
    downloadText(filename, inlineAssets(markdown, assets));
    return undefined;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_report", {
    filename,
    markdown,
    assets,
    reportDir,
  });
}

function inlineAssets(markdown: string, assets: ChartAsset[]): string {
  return assets.reduce(
    (next, asset) => next.replace(`assets/${asset.filename}`, asset.dataUrl),
    markdown,
  );
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function metricLine(label: string, minutes: number): string {
  return `- ${label}: ${minutes} minutes`;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
