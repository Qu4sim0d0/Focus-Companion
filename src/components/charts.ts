import type { EChartsOption } from "echarts";
import type {
  ActivityWatchEvent,
  CameraMetric,
  DailySummary,
  FocusState,
  WeeklySummary,
} from "../types";
import { compressTimeline } from "../core/focus";
import type { Locale } from "../i18n";

const stateColors: Record<FocusState, string> = {
  focused: "#1f9d55",
  distracted: "#d9822b",
  away: "#6b7280",
};

const chartLabels: Record<
  Locale,
  Record<
    FocusState | "minutes" | "state" | "app" | "title" | "attention" | "noAttention" | "noData",
    string
  >
> = {
  zh: {
    focused: "专注",
    distracted: "分心",
    away: "离开",
    minutes: "分钟",
    state: "状态",
    app: "应用",
    title: "窗口",
    attention: "注意力",
    noAttention: "无有效注意力数据",
    noData: "暂无有效记录",
  },
  en: {
    focused: "Focused",
    distracted: "Distracted",
    away: "Away",
    minutes: "minutes",
    state: "State",
    app: "App",
    title: "Title",
    attention: "Attention",
    noAttention: "No valid attention data",
    noData: "No valid records yet",
  },
};

export function dailyTimelineOption(
  summary: DailySummary,
  locale: Locale = "zh",
  now = new Date(),
  cameraEvents: ActivityWatchEvent<CameraMetric>[] = [],
  attentionThreshold = 0.65,
): EChartsOption {
  const records = compressTimeline(summary.timeline, 1);
  const text = chartLabels[locale];
  const dayStart = new Date(`${summary.date}T00:00:00.000`).getTime();
  const dayEnd = Math.min(now.getTime(), dayStart + 24 * 60 * 60 * 1000);
  const points = buildAttentionPoints(records, cameraEvents);

  return {
    animation: true,
    animationDuration: 500,
    animationDurationUpdate: 950,
    animationEasing: "cubicOut",
    animationEasingUpdate: "linear",
    grid: { left: 16, right: 58, top: 22, bottom: 58, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc" },
      axisPointer: {
        type: "line",
        lineStyle: { color: "#64748b", type: "dashed" },
      },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const dataIndex = typeof item.dataIndex === "number" ? item.dataIndex : 0;
        const point = points[dataIndex];
        if (!point) return "";
        return [
          formatLocalTime(point.timestamp),
          `${text.state}: ${text[point.state]}`,
          point.app ? `${text.app}: ${point.app}` : undefined,
          point.title ? `${text.title}: ${point.title}` : undefined,
          point.score === null
            ? `${text.attention}: ${text.noAttention}`
            : `${text.attention}: ${Math.round(point.score * 100)}%`,
        ]
          .filter(Boolean)
          .join("<br/>");
      },
    },
    xAxis: {
      type: "time",
      min: dayStart,
      max: dayEnd,
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
      axisLabel: { color: "#64748b", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
    },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none",
        zoomOnMouseWheel: false,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
        preventDefaultMouseMove: true,
      },
      {
        type: "slider",
        xAxisIndex: 0,
        filterMode: "none",
        height: 18,
        bottom: 8,
        brushSelect: false,
        showDetail: false,
        borderColor: "transparent",
        backgroundColor: "#f1f5f9",
        fillerColor: "rgba(37, 99, 235, 0.12)",
        handleStyle: { color: "#93c5fd", borderColor: "#60a5fa" },
        dataBackground: {
          lineStyle: { color: "#94a3b8" },
          areaStyle: { color: "rgba(148, 163, 184, 0.12)" },
        },
      },
    ],
    series: [
      {
        name: text.attention,
        type: "line",
        smooth: 0.28,
        smoothMonotone: "x",
        showSymbol: false,
        symbol: "none",
        connectNulls: false,
        sampling: "lttb",
        lineStyle: {
          color: "#2563eb",
          width: 2.5,
          shadowBlur: 8,
          shadowColor: "rgba(37, 99, 235, 0.24)",
        },
        itemStyle: { color: "#2563eb" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(37, 99, 235, 0.24)" },
              { offset: 1, color: "rgba(37, 99, 235, 0.01)" },
            ],
          },
        },
        endLabel: {
          show: points.filter((point) => point.score !== null).length > 1,
          color: "#1d4ed8",
          fontWeight: 700,
          formatter: (params) => {
            const value = Array.isArray(params.value) ? params.value[1] : undefined;
            return typeof value === "number" ? `${Math.round(value)}%` : "";
          },
        },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "#f59e0b", type: "dashed", opacity: 0.65 },
          data: [{ yAxis: Math.round(attentionThreshold * 100) }],
        },
        data: points.map((point) => [
          point.timestamp,
          point.score === null ? null : Math.round(point.score * 100),
        ]),
      },
    ],
  };
}

interface AttentionPoint {
  timestamp: number;
  score: number | null;
  state: FocusState;
  app: string;
  title: string;
}

function buildAttentionPoints(
  records: ReturnType<typeof compressTimeline>,
  cameraEvents: ActivityWatchEvent<CameraMetric>[],
): AttentionPoint[] {
  const recordsByMinute = new Map(
    records.map((record) => [startOfMinuteMs(record.minuteStart), record]),
  );
  const validEvents = cameraEvents
    .filter((event) => event.data.detector_ready !== false)
    .slice()
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  if (validEvents.length > 0) {
    let smoothedScore: number | null = null;
    return validEvents.map((event) => {
      const timestamp = new Date(event.timestamp).getTime();
      const record = recordsByMinute.get(startOfMinuteMs(timestamp));
      if (event.data.present) {
        smoothedScore =
          smoothedScore === null
            ? event.data.attention_score
            : smoothedScore * 0.72 + event.data.attention_score * 0.28;
      } else {
        smoothedScore = null;
      }
      return {
        timestamp,
        score: smoothedScore,
        state: record?.state ?? (event.data.present ? "distracted" : "away"),
        app: record?.app ?? "",
        title: record?.title ?? "",
      };
    });
  }

  return records.map((record) => ({
    timestamp: new Date(record.minuteStart).getTime(),
    score: record.attentionScore,
    state: record.state,
    app: record.app,
    title: record.title,
  }));
}

function startOfMinuteMs(value: string | number): number {
  const date = new Date(value);
  date.setSeconds(0, 0);
  return date.getTime();
}

function formatLocalTime(value: string | number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dailyBreakdownOption(summary: DailySummary, locale: Locale = "zh"): EChartsOption {
  const text = chartLabels[locale];
  if (summary.totalMinutes === 0) return emptyChartOption(text.noData);

  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["42%", "72%"],
        data: [
          { name: text.focused, value: summary.focusedMinutes, itemStyle: { color: stateColors.focused } },
          { name: text.distracted, value: summary.distractedMinutes, itemStyle: { color: stateColors.distracted } },
          { name: text.away, value: summary.awayMinutes, itemStyle: { color: stateColors.away } },
        ],
      },
    ],
  };
}

export function weeklyTrendOption(summary: WeeklySummary, locale: Locale = "zh"): EChartsOption {
  const text = chartLabels[locale];
  if (summary.days.every((day) => day.totalMinutes === 0)) {
    return emptyChartOption(text.noData);
  }

  return {
    grid: { left: 48, right: 24, top: 24, bottom: 42 },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    xAxis: { type: "category", data: summary.days.map((day) => day.date.slice(5)) },
    yAxis: { type: "value", name: text.minutes },
    series: [
      {
        name: text.focused,
        type: "line",
        smooth: true,
        color: stateColors.focused,
        data: summary.days.map((day) => day.focusedMinutes),
      },
      {
        name: text.distracted,
        type: "line",
        smooth: true,
        color: stateColors.distracted,
        data: summary.days.map((day) => day.distractedMinutes),
      },
      {
        name: text.away,
        type: "line",
        smooth: true,
        color: stateColors.away,
        data: summary.days.map((day) => day.awayMinutes),
      },
    ],
  };
}

function emptyChartOption(label: string): EChartsOption {
  return {
    title: {
      text: label,
      left: "center",
      top: "middle",
      textStyle: {
        color: "#64748b",
        fontSize: 14,
        fontWeight: 600,
      },
    },
    series: [],
  };
}
