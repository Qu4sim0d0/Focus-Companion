import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { EChartsType } from "echarts/core";
import type { EChartsOption } from "echarts";
import { dailyTimelineOption } from "./charts";
import type {
  DailySummary,
} from "../types";
import type { Locale } from "../i18n";

export interface ChartPanelHandle {
  filename: string;
  getDataUrl: () => string;
}

interface ChartPanelProps {
  title: string;
  filename: string;
  option?: EChartsOption;
  onReady?: (handle: ChartPanelHandle) => void;
  loadingLabel?: string;
}

export const ChartPanel = memo(function ChartPanel({
  title,
  filename,
  option,
  onReady,
  loadingLabel = "Loading...",
}: ChartPanelProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const [loading, setLoading] = useState(true);

  optionRef.current = option;

  useEffect(() => {
    if (!elementRef.current) return;
    let cancelled = false;
    let chart: EChartsType | null = null;
    setLoading(true);
    let resizeFrame: number | undefined;
    const resize = () => {
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => chart?.resize());
    };
    window.addEventListener("resize", resize);
    void import("./chartRuntime").then((echarts) => {
      if (cancelled || !elementRef.current) return;
      chart = echarts.init(elementRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      const initialOption = optionRef.current;
      if (initialOption) {
        chart.setOption(initialOption, { notMerge: true, lazyUpdate: true });
      }
      onReady?.({
        filename,
        getDataUrl: () =>
          chart!.getDataURL({
            type: "png",
            pixelRatio: 2,
            backgroundColor: "#ffffff",
          }),
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      chart?.dispose();
      chartRef.current = null;
    };
  }, [filename, onReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!option) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <div className="chart-shell" aria-busy={loading}>
        {loading ? <div className="chart-loading">{loadingLabel}</div> : null}
        <div
          className="chart"
          ref={elementRef}
          role="img"
          aria-label={title}
        />
      </div>
    </section>
  );
});

interface TimelineChartPanelProps {
  title: string;
  filename: string;
  summary: DailySummary;
  locale: Locale;
  onReady?: (handle: ChartPanelHandle) => void;
  loadingLabel: string;
}

export const TimelineChartPanel = memo(function TimelineChartPanel(
  props: TimelineChartPanelProps,
) {
  const option = useMemo(
    () =>
      dailyTimelineOption(
        props.summary,
        props.locale,
        new Date(),
      ),
    [props.locale, props.summary],
  );

  return (
    <ChartPanel
      title={props.title}
      filename={props.filename}
      option={option}
      onReady={props.onReady}
      loadingLabel={props.loadingLabel}
    />
  );
}, (previous, next) => {
  if (
    previous.title !== next.title ||
    previous.filename !== next.filename ||
    previous.locale !== next.locale ||
    previous.onReady !== next.onReady ||
    previous.loadingLabel !== next.loadingLabel
  ) {
    return false;
  }
  const previousLast = previous.summary.timeline.at(-1);
  const nextLast = next.summary.timeline.at(-1);
  return (
    previous.summary.date === next.summary.date &&
    previous.summary.totalMinutes === next.summary.totalMinutes &&
    previous.summary.focusedMinutes === next.summary.focusedMinutes &&
    previous.summary.distractedMinutes === next.summary.distractedMinutes &&
    previousLast?.minuteStart === nextLast?.minuteStart &&
    previousLast?.state === nextLast?.state &&
    previousLast?.app === nextLast?.app &&
    previousLast?.title === nextLast?.title
  );
});
