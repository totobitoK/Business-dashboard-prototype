import {
  currencyExponent,
  type SquareCurrencyTotal,
  type SquareTransactionRow,
} from "@/lib/square/collections-presentation";
import {
  addCalendarDays,
  compareIsoDates,
  isDateInRange,
  resolveReportingRangeAsOf,
  type ReportingDateRange,
} from "@/lib/workspace-reporting-period";

export type DashboardPeriodChoice = "day" | "last7" | "last30" | "mtd";

export type ResolvedDashboardPeriod = ReportingDateRange & { label: string };

export function resolveDashboardPeriod(
  asOf: string,
  choice: DashboardPeriodChoice
): ResolvedDashboardPeriod {
  if (choice === "day") {
    return { start: asOf, end: asOf, preset: "custom", label: "Reporting date" };
  }
  const resolved = resolveReportingRangeAsOf(asOf, choice);
  if (!resolved.ok) {
    return { start: asOf, end: asOf, preset: "custom", label: "Reporting date" };
  }
  return { ...resolved.range, label: resolved.label };
}

export type CollectionsPeriodSummary = {
  currencies: SquareCurrencyTotal[];
  transactions: SquareTransactionRow[];
  trend: { label: string; start: string; end: string; amount: number }[];
  currency: string | null;
  verifiedEmpty: boolean;
  partial: boolean;
  authoritative: boolean;
  totalsExceedList: boolean;
  showChart: boolean;
};

export function summarizeCollectionsPeriod(input: {
  transactions: SquareTransactionRow[];
  range: { start: string; end: string };
  authoritativeDay: { date: string; currencies: SquareCurrencyTotal[] } | null;
  loadedCap: number | null;
}): CollectionsPeriodSummary {
  const inRange = input.transactions
    .filter((row) => isDateInRange(row.reportingDate, { ...input.range, preset: "custom" }))
    .sort((a, b) => {
      if (a.reportingDate !== b.reportingDate) return a.reportingDate < b.reportingDate ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  const dates = input.transactions.map((row) => row.reportingDate).sort();
  const oldest = dates[0] ?? null;
  const capped = input.loadedCap != null && input.transactions.length >= input.loadedCap;
  const partial = capped && oldest != null && compareIsoDates(input.range.start, oldest) < 0;

  const singleDay = input.range.start === input.range.end;
  const authoritative =
    singleDay && input.authoritativeDay != null && input.authoritativeDay.date === input.range.start;

  const listed = sortCurrencies(sumTransactions(inRange));
  const currencies = authoritative
    ? sortCurrencies(input.authoritativeDay!.currencies)
    : listed;
  const totalsExceedList = authoritative && !sameMoney(currencies, listed);

  const currency = pickCurrency(currencies, inRange);
  const complete = authoritative || !partial;
  const noMoney = currencies.every((row) => row.paymentsMinor === 0 && row.refundsMinor === 0);
  const verifiedEmpty = complete && (currencies.length === 0 || noMoney);
  const trend = buildTrend(inRange, input.range, currency, complete && !verifiedEmpty);
  const showChart =
    !verifiedEmpty &&
    !singleDay &&
    trend.some((bucket) => bucket.amount !== 0);

  return {
    currencies: verifiedEmpty ? [] : currencies,
    transactions: inRange,
    trend,
    currency,
    verifiedEmpty,
    partial: authoritative ? false : partial,
    authoritative,
    totalsExceedList,
    showChart,
  };
}

function sumTransactions(rows: SquareTransactionRow[]): SquareCurrencyTotal[] {
  const byCurrency = new Map<string, SquareCurrencyTotal>();
  for (const row of rows) {
    const current = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      paymentsMinor: 0,
      refundsMinor: 0,
      netMinor: 0,
    };
    if (row.kind === "refund") current.refundsMinor += row.amountMinor;
    else current.paymentsMinor += row.amountMinor;
    current.netMinor = current.paymentsMinor - current.refundsMinor;
    byCurrency.set(row.currency, current);
  }
  return [...byCurrency.values()];
}

function sameMoney(authoritative: SquareCurrencyTotal[], listed: SquareCurrencyTotal[]): boolean {
  if (authoritative.length !== listed.length) return false;
  return authoritative.every((row) => {
    const match = listed.find((item) => item.currency === row.currency);
    return (
      match != null &&
      match.paymentsMinor === row.paymentsMinor &&
      match.refundsMinor === row.refundsMinor
    );
  });
}

function sortCurrencies(rows: SquareCurrencyTotal[]): SquareCurrencyTotal[] {
  return [...rows].sort((a, b) => {
    if (a.currency === "USD") return -1;
    if (b.currency === "USD") return 1;
    return a.currency.localeCompare(b.currency);
  });
}

function pickCurrency(
  currencies: SquareCurrencyTotal[],
  rows: SquareTransactionRow[]
): string | null {
  if (currencies.some((row) => row.currency === "USD")) return "USD";
  if (currencies[0]) return currencies[0].currency;
  if (rows.some((row) => row.currency === "USD")) return "USD";
  return rows[0]?.currency ?? null;
}

function buildTrend(
  rows: SquareTransactionRow[],
  range: { start: string; end: string },
  currency: string | null,
  fillEmptyDays: boolean
): CollectionsPeriodSummary["trend"] {
  if (!currency) return [];
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== currency) continue;
    const signed = row.kind === "refund" ? -row.amountMinor : row.amountMinor;
    totals.set(row.reportingDate, (totals.get(row.reportingDate) ?? 0) + signed);
  }
  const days = fillEmptyDays ? eachDay(range.start, range.end) : [...totals.keys()].sort();
  const exponent = currencyExponent(currency);
  return days.map((day) => ({
    label: "",
    start: day,
    end: day,
    amount: (totals.get(day) ?? 0) / 10 ** exponent,
  }));
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  for (let i = 0; i < 400 && compareIsoDates(cursor, end) <= 0; i++) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}
