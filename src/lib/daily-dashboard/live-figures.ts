import { currencyExponent } from "@/lib/square/collections-presentation";
import type { TrendBucket } from "@/lib/workspace-analytics";
import { addCalendarDays } from "@/lib/workspace-reporting-period";
import type {
  BusinessAppointment,
  BusinessInvoice,
  WorkspaceBusinessData,
} from "@/lib/workspace-business-data";
import { summarizeCollectionsPeriod } from "./collections-period";
import type { DailyDashboardSnapshot } from "./types";

export const LIVE_REVENUE_UNAVAILABLE =
  "Unavailable. No connected source defines revenue.";
export const LIVE_PIPELINE_UNAVAILABLE =
  "Unavailable. No connected source defines pipeline.";
export const LIVE_JOBS_UNAVAILABLE =
  "Unavailable. No connected source lists completed jobs.";

const SCHEDULE_WITH_ROWS = new Set(["ready", "verified_empty", "stale"]);

export function defaultLiveRangeStart(asOf: string): string {
  return addCalendarDays(asOf, -6);
}

export type LiveFigures = {
  paymentsMessage: string | null;
  paymentsAmount: number | null;
  paymentsCurrency: string | null;
  jobsMessage: string;
  receivablesMessage: string | null;
  revenueMessage: string;
  pipelineMessage: string;
  chartMessage: string | null;
  trend: TrendBucket[] | null;
  scheduleBlocked: string | null;
  scheduleNote: string | null;
  hideAging: boolean;
};

export function describeLiveFigures(
  snapshot: DailyDashboardSnapshot,
  range: { start: string; end: string }
): LiveFigures {
  const collections = collectionFigures(snapshot, range);
  const scheduleBlocked = SCHEDULE_WITH_ROWS.has(snapshot.schedule.state)
    ? null
    : snapshot.schedule.messages[0] ?? "Appointments are unavailable.";
  return {
    ...collections,
    jobsMessage: LIVE_JOBS_UNAVAILABLE,
    receivablesMessage: snapshot.receivables.showBalances
      ? null
      : snapshot.receivables.messages[0] ?? "QuickBooks receivables are unavailable.",
    revenueMessage: LIVE_REVENUE_UNAVAILABLE,
    pipelineMessage: LIVE_PIPELINE_UNAVAILABLE,
    scheduleBlocked,
    scheduleNote:
      snapshot.schedule.state === "stale"
        ? snapshot.schedule.messages[0] ?? "Appointments may be out of date."
        : null,
    hideAging: !snapshot.receivables.showBalances || snapshot.receivables.listTruncated,
  };
}

export function liveBusinessData(snapshot: DailyDashboardSnapshot): WorkspaceBusinessData {
  const invoices: BusinessInvoice[] = snapshot.receivables.showBalances
    ? snapshot.receivables.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.docNumber ?? invoice.id,
        customerId: invoice.id,
        customer: invoice.customer,
        issueDate: invoice.dueDate ?? snapshot.asOfDate,
        dueDate: invoice.dueDate ?? snapshot.asOfDate,
        amount: invoice.balance,
        balanceDue: invoice.balance,
        status: invoice.overdue ? "Past due" : "Open",
        lineSummary: "QuickBooks",
        sourceLabel: "QuickBooks",
        href: invoice.href,
      }))
    : [];

  return {
    workspaceId: "live-company",
    demoAsOf: snapshot.asOfDate,
    customers: [],
    jobs: [],
    payments: [],
    invoices,
    appointments: liveAppointments(snapshot),
  };
}

export function liveAppointments(snapshot: DailyDashboardSnapshot): BusinessAppointment[] {
  if (!SCHEDULE_WITH_ROWS.has(snapshot.schedule.state)) return [];
  return snapshot.schedule.appointments.flatMap((appointment) => {
    const startAt = appointment.startsAt ?? `${appointment.isoDate}T12:00:00`;
    if (!startAt) return [];
    return [
      {
        id: appointment.id,
        startAt,
        title: appointment.title,
        location: appointment.calendarName ?? "",
        assignee: "",
        status: "scheduled" as const,
        sourceLabel: "Google Calendar",
      },
    ];
  });
}

function collectionFigures(
  snapshot: DailyDashboardSnapshot,
  range: { start: string; end: string }
): Pick<
  LiveFigures,
  "paymentsMessage" | "paymentsAmount" | "paymentsCurrency" | "chartMessage" | "trend"
> {
  const collections = snapshot.collections;
  if (!collections.showTotals) {
    const message = collections.messages[0] ?? "Square collections are unavailable.";
    return {
      paymentsMessage: message,
      paymentsAmount: null,
      paymentsCurrency: null,
      chartMessage: message,
      trend: null,
    };
  }

  const summary = summarizeCollectionsPeriod({
    transactions: collections.transactions,
    range,
    authoritativeDay: collections.authoritativeDay,
    loadedCap: collections.loadedCap,
  });
  if (summary.partial) {
    const message =
      "This range starts before the loaded Square activity, so a total is not shown.";
    return {
      paymentsMessage: message,
      paymentsAmount: null,
      paymentsCurrency: null,
      chartMessage: message,
      trend: null,
    };
  }
  if (summary.currencies.length > 1) {
    return {
      paymentsMessage: "Payments stay separated by currency, so one combined total is not shown.",
      paymentsAmount: null,
      paymentsCurrency: summary.currency,
      chartMessage: null,
      trend: summary.showChart ? summary.trend : null,
    };
  }

  const currency = summary.currency ?? "USD";
  const row = summary.currencies.find((item) => item.currency === currency);
  const amount = row ? row.paymentsMinor / 10 ** currencyExponent(currency) : 0;
  return {
    paymentsMessage: null,
    paymentsAmount: amount,
    paymentsCurrency: currency,
    chartMessage: summary.showChart
      ? null
      : summary.verifiedEmpty
        ? "No completed payments or refunds in this range."
        : "This range is one reporting date, so there is no multi-day trend.",
    trend: summary.showChart ? summary.trend : null,
  };
}
