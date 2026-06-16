import type { EChartsOption } from "echarts";
import type {
  DailySummary,
  FocusState,
  WeeklySummary,
} from "../types";
import { compressTimeline } from "../core/focus";
import type { Locale } from "../i18n";

const stateColors: Record<FocusState, string> = {
  focused: "#1f9d55",
  distracted: "#d9822b",
};

const stateHeights: Record<FocusState, number> = {
  focused: 100,
  distracted: 60,
};

const timelineWindowMs = 3 * 60 * 60 * 1000;

const chartLabels: Record<
  Locale,
  Record<
    FocusState | "minutes" | "state" | "app" | "title" | "activity" | "noData",
    string
  >
> = {
  zh: {
    focused: "专注",
    distracted: "分心",
    minutes: "分钟",
    state: "状态",
    app: "应用",
    title: "窗口",
    activity: "输入状态",
    noData: "暂无有效记录",
  },
  en: {
    focused: "Focused",
    distracted: "Distracted",
    minutes: "minutes",
    state: "State",
    app: "App",
    title: "Title",
    activity: "Input state",
    noData: "No valid records yet",
  },
};

export function dailyTimelineOption(
  summary: DailySummary,
  locale: Locale = "zh",
  now = new Date(),
): EChartsOption {
  const records = compressTimeline(summary.timeline, 1);
  const text = chartLabels[locale];
  const dayStart = new Date(`${summary.date}T00:00:00.000`).getTime();
  const timelineEnd = Math.min(now.getTime(), dayStart + 24 * 60 * 60 * 1000);
  const timelineStart = Math.max(dayStart, timelineEnd - timelineWindowMs);
  const visibleRecords = records.filter((record) => {
    const timestamp = new Date(record.minuteStart).getTime();
    return timestamp >= timelineStart && timestamp <= timelineEnd;
  });

  return {
    animation: false,
    grid: { left: 16, right: 42, top: 22, bottom: 34, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc" },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const dataIndex = typeof item?.dataIndex === "number" ? item.dataIndex : 0;
        const record = visibleRecords[dataIndex];
        if (!record) return "";
        return [
          formatLocalTime(new Date(record.minuteStart).getTime()),
          `${text.state}: ${text[record.state]}`,
          record.app ? `${text.app}: ${record.app}` : undefined,
          record.title ? `${text.title}: ${record.title}` : undefined,
        ].filter(Boolean).join("<br/>");
      },
    },
    xAxis: {
      type: "time",
      min: timelineStart,
      max: timelineEnd,
      boundaryGap: [0, 0],
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: "#64748b",
        hideOverlap: true,
        formatter: (value: number) => formatLocalTime(value),
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      position: "right",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
    },
    series: [
      {
        name: text.activity,
        type: "bar",
        barWidth: "70%",
        itemStyle: { borderRadius: [2, 2, 0, 0] },
        data: visibleRecords.map((record) => ({
          value: [
            new Date(record.minuteStart).getTime(),
            stateHeights[record.state],
          ],
          itemStyle: { color: stateColors[record.state] },
        })),
      },
    ],
  };
}

export function dailyBreakdownOption(
  summary: DailySummary,
  locale: Locale = "zh",
): EChartsOption {
  const text = chartLabels[locale];
  const data = (["focused", "distracted"] as FocusState[])
    .map((state) => ({
      name: text[state],
      value: summary[`${state}Minutes` as keyof DailySummary] as number,
      itemStyle: { color: stateColors[state] },
    }))
    .filter((item) => item.value > 0);

  if (data.length === 0) {
    return emptyOption(text.noData);
  }

  return {
    animation: false,
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#475569" } },
    series: [{
      type: "pie",
      radius: ["52%", "72%"],
      center: ["50%", "44%"],
      label: { formatter: "{b}\n{c}m", color: "#334155" },
      data,
    }],
  };
}

export function weeklyTrendOption(
  summary: WeeklySummary,
  locale: Locale = "zh",
): EChartsOption {
  const text = chartLabels[locale];
  if (summary.days.every((day) => day.totalMinutes === 0)) {
    return emptyOption(text.noData);
  }

  return {
    animation: false,
    tooltip: { trigger: "axis" },
    legend: {
      bottom: 0,
      data: [text.focused, text.distracted],
      textStyle: { color: "#475569" },
    },
    grid: { left: 36, right: 16, top: 20, bottom: 44 },
    xAxis: {
      type: "category",
      data: summary.days.map((day) => day.date.slice(5)),
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
    },
    series: (["focused", "distracted"] as FocusState[]).map((state) => ({
      name: text[state],
      type: "line",
      smooth: true,
      symbolSize: 7,
      lineStyle: { width: 2.5, color: stateColors[state] },
      itemStyle: { color: stateColors[state] },
      data: summary.days.map(
        (day) => day[`${state}Minutes` as keyof DailySummary] as number,
      ),
    })),
  };
}

function emptyOption(message: string): EChartsOption {
  return {
    animation: false,
    title: {
      text: message,
      left: "center",
      top: "middle",
      textStyle: { color: "#64748b", fontSize: 14, fontWeight: 500 },
    },
    series: [],
  };
}

function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
