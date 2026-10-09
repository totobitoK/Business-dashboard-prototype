"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { chartYAxisMax, formatChartCurrency } from "@/lib/format-chart-currency";
import type { TrendBucket } from "@/lib/workspace-analytics";

const PAD = { top: 10, right: 16, bottom: 30, left: 52 };
const X_INSET = 24;

const CHART_HEIGHT = 132;

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function numericDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function periodLabel(bucket: TrendBucket): string {
  if (bucket.start !== bucket.end) {
    return `${numericDay(bucket.start)}–${numericDay(bucket.end)}`;
  }
  return numericDay(bucket.start);
}

export const CollectionsTrendChart = memo(function CollectionsTrendChart({
  trend,
}: {
  trend: TrendBucket[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const labelY = CHART_HEIGHT - 6;

  const layout = useMemo(() => {
    const width = Math.max(containerWidth, 1);
    const plotW = Math.max(width - PAD.left - PAD.right, 1);
    const innerW = Math.max(plotW - 2 * X_INSET, 1);
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const maxAmount = Math.max(...trend.map((t) => t.amount), 0);
    const yMax = chartYAxisMax(maxAmount);
    const lastIdx = trend.length - 1;

    const points = trend.map((b, i) => {
      const x =
        PAD.left +
        X_INSET +
        (trend.length <= 1 ? innerW / 2 : (i / lastIdx) * innerW);
      const y = PAD.top + plotH - (yMax > 0 ? (b.amount / yMax) * plotH : 0);
      return { x, y, ...b };
    });

    const yTicks = [0, yMax / 2, yMax];

    const hoverBands = points.map((p, i) => {
      const left =
        i === 0 ? PAD.left : (points[i - 1]!.x + p.x) / 2;
      const right =
        i === lastIdx ? width - PAD.right : (p.x + points[i + 1]!.x) / 2;
      return { i, x: left, width: Math.max(right - left, 1) };
    });

    const hoverBandTop = PAD.top;
    const hoverBandHeight = labelY - PAD.top;

    return {
      width,
      plotH,
      yMax,
      points,
      yTicks,
      lastIdx,
      hoverBands,
      hoverBandTop,
      hoverBandHeight,
    };
  }, [trend, containerWidth, labelY]);

  const {
    width,
    plotH,
    yMax,
    points,
    yTicks,
    lastIdx,
    hoverBands,
    hoverBandTop,
    hoverBandHeight,
  } = layout;
  const hover = hoverIndex != null ? points[hoverIndex] : null;
  const ready = containerWidth > 0;

  return (
    <div>
      <div ref={containerRef} className="w-full pt-2">
        {ready && (
          <svg
            width={width}
            height={CHART_HEIGHT}
            className="block w-full text-ink-muted"
            role="img"
            aria-label="Collections trend line chart"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {yTicks.map((tick) => {
              const y = PAD.top + plotH - (yMax > 0 ? (tick / yMax) * plotH : 0);
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={width - PAD.right}
                    y2={y}
                    className="stroke-purple-100"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-ink-muted text-[10px] font-medium"
                  >
                    {formatChartCurrency(tick)}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD.left}
              y1={PAD.top + plotH}
              x2={width - PAD.right}
              y2={PAD.top + plotH}
              className="stroke-purple-200"
              strokeWidth={1}
            />

            {points.length > 0 && (
              <>
                <path
                  d={buildPath(points)}
                  fill="none"
                  className="stroke-purple"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <circle
                    key={p.start}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === i ? 4 : 2.5}
                    className={`pointer-events-none ${
                      hoverIndex === i ? "fill-purple-dark" : "fill-purple"
                    }`}
                  />
                ))}
              </>
            )}

            {points.map((p, i) => {
              const text = periodLabel(p);
              const anchor =
                i === 0 ? "start" : i === lastIdx ? "end" : "middle";
              const sizeClass = trend.length > 20 ? "text-[7px]" : "text-[9px]";
              return (
                <text
                  key={`lbl-${p.start}`}
                  x={p.x}
                  y={labelY}
                  textAnchor={anchor}
                  className={`fill-ink-muted font-medium tabular-nums ${sizeClass}`}
                >
                  {text}
                </text>
              );
            })}

            {hoverBands.map((band) => (
              <rect
                key={`band-${band.i}`}
                x={band.x}
                y={hoverBandTop}
                width={band.width}
                height={hoverBandHeight}
                className="fill-transparent cursor-crosshair"
                onMouseEnter={() => setHoverIndex(band.i)}
              />
            ))}
          </svg>
        )}
      </div>

      <p
        className="mt-1.5 min-h-[1.125rem] text-center text-[11px] text-ink-muted sm:text-xs"
        aria-live="polite"
      >
        {hover ? (
          <>
            <span className="font-semibold text-ink">{periodLabel(hover)}</span>
            {" · "}
            <span className="font-semibold text-purple-dark">
              {formatChartCurrency(hover.amount)}
            </span>
          </>
        ) : (
          <span>Hover over a day to see collections</span>
        )}
      </p>

      <table className="sr-only">
        <caption>Collections trend data</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((b) => (
            <tr key={b.start}>
              <td>{b.label}</td>
              <td>{b.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
