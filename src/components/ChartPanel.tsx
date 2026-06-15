import { memo, useCallback, useEffect, useRef, useState } from "react";
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
  optionFactory?: () => EChartsOption;
  onReady?: (handle: ChartPanelHandle) => void;
  loadingLabel?: string;
}

export const ChartPanel = memo(function ChartPanel({
  title,
  filename,
  option,
  optionFactory,
  onReady,
  loadingLabel = "Loading...",
}: ChartPanelProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const optionFactoryRef = useRef(optionFactory);
  const [loading, setLoading] = useState(true);

  optionRef.current = option;
  optionFactoryRef.current = optionFactory;

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
      const initialOption = optionFactoryRef.current?.() ?? optionRef.current;
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
    if (optionFactory || !option) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option, optionFactory]);

  useEffect(() => {
    if (!optionFactory) return;
    const updateChart = () => {
      const chart = chartRef.current;
      if (!chart) return;
      const nextOption = optionFactoryRef.current?.();
      if (nextOption) {
        chart.setOption(nextOption, { notMerge: true, lazyUpdate: true });
      }
    };
    const intervalId = window.setInterval(updateChart, 60_000);
    return () => window.clearInterval(intervalId);
  }, [optionFactory]);

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
  const sourceRef = useRef(props);
  sourceRef.current = props;
  const optionFactory = useCallback(() => {
    const source = sourceRef.current;
    return dailyTimelineOption(
      source.summary,
      source.locale,
      new Date(),
    );
  }, []);

  return (
    <ChartPanel
      title={props.title}
      filename={props.filename}
      optionFactory={optionFactory}
      onReady={props.onReady}
      loadingLabel={props.loadingLabel}
    />
  );
});
