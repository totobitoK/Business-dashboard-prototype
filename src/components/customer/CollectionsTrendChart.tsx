"use client";

import { useMemo, useState } from "react";
import { chartYAxisMax, formatChartCurrency } from "@/lib/format-chart-currency";
import type { TrendBucket } from "@/lib/workspace-analytics";

const CHART_HEIGHT = 140;
const PAD = { top: 10, right: 12, bottom: 28, left: 52 };

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

export function CollectionsTrendChart({ trend }: { trend: TrendBucket[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const layout = useMemo(() => {
    const plotW = Math.max(280, trend.length * 14);
    const width = PAD.left + plotW + PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const maxAmount = Math.max(...trend.map((t) => t.amount), 0);
    const yMax = chartYAxisMax(maxAmount);

    const points = trend.map((b, i) => {
      const x =
        PAD.left +
        (trend.length <= 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW);
      const y = PAD.top + plotH - (yMax > 0 ? (b.amount / yMax) * plotH : 0);
      return { x, y, ...b };
    });

    const yTicks = [0, yMax / 2, yMax];
    const labelStep = trend.length > 20 ? 7 : trend.length > 10 ? 5 : 1;

    return { width, plotW, plotH, yMax, points, yTicks, labelStep };
  }, [trend]);

  const { width, plotH, yMax, points, yTicks, labelStep } = layout;
  const hover = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="mt-3">
      <p className="mb-2 min-h-[1.25rem] text-xs text-ink-muted" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold text-ink">{hover.label}</span>
            {" · "}
            <span className="font-semibold text-purple-dark">
              {formatChartCurrency(hover.amount)}
            </span>
          </>
        ) : (
          <span>Hover a day to see collections</span>
        )}
      </p>
      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={CHART_HEIGHT}
          className="min-w-full text-ink-muted"
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
                <g key={p.start}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === i ? 5 : 8}
                    className="fill-transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === i ? 4 : 2.5}
                    className={
                      hoverIndex === i ? "fill-purple-dark" : "fill-purple"
                    }
                  />
                </g>
              ))}
            </>
          )}

          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <text
                key={`lbl-${p.start}`}
                x={p.x}
                y={CHART_HEIGHT - 6}
                textAnchor="middle"
                className="fill-ink-muted text-[9px]"
              >
                {p.label}
              </text>
            ) : null
          )}
        </svg>
      </div>

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
}
