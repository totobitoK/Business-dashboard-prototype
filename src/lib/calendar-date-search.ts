import {
  formatCalendarDateDisplay,
  formatIsoDate,
  parseIsoDate,
} from "./workspace-reporting-period";
import { DEMO_AS_OF_DATE } from "./workspace-business-data";

const ORDINAL_SUFFIX = /(\d+)(?:st|nd|rd|th)\b/gi;

const MONTH_BY_NAME: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function normalizeDateSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(ORDINAL_SUFFIX, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ordinalDayLabel(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function expandYear(y: number | undefined, fallbackYear: number): number | undefined {
  if (y === undefined) return undefined;
  if (y < 100) return 2000 + y;
  return y;
}

export type ParsedCalendarQuery =
  | { kind: "full"; iso: string }
  | { kind: "monthDay"; month: number; day: number };

/** Parse common US-style date search fragments. */
export function parseFlexibleCalendarDateQuery(
  rawQuery: string,
  fallbackYear: number = parseIsoDate(DEMO_AS_OF_DATE).y
): ParsedCalendarQuery | null {
  const q = normalizeDateSearchText(rawQuery);
  if (!q) return null;

  const slash = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = expandYear(slash[3] ? Number(slash[3]) : undefined, fallbackYear);
    if (!isValidMonthDay(month, day)) return null;
    if (year === undefined) return { kind: "monthDay", month, day };
    return { kind: "full", iso: formatIsoDate(year, month, day) };
  }

  const iso = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidMonthDay(month, day)) return null;
    return { kind: "full", iso: formatIsoDate(year, month, day) };
  }

  const named = q.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (named) {
    const month = MONTH_BY_NAME[named[1]!];
    if (!month) return null;
    const day = Number(named[2]);
    const year = expandYear(named[3] ? Number(named[3]) : undefined, fallbackYear);
    if (!isValidMonthDay(month, day)) return null;
    if (year === undefined) return { kind: "monthDay", month, day };
    return { kind: "full", iso: formatIsoDate(year, month, day) };
  }

  return null;
}

function isValidMonthDay(month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return true;
}

/** Lowercase phrases that should match a calendar ISO date in search. */
export function calendarDateSearchPhrases(iso: string): string[] {
  const { y, m, d } = parseIsoDate(iso);
  const phrases = new Set<string>();

  const add = (value: string) => {
    const n = normalizeDateSearchText(value);
    if (n) phrases.add(n);
  };

  add(formatCalendarDateDisplay(iso, "short"));
  add(formatCalendarDateDisplay(iso, "short").replace(/, \d{4}$/, ""));

  const longMonth = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  add(longMonth);
  add(longMonth.replace(/, \d{4}$/, ""));
  add(`${longMonth.split(" ")[0]!.toLowerCase()} ${ordinalDayLabel(d)}`);
  add(`${longMonth.split(" ")[0]!.toLowerCase()} ${ordinalDayLabel(d)} ${y}`);

  add(`${m}/${d}/${y}`);
  add(`${m}/${d}/${String(y).slice(-2)}`);
  add(iso);

  return [...phrases];
}

/** True when `rawQuery` matches a calendar day (ISO YYYY-MM-DD). */
export function calendarDateMatchesSearch(iso: string, rawQuery: string): boolean {
  const q = normalizeDateSearchText(rawQuery);
  if (!q) return false;

  const phrases = calendarDateSearchPhrases(iso);
  if (phrases.some((phrase) => phrase.includes(q) || q.includes(phrase))) {
    return true;
  }

  const parsed = parseFlexibleCalendarDateQuery(q);
  if (!parsed) return false;

  const { y, m, d } = parseIsoDate(iso);
  if (parsed.kind === "full") return parsed.iso === iso;
  return parsed.month === m && parsed.day === d;
}

/** Match when any calendar field on a record matches the query. */
export function anyCalendarDateMatchesSearch(
  isoDates: Iterable<string>,
  rawQuery: string
): boolean {
  for (const iso of isoDates) {
    if (iso && calendarDateMatchesSearch(iso, rawQuery)) return true;
  }
  return false;
}
