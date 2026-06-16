import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import type { DailySummary, FocusState, WeeklySummary } from "../types";
import { t, type Locale } from "../i18n";
import type { ChartPanelHandle } from "./ChartPanel";

const colors: Record<FocusState, string> = {
  focused: "#16a36a",
  distracted: "#e8872e",
};

interface SummaryChartProps {
  filename: string;
  locale: Locale;
  onReady?: (handle: ChartPanelHandle) => void;
}

export const DailyBreakdownChart = memo(function DailyBreakdownChart({
  summary,
  filename,
  locale,
  onReady,
}: SummaryChartProps & { summary: DailySummary }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const segments = useMemo(() => buildDonutSegments(summary), [summary]);
  useSvgChartHandle(svgRef, filename, onReady);

  return (
    <section className="panel chart-panel">
      <div className="panel-header"><h2>{t(locale, "dailyBreakdown")}</h2></div>
      <div className="native-chart-shell">
        <svg
          ref={svgRef}
          className="native-chart"
          viewBox="0 0 520 320"
          role="img"
          aria-label={t(locale, "dailyBreakdown")}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="520" height="320" fill="#ffffff" />
          {summary.totalMinutes === 0 ? (
            <text className="chart-empty-label" x="260" y="165" textAnchor="middle">
              {t(locale, "noValidRecords")}
            </text>
          ) : (
            <>
              <g transform="translate(180 160) rotate(-90)">
                <circle r="92" fill="none" stroke="#eef2f7" strokeWidth="54" />
                {segments.map((segment) => (
                  <circle
                    key={segment.state}
                    r="92"
                    fill="none"
                    stroke={colors[segment.state]}
                    strokeWidth="54"
                    strokeDasharray={`${segment.length} ${segment.circumference - segment.length}`}
                    strokeDashoffset={-segment.offset}
                  >
                    <title>
                      {t(locale, segment.state)}: {segment.minutes} {t(locale, "minutesShort")}
                    </title>
                  </circle>
                ))}
              </g>
              <text x="180" y="153" textAnchor="middle" className="donut-total">
                {summary.totalMinutes}
              </text>
              <text x="180" y="176" textAnchor="middle" className="donut-caption">
                {t(locale, "minutesShort")}
              </text>
              <g transform="translate(335 94)">
                {segments.map((segment, index) => (
                  <g key={segment.state} transform={`translate(0 ${index * 58})`}>
                    <circle cx="8" cy="8" r="7" fill={colors[segment.state]} />
                    <text x="26" y="5" className="legend-label">{t(locale, segment.state)}</text>
                    <text x="26" y="25" className="legend-value">
                      {segment.minutes} {t(locale, "minutesShort")} · {Math.round(segment.ratio * 100)}%
                    </text>
                  </g>
                ))}
              </g>
            </>
          )}
        </svg>
      </div>
    </section>
  );
}, (previous, next) =>
  previous.filename === next.filename &&
  previous.locale === next.locale &&
  previous.onReady === next.onReady &&
  sameDailyTotals(previous.summary, next.summary)
);

export const WeeklyTrendChart = memo(function WeeklyTrendChart({
  summary,
  filename,
  locale,
  onReady,
}: SummaryChartProps & { summary: WeeklySummary }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const model = useMemo(() => buildWeeklyChartModel(summary), [summary]);
  useSvgChartHandle(svgRef, filename, onReady);

  return (
    <section className="panel chart-panel">
      <div className="panel-header"><h2>{t(locale, "weeklyTrend")}</h2></div>
      <div className="native-chart-shell">
        <svg
          ref={svgRef}
          className="native-chart"
          viewBox="0 0 560 320"
          role="img"
          aria-label={t(locale, "weeklyTrend")}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="560" height="320" fill="#ffffff" />
          {model.empty ? (
            <text className="chart-empty-label" x="280" y="165" textAnchor="middle">
              {t(locale, "noValidRecords")}
            </text>
          ) : (
            <>
              {model.grid.map((tick) => (
                <g key={tick.value}>
                  <line x1="48" x2="536" y1={tick.y} y2={tick.y} className="chart-grid-line" />
                  <text x="40" y={tick.y + 4} textAnchor="end" className="axis-label">{tick.value}</text>
                </g>
              ))}
              {model.labels.map((label) => (
                <text key={label.text} x={label.x} y="274" textAnchor="middle" className="axis-label">
                  {label.text}
                </text>
              ))}
              {model.series.map((series) => (
                <g key={series.state}>
                  <path
                    d={series.path}
                    fill="none"
                    stroke={colors[series.state]}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {series.points.map((point, index) => (
                    <circle
                      key={`${series.state}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="#ffffff"
                      stroke={colors[series.state]}
                      strokeWidth="2.5"
                    >
                      <title>
                        {summary.days[index]?.date} · {t(locale, series.state)}: {point.value} {t(locale, "minutesShort")}
                      </title>
                    </circle>
                  ))}
                </g>
              ))}
              <g transform="translate(58 302)">
                {model.series.map((series, index) => (
                  <g key={series.state} transform={`translate(${index * 112} 0)`}>
                    <line x1="0" x2="18" y1="0" y2="0" stroke={colors[series.state]} strokeWidth="3" />
                    <text x="25" y="4" className="legend-label">{t(locale, series.state)}</text>
                  </g>
                ))}
              </g>
            </>
          )}
        </svg>
      </div>
    </section>
  );
}, (previous, next) =>
  previous.filename === next.filename &&
  previous.locale === next.locale &&
  previous.onReady === next.onReady &&
  previous.summary.weekLabel === next.summary.weekLabel &&
  previous.summary.days.length === next.summary.days.length &&
  previous.summary.days.every((day, index) =>
    sameDailyTotals(day, next.summary.days[index]),
  )
);

export interface DonutSegment {
  state: FocusState;
  minutes: number;
  ratio: number;
  circumference: number;
  length: number;
  offset: number;
}

export function buildDonutSegments(summary: DailySummary): DonutSegment[] {
  const circumference = 2 * Math.PI * 92;
  const values: Array<[FocusState, number]> = [
    ["focused", summary.focusedMinutes],
    ["distracted", summary.distractedMinutes],
  ];
  let offset = 0;
  return values.map(([state, minutes]) => {
    const ratio = summary.totalMinutes === 0 ? 0 : minutes / summary.totalMinutes;
    const length = ratio * circumference;
    const segment = { state, minutes, ratio, circumference, length, offset };
    offset += length;
    return segment;
  });
}

export function buildWeeklyChartModel(summary: WeeklySummary) {
  const states: FocusState[] = ["focused", "distracted"];
  const values = summary.days.flatMap((day) => [
    day.focusedMinutes,
    day.distractedMinutes,
  ]);
  const maxValue = Math.max(1, ...values);
  const roundedMax = Math.max(5, Math.ceil(maxValue / 5) * 5);
  const left = 48;
  const right = 536;
  const top = 28;
  const bottom = 252;
  const xStep = summary.days.length > 1 ? (right - left) / (summary.days.length - 1) : 0;
  const y = (value: number) => bottom - (value / roundedMax) * (bottom - top);
  const labels = summary.days.map((day, index) => ({
    text: day.date.slice(5),
    x: left + index * xStep,
  }));
  const series = states.map((state) => {
    const points = summary.days.map((day, index) => {
      const value = state === "focused"
        ? day.focusedMinutes
        : day.distractedMinutes;
      return { x: left + index * xStep, y: y(value), value };
    });
    return {
      state,
      points,
      path: points.map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      ).join(" "),
    };
  });
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((roundedMax * index) / 4);
    return { value, y: y(value) };
  });
  return {
    empty: summary.days.every((day) => day.totalMinutes === 0),
    grid,
    labels,
    series,
  };
}

function useSvgChartHandle(
  svgRef: RefObject<SVGSVGElement | null>,
  filename: string,
  onReady?: (handle: ChartPanelHandle) => void,
) {
  useEffect(() => {
    onReady?.({
      filename,
      getDataUrl: () => svgDataUrl(svgRef.current),
    });
  }, [filename, onReady, svgRef]);
}

function svgDataUrl(svg: SVGSVGElement | null): string {
  if (!svg) return "";
  const serialized = new XMLSerializer().serializeToString(svg);
  const bytes = new TextEncoder().encode(serialized);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function sameDailyTotals(left: DailySummary, right: DailySummary): boolean {
  return left.date === right.date &&
    left.totalMinutes === right.totalMinutes &&
    left.focusedMinutes === right.focusedMinutes &&
    left.distractedMinutes === right.distractedMinutes;
}
