import { DEMO_AS_OF_DATE } from "./workspace-business-data";

/** Calendar-day reporting for demo workspaces (Alpine: Mountain Time display). */
export const BUSINESS_TIMEZONE = "America/Denver";

export type ReportingPeriodPreset =
  | "last7"
  | "last30"
  | "mtd"
  | "prev_month"
  | "custom";

export interface ReportingDateRange {
  /** Inclusive calendar date (YYYY-MM-DD). */
  start: string;
  /** Inclusive calendar date (YYYY-MM-DD), never after demo as-of. */
  end: string;
  preset: ReportingPeriodPreset;
}

export interface ReportingRangeResult {
  ok: true;
  range: ReportingDateRange;
  /** Exclusive upper bound for timestamp math (day after `end`). */
  endExclusive: string;
  label: string;
}

export type ReportingRangeError = { ok: false; error: string };

export function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function formatIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addCalendarDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysBetweenInclusive(start: string, end: string): number {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.floor((t1 - t0) / 86400000) + 1;
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** True when `date` falls on an inclusive calendar-day range. */
export function isDateInRange(date: string, range: ReportingDateRange): boolean {
  return compareIsoDates(date, range.start) >= 0 && compareIsoDates(date, range.end) <= 0;
}

export function isDateOnOrBeforeDemo(date: string): boolean {
  return compareIsoDates(date, DEMO_AS_OF_DATE) <= 0;
}

export function resolveReportingRange(
  preset: ReportingPeriodPreset,
  customStart?: string,
  customEnd?: string
): ReportingRangeResult | ReportingRangeError {
  const asOf = DEMO_AS_OF_DATE;

  if (preset === "last7") {
    const start = addCalendarDays(asOf, -6);
    return okRange(start, asOf, preset, "Last 7 days");
  }
  if (preset === "last30") {
    const start = addCalendarDays(asOf, -29);
    return okRange(start, asOf, preset, "Last 30 days");
  }
  if (preset === "mtd") {
    const { y, m } = parseIsoDate(asOf);
    const start = formatIsoDate(y, m, 1);
    return okRange(start, asOf, preset, "Month to date");
  }
  if (preset === "prev_month") {
    const { y, m } = parseIsoDate(asOf);
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const start = formatIsoDate(prevYear, prevMonth, 1);
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const end = formatIsoDate(prevYear, prevMonth, lastDay);
    return okRange(start, end, preset, "Previous calendar month");
  }

  const start = customStart?.trim();
  const end = customEnd?.trim();
  if (!start || !end) {
    return { ok: false, error: "Choose a start and end date for the custom range." };
  }
  if (compareIsoDates(start, end) > 0) {
    return { ok: false, error: "Start date must be on or before end date." };
  }
  if (compareIsoDates(end, asOf) > 0) {
    return {
      ok: false,
      error: `End date cannot be after the demo reporting date (${asOf}).`,
    };
  }
  if (compareIsoDates(start, asOf) > 0) {
    return { ok: false, error: "Start date cannot be after the demo reporting date." };
  }
  return okRange(start, end, preset, "Custom range");
}

function okRange(
  start: string,
  end: string,
  preset: ReportingPeriodPreset,
  label: string
): ReportingRangeResult {
  return {
    ok: true,
    range: { start, end, preset },
    endExclusive: addCalendarDays(end, 1),
    label,
  };
}

/** Equivalent preceding window (same day count), ending the day before `range.start`. */
export function priorComparisonRange(
  range: ReportingDateRange
): ReportingDateRange {
  const len = daysBetweenInclusive(range.start, range.end);
  const priorEnd = addCalendarDays(range.start, -1);
  const priorStart = addCalendarDays(priorEnd, -(len - 1));
  return {
    start: priorStart,
    end: priorEnd,
    preset: range.preset,
  };
}

/** MTD: compare to same elapsed days in the previous calendar month. */
export function mtdComparisonRange(asOf: string = DEMO_AS_OF_DATE): ReportingDateRange {
  const { y, m, d } = parseIsoDate(asOf);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const start = formatIsoDate(prevYear, prevMonth, 1);
  const lastDayPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const endDay = Math.min(d, lastDayPrev);
  const end = formatIsoDate(prevYear, prevMonth, endDay);
  return { start, end, preset: "mtd" };
}

/** Calendar YYYY-MM-DD → display label (day does not shift with viewer timezone). */
export function formatCalendarDateDisplay(
  iso: string,
  style: "short" | "withWeekday" = "short"
): string {
  const { y, m, d } = parseIsoDate(iso);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utcNoon.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(style === "withWeekday" ? { weekday: "short" as const } : {}),
    timeZone: "UTC",
  });
}

function formatWallClockTime(hour: number, minute: number): string {
  const h12 = hour % 12 || 12;
  const ap = hour >= 12 ? "PM" : "AM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ap}`;
}

/** Demo timestamps omit TZ — treat as business wall clock (date + time from string). */
export function formatNaiveBusinessDateTime(naive: string): { date: string; time: string } {
  const datePart = naive.slice(0, 10);
  const match = naive.match(/T(\d{2}):(\d{2})/);
  return {
    date: formatCalendarDateDisplay(datePart, "withWeekday"),
    time: match
      ? formatWallClockTime(Number(match[1]), Number(match[2]))
      : "",
  };
}

export function formatRangeForDisplay(range: ReportingDateRange): string {
  return `${formatCalendarDateDisplay(range.start)} – ${formatCalendarDateDisplay(range.end)}`;
}

export function formatComparisonDelta(
  current: number,
  prior: number
): { text: string; tone: "neutral" | "up" | "down" } {
  if (current === 0 && prior === 0) {
    return { text: "Flat vs comparison window", tone: "neutral" };
  }
  if (prior === 0) {
    return { text: "No comparison baseline in prior window", tone: "neutral" };
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  return {
    text: `${pct >= 0 ? "+" : ""}${pct}% vs comparison window`,
    tone: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
  };
}
