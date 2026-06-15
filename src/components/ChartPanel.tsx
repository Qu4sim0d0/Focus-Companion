import { useEffect, useRef, useState } from "react";
import type { EChartsType } from "echarts/core";
import type { EChartsOption } from "echarts";

export interface ChartPanelHandle {
  filename: string;
  getDataUrl: () => string;
}

interface ChartPanelProps {
  title: string;
  filename: string;
  option: EChartsOption;
  onReady?: (handle: ChartPanelHandle) => void;
  loadingLabel?: string;
  live?: {
    endTime: number;
    windowMs: number;
    followingLabel: string;
    pausedLabel: string;
    resumeLabel: string;
  };
}

export function ChartPanel({ title, filename, option, onReady, loadingLabel = "Loading...", live }: ChartPanelProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const liveRef = useRef(live);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const pausedRef = useRef(false);

  optionRef.current = option;
  liveRef.current = live;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!elementRef.current) return;
    let cancelled = false;
    let chart: EChartsType | null = null;
    setLoading(true);
    const resize = () => chart?.resize();
    window.addEventListener("resize", resize);
    void import("./chartRuntime").then((echarts) => {
      if (cancelled || !elementRef.current) return;
      chart = echarts.init(elementRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      chart.setOption(optionRef.current, { notMerge: true, lazyUpdate: true });
      const currentLive = liveRef.current;
      if (currentLive && !pausedRef.current) {
        chart.dispatchAction({
          type: "dataZoom",
          startValue: currentLive.endTime - currentLive.windowMs,
          endValue: currentLive.endTime,
        });
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
      chart?.dispose();
      chartRef.current = null;
    };
  }, [filename, onReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
    if (live && !pausedRef.current) {
      chart.dispatchAction({
        type: "dataZoom",
        startValue: live.endTime - live.windowMs,
        endValue: live.endTime,
      });
    }
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !live || pausedRef.current) return;
    chart.setOption(
      { xAxis: { max: live.endTime } },
      { lazyUpdate: true },
    );
    chart.dispatchAction({
      type: "dataZoom",
      startValue: live.endTime - live.windowMs,
      endValue: live.endTime,
    });
  }, [live?.endTime, live?.windowMs]);

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {live ? (
          <button
            className="live-toggle"
            data-paused={paused}
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? live.resumeLabel : live.followingLabel}
          </button>
        ) : null}
      </div>
      {live && paused ? <p className="chart-interaction-status">{live.pausedLabel}</p> : null}
      <div className="chart-shell" aria-busy={loading}>
        {loading ? <div className="chart-loading">{loadingLabel}</div> : null}
        <div
          className="chart"
          ref={elementRef}
          role="img"
          aria-label={title}
          onPointerDown={() => {
            if (live) setPaused(true);
          }}
        />
      </div>
    </section>
  );
}
