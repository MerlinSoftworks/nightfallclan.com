"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ZoomOutIcon,
  ZoomInIcon,
  ResetZoomIcon,
  ZoomDragIcon,
} from "@icons";
import { useSearch } from "@context/SearchContext";
import styles from "./MessageDensityChart.module.scss";

// ─── Types ───────────────────────────────────────────────────────────────────

type GraphHistoryRange = { min: number; max: number };
type GraphHistoryState = {
  filterBanned: boolean;
  targetBuckets: number;
  range?: GraphHistoryRange;
};
type PartialGraphHistoryState = Partial<GraphHistoryState>;
type BuiltSeries = {
  data: [number, number][];
  min: number;
  max: number;
  viewMin: number;
  viewMax: number;
  viewEnd: number;
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampTargetBuckets(value: unknown): number {
  if (!isFiniteNumber(value)) return 20;
  return Math.min(200, Math.max(20, Math.round(value)));
}

function parseGraphHistoryState(
  raw: unknown
): PartialGraphHistoryState | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const parsed: PartialGraphHistoryState = {};
  if (typeof c.filterBanned === "boolean") parsed.filterBanned = c.filterBanned;
  if (isFiniteNumber(c.targetBuckets))
    parsed.targetBuckets = clampTargetBuckets(c.targetBuckets);
  if (c.range && typeof c.range === "object") {
    const r = c.range as Record<string, unknown>;
    if (isFiniteNumber(r.min) && isFiniteNumber(r.max) && r.max > r.min)
      parsed.range = { min: r.min, max: r.max };
  }
  return Object.keys(parsed).length ? parsed : null;
}

function readGraphHistoryState(): PartialGraphHistoryState | null {
  if (typeof window === "undefined") return null;
  const s = window.history.state;
  if (!s || typeof s !== "object") return null;
  return parseGraphHistoryState(
    (s as Record<string, unknown>).graphView
  );
}

function graphRangesEqual(
  a?: GraphHistoryRange,
  b?: GraphHistoryRange
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.min === b.min && a.max === b.max;
}

function graphStatesEqual(
  prev: PartialGraphHistoryState | null,
  next: GraphHistoryState
): boolean {
  if (!prev) return false;
  return (
    (prev.filterBanned ?? false) === next.filterBanned &&
    clampTargetBuckets(prev.targetBuckets) === next.targetBuckets &&
    graphRangesEqual(prev.range, next.range)
  );
}

function lowerBound(arr: number[], target: number): number {
  let lo = 0,
    hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr: number[], target: number): number {
  let lo = 0,
    hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function bucketTimestamps(
  timestamps: number[],
  intervalMs: number,
  rangeStart?: number,
  rangeEnd?: number
): [number, number][] {
  const start = rangeStart ?? timestamps[0];
  const end = rangeEnd ?? timestamps[timestamps.length - 1];
  const lo = rangeStart != null ? lowerBound(timestamps, start) : 0;
  const hi = rangeEnd != null ? upperBound(timestamps, end) : timestamps.length;
  const bucketCount = Math.max(1, Math.ceil((end - start) / intervalMs));
  const counts = new Uint32Array(bucketCount);
  for (let i = lo; i < hi; i++) {
    const idx = Math.min(
      bucketCount - 1,
      Math.floor((timestamps[i] - start) / intervalMs)
    );
    if (idx >= 0 && idx < bucketCount) counts[idx]++;
  }
  const result: [number, number][] = new Array(bucketCount);
  for (let i = 0; i < bucketCount; i++) {
    result[i] = [start + i * intervalMs, counts[i]];
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

const MINIMAP_BUCKETS = 100;
const ZOOM_EPSILON_MS = 1;

const LIGHT_SCHEME_QUERY = "(prefers-color-scheme: light)";

function prefersLightScheme(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia(LIGHT_SCHEME_QUERY).matches
  );
}

/** Colors that must follow the OS color scheme (mirrors the tokens in globals.scss). */
function chartPalette(light: boolean) {
  return light
    ? {
        mode: "light" as const,
        foreColor: "rgba(18, 18, 21, 0.87)",
        labelColor: "rgba(18, 18, 21, 0.6)",
        gridColor: "#d9d9e0",
        minimapRangeFill: "rgba(18, 18, 21, 0.12)",
        minimapRangeStroke: "rgba(18, 18, 21, 0.5)",
      }
    : {
        mode: "dark" as const,
        foreColor: "rgba(255, 255, 255, 0.87)",
        labelColor: "rgba(255, 255, 255, 0.6)",
        gridColor: "#2d2d2d",
        minimapRangeFill: "rgba(255, 255, 255, 0.15)",
        minimapRangeStroke: "rgba(255, 255, 255, 0.5)",
      };
}

/** ApexCharts options that depend on the color scheme. */
function schemeChartOptions(light: boolean) {
  const palette = chartPalette(light);
  return {
    chart: { foreColor: palette.foreColor },
    xaxis: { labels: { style: { colors: palette.labelColor } } },
    yaxis: { labels: { style: { colors: palette.labelColor } } },
    grid: { borderColor: palette.gridColor, strokeDashArray: 3 },
    tooltip: { theme: palette.mode },
    theme: { mode: palette.mode },
  };
}

export default function MessageDensityChart() {
  const router = useRouter();
  const { setInputValue } = useSearch();

  // Read initial state from history before first render
  const initialGraphHistoryState = useRef(readGraphHistoryState());

  const [loading, setLoading] = useState(true);
  const [filterBanned, setFilterBanned] = useState(
    initialGraphHistoryState.current?.filterBanned ?? false
  );
  const [zoomed, setZoomed] = useState(false);
  const [navigatingToPosts, setNavigatingToPosts] = useState(false);
  const [mobileZoomEnabled, setMobileZoomEnabled] = useState(false);
  const [chartDragStartX, setChartDragStartX] = useState<number | null>(null);
  const [chartDragCurrentX, setChartDragCurrentX] = useState<number | null>(
    null
  );
  const [targetBuckets, setTargetBuckets] = useState(
    clampTargetBuckets(initialGraphHistoryState.current?.targetBuckets)
  );
  const [minimapVisible, setMinimapVisible] = useState(true);

  // Refs for mutable state that shouldn't trigger re-renders
  const chartElRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const ApexChartsRef = useRef<any>(null);
  const sortedTimestampsRef = useRef<number[]>([]);
  const allTimestampsRef = useRef<number[]>([]);
  const filteredTimestampsRef = useRef<number[] | null>(null);
  const filteredTimestampsPromiseRef = useRef<Promise<number[]> | null>(null);
  const currentRangeRef = useRef<{ min?: number; max?: number }>({});
  const currentViewRangeRef = useRef<{ min?: number; max?: number }>({});
  const currentIntervalMsRef = useRef(0);
  const resettingRef = useRef(false);
  const updatingRef = useRef(false);
  const lastAppliedFilterBannedRef = useRef<boolean | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapDataRef = useRef<number[]>([]);
  const minimapDraggingRef = useRef(false);
  const minimapPointerIdRef = useRef<number | null>(null);
  const minimapDragWindowSpanRef = useRef<number | null>(null);
  const pendingMinimapClientXRef = useRef<number | null>(null);
  const minimapPanFrameRef = useRef(0);
  const minimapFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const dragOverlayElRef = useRef<HTMLDivElement>(null);
  const chartDraggingRef = useRef(false);
  const chartDragPointerIdRef = useRef<number | null>(null);
  const chartDragStartTimeRef = useRef<number | null>(null);
  const chartDragStartXRef = useRef<number | null>(null);

  // ─── Helper functions ────────────────────────────────────────────────────

  const hasNonZeroZoom = useCallback(
    (range: { min?: number; max?: number }): boolean => {
      const ts = sortedTimestampsRef.current;
      if (!ts?.length || range.min == null || range.max == null) return false;
      return (
        range.min > ts[0] + ZOOM_EPSILON_MS ||
        range.max < ts[ts.length - 1] - ZOOM_EPSILON_MS
      );
    },
    []
  );

  const pickInterval = useCallback(
    (rangeMs: number, buckets: number): number => {
      return Math.max(1, rangeMs / buckets);
    },
    []
  );

  const persistGraphHistoryState = useCallback(() => {
    if (
      typeof window === "undefined" ||
      (window.location.pathname !== "/graph" &&
        window.location.pathname !== "/wall/graph")
    )
      return;
    const baseState =
      window.history.state && typeof window.history.state === "object"
        ? (window.history.state as Record<string, unknown>)
        : {};
    const range = currentRangeRef.current;
    const nextState: GraphHistoryState = {
      filterBanned,
      targetBuckets: clampTargetBuckets(targetBuckets),
    };
    if (
      range.min != null &&
      range.max != null &&
      hasNonZeroZoom(range)
    ) {
      nextState.range = { min: range.min, max: range.max };
    }
    const prev = parseGraphHistoryState(baseState.graphView);
    if (graphStatesEqual(prev, nextState)) return;
    window.history.replaceState(
      { ...baseState, graphView: nextState },
      "",
      window.location.href
    );
  }, [filterBanned, targetBuckets, hasNonZeroZoom]);

  const buildSeries = useCallback(
    (
      rangeStart?: number,
      rangeEnd?: number,
      buckets?: number
    ): BuiltSeries => {
      const ts = sortedTimestampsRef.current;
      const tb = buckets ?? targetBuckets;
      const requestedMin = rangeStart ?? ts[0];
      const requestedMax = rangeEnd ?? ts[ts.length - 1];
      const lo = lowerBound(ts, requestedMin);
      const hi = upperBound(ts, requestedMax);
      const min = hi > lo ? ts[lo] : requestedMin;
      const max = hi > lo ? ts[hi - 1] : requestedMax;
      const rangeMs = max - min;
      const interval = pickInterval(rangeMs, tb);
      currentIntervalMsRef.current = interval;
      const data = bucketTimestamps(ts, interval, min, max);
      const viewMin = data[0]?.[0] ?? min;
      const viewMax = data[data.length - 1]?.[0] ?? max;
      const viewEnd = viewMax + interval;
      currentViewRangeRef.current = { min: viewMin, max: viewEnd };
      return { data, min, max, viewMin, viewMax, viewEnd };
    },
    [targetBuckets, pickInterval]
  );

  const computeMinimapData = useCallback(() => {
    const ts = sortedTimestampsRef.current;
    const fullRange = ts[ts.length - 1] - ts[0];
    const interval = fullRange / MINIMAP_BUCKETS;
    const buckets = bucketTimestamps(ts, interval);
    minimapDataRef.current = buckets.map((b) => b[1]);
  }, []);

  const drawMinimap = useCallback(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const data = minimapDataRef.current;
    if (data.length === 0) return;
    const max = Math.max(...data);
    if (max === 0) return;
    const step = w / (data.length - 1);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(i * step, h - (data[i] / max) * h * 0.9);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(108, 149, 255, 0.3)";
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (data[i] / max) * h * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(108, 149, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const range = currentRangeRef.current;
    if (range.min != null && range.max != null) {
      const ts = sortedTimestampsRef.current;
      const fullMin = ts[0];
      const fullMax = ts[ts.length - 1];
      const fullRange = fullMax - fullMin;
      const x1 = ((range.min - fullMin) / fullRange) * w;
      const x2 = ((range.max - fullMin) / fullRange) * w;
      const palette = chartPalette(prefersLightScheme());
      ctx.fillStyle = palette.minimapRangeFill;
      ctx.fillRect(x1, 0, x2 - x1, h);
      ctx.strokeStyle = palette.minimapRangeStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, 0, x2 - x1, h);
    }
  }, []);

  const resetMinimapFadeTimer = useCallback(() => {
    setMinimapVisible(true);
    if (minimapFadeTimerRef.current) clearTimeout(minimapFadeTimerRef.current);
    minimapFadeTimerRef.current = setTimeout(() => {
      setMinimapVisible(false);
    }, 4000);
  }, []);

  // ─── Chart event handlers ────────────────────────────────────────────────

  const handleZoomed = useCallback(
    (_ctx: any, { xaxis }: { xaxis: { min: number; max: number } }) => {
      const ts = sortedTimestampsRef.current;
      if (resettingRef.current) {
        resettingRef.current = false;
        const fullMin = ts[0];
        const fullMax = ts[ts.length - 1];
        const fullInterval = pickInterval(fullMax - fullMin, targetBuckets);
        const fullViewMax = fullMin + (targetBuckets - 1) * fullInterval;
        if (xaxis.min <= fullMin && xaxis.max >= fullViewMax) return;
      }
      if (updatingRef.current) return;
      const built = buildSeries(
        xaxis.min,
        xaxis.max + currentIntervalMsRef.current
      );
      currentRangeRef.current = { min: built.min, max: built.max };
      setZoomed(hasNonZeroZoom(currentRangeRef.current));
      persistGraphHistoryState();
      updatingRef.current = true;
      setTimeout(() => {
        chartRef.current?.updateOptions(
          {
            series: [{ name: "Wall Posts", data: built.data }],
            xaxis: { min: built.viewMin, max: built.viewMax },
          },
          false,
          false
        );
        updatingRef.current = false;
        drawMinimap();
      }, 0);
    },
    [buildSeries, hasNonZeroZoom, persistGraphHistoryState, drawMinimap, pickInterval, targetBuckets]
  );

  const handleResetZoom = useCallback((): void => {
    resettingRef.current = true;
    currentRangeRef.current = {};
    setZoomed(false);
    persistGraphHistoryState();
    const built = buildSeries();
    setTimeout(() => {
      chartRef.current?.updateOptions(
        {
          series: [{ name: "Wall Posts", data: built.data }],
          xaxis: { min: built.viewMin, max: built.viewMax },
        },
        false,
        false
      );
      drawMinimap();
    }, 0);
  }, [buildSeries, persistGraphHistoryState, drawMinimap]);

  const resetZoom = useCallback(() => {
    if (!chartRef.current) return;
    resettingRef.current = true;
    currentRangeRef.current = {};
    setZoomed(false);
    persistGraphHistoryState();
    const built = buildSeries();
    chartRef.current.updateOptions(
      {
        series: [{ name: "Wall Posts", data: built.data }],
        xaxis: { min: built.viewMin, max: built.viewMax },
      },
      false,
      false
    );
    drawMinimap();
  }, [buildSeries, persistGraphHistoryState, drawMinimap]);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!chartRef.current) return;
      const ts = sortedTimestampsRef.current;
      const range = currentRangeRef.current;
      const min = range.min ?? ts[0];
      const max = range.max ?? ts[ts.length - 1];
      const mid = (min + max) / 2;
      const half = ((max - min) / 2) * factor;
      const newMin = Math.max(ts[0], mid - half);
      const newMax = Math.min(ts[ts.length - 1], mid + half);
      if (newMin <= ts[0] && newMax >= ts[ts.length - 1]) {
        resetZoom();
        return;
      }
      resetMinimapFadeTimer();
      chartRef.current.zoomX(newMin, newMax);
    },
    [resetZoom, resetMinimapFadeTimer]
  );

  // ─── View posts navigation ──────────────────────────────────────────────

  const viewPostsInCurrentRange = useCallback(() => {
    const range = currentRangeRef.current;
    const viewRange = currentViewRangeRef.current;
    if (
      !hasNonZeroZoom(range) ||
      viewRange.min == null ||
      viewRange.max == null
    )
      return;
    const after = new Date(viewRange.min).toISOString();
    const before = new Date(viewRange.max).toISOString();
    const searchQuery = `after:${after} before:${before}`;
    persistGraphHistoryState();
    setNavigatingToPosts(true);
    setInputValue(searchQuery);
    router.push("/wall");
  }, [hasNonZeroZoom, persistGraphHistoryState, router, setInputValue]);

  // ─── Drag zoom handlers ──────────────────────────────────────────────────

  const getChartXInfo = useCallback(
    (
      clientX: number
    ): { overlayX: number; plotX: number } | null => {
      const el = chartElRef.current;
      const chart = chartRef.current;
      if (!el || !chart) return null;
      const w = (chart as any).w;
      if (!w?.globals) return null;
      const translateX = w.globals.translateX ?? 0;
      const gridWidth = w.globals.gridWidth ?? 1;
      const rect = el.getBoundingClientRect();
      const plotX = Math.max(
        0,
        Math.min(gridWidth, clientX - rect.left - translateX)
      );
      return { overlayX: translateX + plotX, plotX };
    },
    []
  );

  const plotXToTime = useCallback((plotX: number): number => {
    const chart = chartRef.current;
    const w = (chart as any)?.w;
    const gridWidth = w?.globals?.gridWidth ?? 1;
    const ratio = Math.max(0, Math.min(1, plotX / gridWidth));
    const ts = sortedTimestampsRef.current;
    const viewRange = currentViewRangeRef.current;
    const viewMin = viewRange.min ?? ts[0];
    const viewMax = viewRange.max ?? ts[ts.length - 1];
    return viewMin + ratio * (viewMax - viewMin);
  }, []);

  const handleDragZoomStart = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      const info = getChartXInfo(event.clientX);
      if (!info) return;
      chartDraggingRef.current = true;
      chartDragPointerIdRef.current = event.pointerId;
      chartDragStartXRef.current = info.overlayX;
      setChartDragStartX(info.overlayX);
      setChartDragCurrentX(info.overlayX);
      chartDragStartTimeRef.current = plotXToTime(info.plotX);
      dragOverlayElRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [getChartXInfo, plotXToTime]
  );

  const handleDragZoomMove = useCallback(
    (event: React.PointerEvent) => {
      if (
        !chartDraggingRef.current ||
        chartDragPointerIdRef.current !== event.pointerId
      )
        return;
      const info = getChartXInfo(event.clientX);
      if (info) setChartDragCurrentX(info.overlayX);
    },
    [getChartXInfo]
  );

  const handleDragZoomEnd = useCallback(
    (event: React.PointerEvent) => {
      if (
        !chartDraggingRef.current ||
        chartDragPointerIdRef.current !== event.pointerId
      )
        return;
      const info = getChartXInfo(event.clientX);
      if (
        info &&
        chartDragStartXRef.current != null &&
        Math.abs(info.overlayX - chartDragStartXRef.current) > 10
      ) {
        const endTime = plotXToTime(info.plotX);
        chartRef.current?.zoomX(
          Math.min(chartDragStartTimeRef.current!, endTime),
          Math.max(chartDragStartTimeRef.current!, endTime)
        );
      }
      chartDraggingRef.current = false;
      chartDragPointerIdRef.current = null;
      chartDragStartXRef.current = null;
      setChartDragStartX(null);
      setChartDragCurrentX(null);
      chartDragStartTimeRef.current = null;
    },
    [getChartXInfo, plotXToTime]
  );

  const handleDragZoomCancel = useCallback((event: React.PointerEvent) => {
    if (chartDragPointerIdRef.current === event.pointerId) {
      chartDraggingRef.current = false;
      chartDragPointerIdRef.current = null;
      chartDragStartXRef.current = null;
      setChartDragStartX(null);
      setChartDragCurrentX(null);
      chartDragStartTimeRef.current = null;
    }
  }, []);

  // ─── Minimap handlers ────────────────────────────────────────────────────

  const panZoomWindowAtClientX = useCallback((clientX: number) => {
    const chart = chartRef.current;
    const canvas = minimapCanvasRef.current;
    if (!chart || !canvas) return;
    const range = currentRangeRef.current;
    if (range.min == null || range.max == null) return;
    const ts = sortedTimestampsRef.current;
    const fullMin = ts[0];
    const fullMax = ts[ts.length - 1];
    const fullRange = fullMax - fullMin;
    if (fullRange <= 0) return;
    const windowSpan =
      minimapDragWindowSpanRef.current ?? range.max - range.min;
    if (windowSpan <= 0 || windowSpan >= fullRange) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    const center = fullMin + ratio * fullRange;
    let newMin = center - windowSpan / 2;
    let newMax = center + windowSpan / 2;
    if (newMin < fullMin) {
      newMin = fullMin;
      newMax = fullMin + windowSpan;
    } else if (newMax > fullMax) {
      newMax = fullMax;
      newMin = fullMax - windowSpan;
    }
    chart.zoomX(newMin, newMax);
  }, []);

  const scheduleMinimapPan = useCallback(
    (clientX: number) => {
      pendingMinimapClientXRef.current = clientX;
      if (minimapPanFrameRef.current) return;
      minimapPanFrameRef.current = requestAnimationFrame(() => {
        minimapPanFrameRef.current = 0;
        if (pendingMinimapClientXRef.current == null) return;
        panZoomWindowAtClientX(pendingMinimapClientXRef.current);
        pendingMinimapClientXRef.current = null;
      });
    },
    [panZoomWindowAtClientX]
  );

  const handleMinimapPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = minimapCanvasRef.current;
      if (!canvas || event.button !== 0) return;
      const range = currentRangeRef.current;
      if (range.min == null || range.max == null) return;
      resetMinimapFadeTimer();
      minimapDragWindowSpanRef.current = range.max - range.min;
      minimapDraggingRef.current = true;
      minimapPointerIdRef.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      scheduleMinimapPan(event.clientX);
      event.preventDefault();
    },
    [resetMinimapFadeTimer, scheduleMinimapPan]
  );

  const handleMinimapPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!minimapDraggingRef.current) return;
      if (minimapPointerIdRef.current !== event.pointerId) return;
      resetMinimapFadeTimer();
      scheduleMinimapPan(event.clientX);
      event.preventDefault();
    },
    [resetMinimapFadeTimer, scheduleMinimapPan]
  );

  const handleMinimapPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!minimapDraggingRef.current) return;
      if (minimapPointerIdRef.current !== event.pointerId) return;
      minimapCanvasRef.current?.releasePointerCapture(event.pointerId);
      minimapDraggingRef.current = false;
      minimapPointerIdRef.current = null;
      minimapDragWindowSpanRef.current = null;
    },
    []
  );

  const handleMinimapPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (minimapPointerIdRef.current === event.pointerId) {
        minimapDraggingRef.current = false;
        minimapPointerIdRef.current = null;
        minimapDragWindowSpanRef.current = null;
      }
    },
    []
  );

  // ─── Data swap (filter banned) ───────────────────────────────────────────

  const loadFiltered = useCallback(async (): Promise<number[]> => {
    if (filteredTimestampsRef.current) return filteredTimestampsRef.current;
    if (!filteredTimestampsPromiseRef.current) {
      filteredTimestampsPromiseRef.current = fetch(
        "/api/timestamps?filterBanned=true"
      )
        .then((res) => res.json())
        .then((raw: number[]) => {
          filteredTimestampsRef.current = raw.sort((a, b) => a - b);
          return filteredTimestampsRef.current;
        })
        .catch((err) => {
          filteredTimestampsPromiseRef.current = null;
          throw err;
        });
    }
    return filteredTimestampsPromiseRef.current;
  }, []);

  const swapDataset = useCallback(
    async (useBanned: boolean) => {
      if (useBanned) {
        sortedTimestampsRef.current = await loadFiltered();
      } else {
        sortedTimestampsRef.current = allTimestampsRef.current;
      }
      const range = currentRangeRef.current;
      const built = buildSeries(range.min, range.max);
      currentRangeRef.current = { min: built.min, max: built.max };
      setZoomed(hasNonZeroZoom(currentRangeRef.current));
      chartRef.current?.updateOptions(
        {
          series: [{ name: "Wall Posts", data: built.data }],
          xaxis: { min: built.viewMin, max: built.viewMax },
        },
        false,
        false
      );
      computeMinimapData();
      drawMinimap();
      persistGraphHistoryState();
    },
    [
      loadFiltered,
      buildSeries,
      hasNonZeroZoom,
      computeMinimapData,
      drawMinimap,
      persistGraphHistoryState,
    ]
  );

  // ─── Mount: load data and init chart ─────────────────────────────────────

  // We need stable references for chart event callbacks
  const handleZoomedRef = useRef(handleZoomed);
  handleZoomedRef.current = handleZoomed;
  const handleResetZoomRef = useRef(handleResetZoom);
  handleResetZoomRef.current = handleResetZoom;

  useEffect(() => {
    let destroyed = false;

    async function init() {
      // Dynamic import for ApexCharts (it accesses window at import time)
      const ApexCharts = (await import("apexcharts")).default;
      if (destroyed) return;
      ApexChartsRef.current = ApexCharts;

      const res = await fetch("/api/timestamps");
      const raw: number[] = await res.json();
      if (destroyed) return;

      allTimestampsRef.current = raw.sort((a, b) => a - b);
      sortedTimestampsRef.current = allTimestampsRef.current;

      const initialData = buildSeries();
      setLoading(false);

      // Wait for next frame so chartEl is rendered
      await new Promise((r) => requestAnimationFrame(r));
      if (destroyed || !chartElRef.current) return;

      const tooltipXFormatter = (val: number): string => {
        const fd = (ts: number) => {
          const d = new Date(ts);
          const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          const M = months[d.getUTCMonth()];
          const day = d.getUTCDate();
          const year = d.getUTCFullYear();
          const h = String(d.getUTCHours()).padStart(2, "0");
          const m = String(d.getUTCMinutes()).padStart(2, "0");
          const DAY = 86_400_000;
          const interval = currentIntervalMsRef.current;
          if (interval >= 365 * DAY) return `${year}`;
          if (interval >= 28 * DAY) return `${M} ${year}`;
          if (interval >= DAY) return `${M} ${day}, ${year}`;
          return `${M} ${day}, ${year} ${h}:${m}`;
        };
        return `${fd(val)} – ${fd(val + currentIntervalMsRef.current)}`;
      };

      const scheme = schemeChartOptions(prefersLightScheme());
      const options: any = {
        chart: {
          type: "area",
          height: "100%",
          background: "transparent",
          foreColor: scheme.chart.foreColor,
          fontFamily: "system-ui, Avenir, Helvetica, Arial, sans-serif",
          animations: { enabled: false },
          toolbar: { show: false },
          zoom: {
            enabled: window.innerWidth > 900,
            type: "x",
            autoScaleYaxis: true,
          },
          events: {
            zoomed: (ctx: any, opts: any) => handleZoomedRef.current(ctx, opts),
            beforeResetZoom: () => handleResetZoomRef.current(),
          },
        },
        series: [{ name: "Wall Posts", data: initialData.data }],
        xaxis: {
          type: "datetime",
          min: initialData.viewMin,
          max: initialData.viewMax,
          tooltip: { enabled: false },
          labels: scheme.xaxis.labels,
        },
        yaxis: {
          title: { text: "Wall Posts" },
          labels: scheme.yaxis.labels,
        },
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: 2 },
        colors: ["rgb(108, 149, 255)"],
        fill: {
          type: "gradient",
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [0, 100],
          },
        },
        grid: scheme.grid,
        tooltip: { ...scheme.tooltip, x: { formatter: tooltipXFormatter } },
        theme: scheme.theme,
      };

      const chart = new ApexCharts(chartElRef.current, options);
      chartRef.current = chart;
      await chart.render();
      if (destroyed) {
        chart.destroy();
        return;
      }

      if (filterBanned) {
        await swapDataset(true);
      } else {
        computeMinimapData();
        drawMinimap();
        persistGraphHistoryState();
      }

      // Restore range from history
      const initialRange = initialGraphHistoryState.current?.range;
      if (initialRange && sortedTimestampsRef.current.length) {
        const built = buildSeries(initialRange.min, initialRange.max);
        currentRangeRef.current = { min: built.min, max: built.max };
        setZoomed(hasNonZeroZoom(currentRangeRef.current));
        chart.updateOptions(
          {
            series: [{ name: "Wall Posts", data: built.data }],
            xaxis: { min: built.viewMin, max: built.viewMax },
          },
          false,
          false
        );
        drawMinimap();
        persistGraphHistoryState();
      }

      lastAppliedFilterBannedRef.current = filterBanned;

      // Preload filtered data
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void) => number;
      };
      const doPreload = () => {
        void loadFiltered().catch(() =>
          console.warn("Failed to preload filtered timestamps")
        );
      };
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(doPreload);
      } else {
        setTimeout(doPreload, 0);
      }
    }

    init();

    // Re-theme the chart if the OS color scheme changes while the page is open
    const schemeMq = window.matchMedia(LIGHT_SCHEME_QUERY);
    const handleSchemeChange = (e: MediaQueryListEvent) => {
      chartRef.current?.updateOptions(schemeChartOptions(e.matches), false, false);
      drawMinimap();
    };
    schemeMq.addEventListener("change", handleSchemeChange);

    return () => {
      destroyed = true;
      schemeMq.removeEventListener("change", handleSchemeChange);
      if (minimapPanFrameRef.current)
        cancelAnimationFrame(minimapPanFrameRef.current);
      if (minimapFadeTimerRef.current)
        clearTimeout(minimapFadeTimerRef.current);
      chartRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Effect: swap dataset when filterBanned changes ──────────────────────

  useEffect(() => {
    if (
      !chartRef.current ||
      !allTimestampsRef.current.length ||
      lastAppliedFilterBannedRef.current === null
    )
      return;
    if (filterBanned === lastAppliedFilterBannedRef.current) return;
    lastAppliedFilterBannedRef.current = filterBanned;
    void swapDataset(filterBanned);
  }, [filterBanned, swapDataset]);

  // ─── Effect: refresh on resolution change ────────────────────────────────

  const resolutionInitialized = useRef(false);
  useEffect(() => {
    if (!chartRef.current || !sortedTimestampsRef.current.length) return;
    if (!resolutionInitialized.current) {
      resolutionInitialized.current = true;
      return;
    }
    const range = currentRangeRef.current;
    const built = buildSeries(range.min, range.max);
    if (range.min != null && range.max != null) {
      currentRangeRef.current = { min: built.min, max: built.max };
    }
    chartRef.current.updateOptions(
      {
        series: [{ name: "Wall Posts", data: built.data }],
        xaxis: { min: built.viewMin, max: built.viewMax },
      },
      false,
      false
    );
    drawMinimap();
    persistGraphHistoryState();
  }, [targetBuckets, buildSeries, drawMinimap, persistGraphHistoryState]);

  // ─── Effect: minimap fade timer ──────────────────────────────────────────

  useEffect(() => {
    if (zoomed) {
      resetMinimapFadeTimer();
    } else {
      if (minimapFadeTimerRef.current) {
        clearTimeout(minimapFadeTimerRef.current);
        minimapFadeTimerRef.current = null;
      }
      setMinimapVisible(true);
    }
  }, [zoomed, resetMinimapFadeTimer]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const fillPercent = ((targetBuckets - 20) / (200 - 20)) * 100;

  return (
    <div className={styles.chartWrapper}>
      {loading && (
        <div className={styles.chartLoading}>
          <div className={styles.spinner} />
          <p>Processing timestamps...</p>
        </div>
      )}
      {!loading && (
        <div className={styles.chartControls}>
          <div className={styles.chartBtns}>
            <div className={styles.zoomBtns}>
              <button
                className={styles.chartBtn}
                onClick={() => zoomBy(2)}
                aria-label="Zoom out"
              >
                <ZoomOutIcon />
              </button>
              <button
                className={styles.chartBtn}
                onClick={() => zoomBy(0.5)}
                aria-label="Zoom in"
              >
                <ZoomInIcon />
              </button>
              <button
                className={styles.chartBtn}
                onClick={resetZoom}
                aria-label="Reset zoom"
              >
                <ResetZoomIcon />
              </button>
              <button
                className={`${styles.chartBtn} ${styles.zoomToggleBtn} ${mobileZoomEnabled ? styles.active : ""}`}
                onClick={() => setMobileZoomEnabled((v) => !v)}
                aria-label={
                  mobileZoomEnabled
                    ? "Disable drag zoom"
                    : "Enable drag zoom"
                }
                aria-pressed={mobileZoomEnabled}
              >
                <ZoomDragIcon />
              </button>
            </div>
            <button
              className={`${styles.viewPostsBtn} ${!zoomed ? styles.isHidden : ""}`}
              onClick={viewPostsInCurrentRange}
              disabled={!zoomed || navigatingToPosts}
              aria-hidden={!zoomed}
            >
              {navigatingToPosts ? (
                <>
                  <span
                    className={styles.viewPostsBtn__spinner}
                    aria-hidden="true"
                  />
                  Loading posts...
                </>
              ) : (
                "View these posts"
              )}
            </button>
          </div>
          <label className={styles.resolutionControl} htmlFor="resolution-slider">
            <span>Resolution: {targetBuckets}</span>
            <input
              id="resolution-slider"
              type="range"
              min="20"
              max="200"
              step="1"
              value={targetBuckets}
              onChange={(e) =>
                setTargetBuckets(clampTargetBuckets(Number(e.target.value)))
              }
              style={
                { "--fill": `${fillPercent}%` } as React.CSSProperties
              }
            />
          </label>
          <label className={styles.filterToggle}>
            <input
              type="checkbox"
              checked={filterBanned}
              onChange={(e) => setFilterBanned(e.target.checked)}
            />
            <span>Exclude banned accounts</span>
          </label>
        </div>
      )}
      <div
        className={`${styles.chartArea} ${loading ? styles.hidden : ""}`}
      >
        <div ref={chartElRef} className={styles.chartContainer} />
        {mobileZoomEnabled && (
          <div
            className={styles.dragZoomOverlay}
            ref={dragOverlayElRef}
            onPointerDown={handleDragZoomStart}
            onPointerMove={handleDragZoomMove}
            onPointerUp={handleDragZoomEnd}
            onPointerCancel={handleDragZoomCancel}
          >
            {chartDragStartX != null && chartDragCurrentX != null && (
              <div
                className={styles.dragZoomSelection}
                style={{
                  left: Math.min(chartDragStartX, chartDragCurrentX),
                  width: Math.abs(chartDragCurrentX - chartDragStartX),
                }}
              />
            )}
          </div>
        )}
        {zoomed && (
          <canvas
            ref={minimapCanvasRef}
            className={`${styles.minimap} ${!minimapVisible ? styles.faded : ""}`}
            onPointerDown={handleMinimapPointerDown}
            onPointerMove={handleMinimapPointerMove}
            onPointerUp={handleMinimapPointerUp}
            onPointerCancel={handleMinimapPointerCancel}
          />
        )}
      </div>
    </div>
  );
}
