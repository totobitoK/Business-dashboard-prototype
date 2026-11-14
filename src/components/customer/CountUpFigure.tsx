"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { formatDashboardMoney } from "@/lib/format-chart-currency";

const DURATION_MS = 1680;
const HEAD_MS = 480;
const TAIL_WEIGHT = 800;
const TAIL_POWER = 16;

const CountProgressContext = createContext(1);

/** Time fraction spent to reach `progress` of the last 1%. */
function tailTime(progress: number): number {
  const weight = TAIL_WEIGHT / (TAIL_POWER + 1);
  return (progress + weight * progress ** (TAIL_POWER + 1)) / (1 + weight);
}

/** How far through the last 1% a moment in that stretch has traveled. */
function tailProgress(timeFraction: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (tailTime(mid) < timeFraction) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function fractionComplete(t: number, amount: number): number {
  if (t >= 1) return 1;
  if (!(amount > 0)) return 0;
  const headTime = HEAD_MS / DURATION_MS;
  if (t <= headTime) {
    const u = t / headTime;
    return 0.99 * (1 - (1 - u) ** 1.35);
  }

  const elapsed = t * DURATION_MS - HEAD_MS;
  const tailMs = DURATION_MS - HEAD_MS;
  return 0.99 + 0.01 * tailProgress(Math.min(1, elapsed / tailMs));
}

/** Restarts the count whenever the dashboard loads or the active tab changes. */
export function CountUpReplay({
  replayKey,
  children,
}: {
  replayKey: string;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    const start = performance.now();
    let frame = 0;
    setProgress(0);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replayKey]);

  return <CountProgressContext.Provider value={progress}>{children}</CountProgressContext.Provider>;
}

function formatFigure(amount: number, currency: string, showCents: boolean): string {
  if (!showCents && currency === "USD") return formatDashboardMoney(Math.round(amount));
  return formatDashboardMoney(amount, currency);
}

function CountedText({
  ticking,
  finalText,
  className,
}: {
  ticking: string;
  finalText: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="sr-only">{finalText}</span>
      <span aria-hidden="true">{ticking}</span>
    </span>
  );
}

export function CountUpMoney({
  amount,
  currency = "USD",
  className = "",
  colorClass = "",
}: {
  amount: number;
  currency?: string;
  className?: string;
  colorClass?: string;
}) {
  const t = useContext(CountProgressContext);
  const code = currency.trim() || "USD";
  const showCents = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  const magnitude = Math.abs(amount);
  const shown = Math.sign(amount) * magnitude * fractionComplete(t, magnitude);
  const classes = `font-medium ${colorClass}${className ? ` ${className}` : ""}`;
  return (
    <CountedText
      className={classes}
      ticking={formatFigure(shown, code, showCents)}
      finalText={formatFigure(amount, code, showCents)}
    />
  );
}
