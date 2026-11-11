"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyTheme } from "@/lib/daily-dashboard/theme";
import { formatCalendarDateDisplay } from "@/lib/workspace-reporting-period";

type Point = { x: number; y: number; start: string; amount: number };

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
const HEIGHT = 168;

export function DailyCollectionsChart({
  trend,
  currency,
  theme,
}: {
  trend: { start: string; end: string; amount: number }[];
  currency: string;
  theme: DailyTheme;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => buildLayout(trend, width), [trend, width]);
  const active = hover != null ? layout.points[hover] : null;

  return (
    <div ref={containerRef}>
      {width > 0 && layout.points.length > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${currency} collections trend`}
          className="block w-full"
          onMouseLeave={() => setHover(null)}
        >
          {layout.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yFor(tick, layout)}
                y2={yFor(tick, layout)}
                className={theme.chartGrid}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yFor(tick, layout) + 3}
                textAnchor="end"
                className={`text-[10px] font-medium ${theme.chartLabel}`}
              >
                {formatAxis(tick, currency)}
              </text>
            </g>
          ))}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={layout.baseline}
            y2={layout.baseline}
            className={theme.chartAxis}
            strokeWidth={1}
          />
          <path d={layout.area} className={theme.chartArea} />
          <path
            d={layout.line}
            fill="none"
            className={theme.chartLine}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {layout.points.map((point, index) => (
            <circle
              key={point.start}
              cx={point.x}
              cy={point.y}
              r={hover === index ? 4 : 2.5}
              className={theme.chartPoint}
            />
          ))}
          {layout.points.map((point, index) => (
            <text
              key={`label-${point.start}`}
              x={point.x}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === layout.points.length - 1 ? "end" : "middle"}
              className={`text-[9px] font-medium tabular-nums ${theme.chartLabel}`}
            >
              {formatCalendarDateDisplay(point.start).replace(/, \d{4}$/, "")}
            </text>
          ))}
          {layout.bands.map((band) => (
            <rect
              key={band.index}
              x={band.x}
              y={PAD.top}
              width={band.width}
              height={layout.baseline - PAD.top}
              className="cursor-crosshair fill-transparent"
              onMouseEnter={() => setHover(band.index)}
            />
          ))}
        </svg>
      ) : (
        <div className="h-8" />
      )}
      <p className={`mt-1 min-h-4 text-center text-xs tabular-nums ${theme.muted}`} aria-live="polite">
        {active
          ? `${formatCalendarDateDisplay(active.start)} · ${formatExact(active.amount, currency)}`
          : "Hover a day to read that day’s net"}
      </p>
      <table className="sr-only">
        <caption>Collections by day</caption>
        <tbody>
          {trend.map((bucket) => (
            <tr key={bucket.start}>
              <td>{bucket.start}</td>
              <td>{formatExact(bucket.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildLayout(trend: { start: string; amount: number }[], width: number) {
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const baseline = HEIGHT - PAD.bottom;
  const plotH = baseline - PAD.top;
  const max = Math.max(...trend.map((bucket) => bucket.amount), 0);
  const yMax = max <= 0 ? 1 : niceMax(max);
  const points: Point[] = trend.map((bucket, index) => {
    const x =
      PAD.left + (trend.length <= 1 ? plotW / 2 : (index / (trend.length - 1)) * plotW);
    const y = PAD.top + plotH - (bucket.amount / yMax) * plotH;
    return { x, y, start: bucket.start, amount: bucket.amount };
  });
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last
      ? `${line} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`
      : "";
  const bands = points.map((point, index) => {
    const prev = points[index - 1]?.x ?? PAD.left;
    const next = points[index + 1]?.x ?? width - PAD.right;
    const left = index === 0 ? PAD.left : (prev + point.x) / 2;
    const right = index === points.length - 1 ? width - PAD.right : (point.x + next) / 2;
    return { index, x: left, width: Math.max(right - left, 1) };
  });
  return { points, line, area, baseline, yMax, ticks: [0, yMax / 2, yMax], bands };
}

function yFor(value: number, layout: { baseline: number; yMax: number }) {
  const plotH = layout.baseline - PAD.top;
  return PAD.top + plotH - (value / layout.yMax) * plotH;
}

function niceMax(max: number): number {
  if (max < 100) return Math.ceil(max / 10) * 10 || 10;
  if (max < 1000) return Math.ceil(max / 100) * 100;
  return Math.ceil(max / 1000) * 1000;
}

function formatAxis(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return amount.toFixed(0);
  }
}

function formatExact(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}
