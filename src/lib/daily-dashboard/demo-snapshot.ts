import { WORKSPACE_ALPINE_HVAC } from "@/lib/customer-workspaces";
import type { SquareTransactionRow } from "@/lib/square/collections-presentation";
import { getWorkspaceBusinessData } from "@/lib/workspace-business-data";
import { DEMO_AS_OF_DATE } from "@/lib/workspace-demo-date";
import {
  BUSINESS_TIMEZONE,
  addCalendarDays,
  compareIsoDates,
  formatNaiveBusinessDateTime,
} from "@/lib/workspace-reporting-period";
import type { DailyDashboardSnapshot } from "./types";

const SAMPLE_SQUARE: Array<{
  day: number;
  kind: "payment" | "refund";
  amountMinor: number;
}> = [
  { day: -6, kind: "payment", amountMinor: 12000 },
  { day: -5, kind: "payment", amountMinor: 8000 },
  { day: -4, kind: "payment", amountMinor: 15000 },
  { day: -4, kind: "refund", amountMinor: 2000 },
  { day: -3, kind: "payment", amountMinor: 5000 },
  { day: -2, kind: "payment", amountMinor: 22000 },
  { day: -1, kind: "payment", amountMinor: 9000 },
  { day: 0, kind: "payment", amountMinor: 18000 },
  { day: 0, kind: "refund", amountMinor: 1500 },
];

export function buildDemoDailySnapshot(input: {
  workspaceId: string;
  companyName: string;
}): DailyDashboardSnapshot {
  const data = getWorkspaceBusinessData(input.workspaceId);
  const alpine = input.workspaceId === WORKSPACE_ALPINE_HVAC;
  const sampleLabel = alpine ? "Alpine HVAC sample" : `${input.companyName} sample`;
  const location = alpine ? "Denver shop" : "Sample location";
  const asOf = DEMO_AS_OF_DATE;
  const transactions = sampleSquareTransactions(asOf, location);
  const dayRows = transactions.filter((row) => row.reportingDate === asOf);
  const payments = dayRows
    .filter((row) => row.kind === "payment")
    .reduce((sum, row) => sum + row.amountMinor, 0);
  const refunds = dayRows
    .filter((row) => row.kind === "refund")
    .reduce((sum, row) => sum + row.amountMinor, 0);

  const invoices = (data?.invoices ?? [])
    .filter((invoice) => invoice.balanceDue > 0)
    .map((invoice) => ({
      id: invoice.id,
      customer: invoice.customer,
      docNumber: invoice.invoiceNumber,
      balance: invoice.balanceDue,
      dueDate: invoice.dueDate,
      overdue: compareIsoDates(invoice.dueDate, asOf) < 0,
      href: null,
    }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));

  const openBalance = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdue = invoices.filter((invoice) => invoice.overdue);
  const overdueBalance = overdue.reduce((sum, invoice) => sum + invoice.balance, 0);
  const syncedAt = `${asOf}T18:00:00Z`;

  const appointments = (data?.appointments ?? [])
    .filter((appointment) => appointment.status !== "canceled")
    .map((appointment) => {
      const when = formatNaiveBusinessDateTime(appointment.startAt);
      return {
        id: appointment.id,
        title: appointment.title,
        whenLabel: when.time ? `${when.date} · ${when.time}` : when.date,
        isoDate: appointment.startAt.slice(0, 10),
        calendarName: appointment.location,
      };
    })
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.whenLabel.localeCompare(b.whenLabel));

  return {
    source: "demo",
    sampleLabel,
    companyName: input.companyName,
    asOfDate: asOf,
    timeZone: BUSINESS_TIMEZONE,
    receivables: {
      state: invoices.length === 0 ? "verified_empty" : "ready",
      messages: invoices.length === 0 ? ["Sample read: no open invoices."] : [],
      showBalances: true,
      asOfDate: asOf,
      openBalance,
      overdueBalance,
      overdueCount: overdue.length,
      invoices,
      invoiceCount: invoices.length,
      listTruncated: false,
      lastSuccessfulSyncAt: syncedAt,
      environmentLabel: "Sample",
      sourceCompanyName: input.companyName,
    },
    collections: {
      state: "ready",
      messages: [],
      showTotals: true,
      timeZone: BUSINESS_TIMEZONE,
      lastSuccessfulSyncAt: syncedAt,
      environmentLabel: "Sample",
      merchantName: input.companyName,
      authoritativeDay: {
        date: asOf,
        currencies: [
          { currency: "USD", paymentsMinor: payments, refundsMinor: refunds, netMinor: payments - refunds },
        ],
      },
      transactions,
      loadedCap: null,
    },
    schedule: {
      state: appointments.length === 0 ? "verified_empty" : "ready",
      messages: appointments.length === 0 ? ["Sample read: no appointments in the Today / Upcoming window."] : [],
      windowLabel: "Today / Upcoming",
      lastSyncAt: syncedAt,
      appointments,
    },
    connectors: [
      {
        id: "quickbooks",
        label: "QuickBooks",
        state: "ready",
        detail: "Sample connection",
        lastSuccessfulSyncAt: syncedAt,
      },
      {
        id: "square",
        label: "Square",
        state: "ready",
        detail: "Sample connection",
        lastSuccessfulSyncAt: syncedAt,
      },
      {
        id: "google-calendar",
        label: "Google Calendar",
        state: appointments.length === 0 ? "verified_empty" : "ready",
        detail: "Sample connection",
        lastSuccessfulSyncAt: syncedAt,
      },
    ],
  };
}

function sampleSquareTransactions(asOf: string, location: string): SquareTransactionRow[] {
  return SAMPLE_SQUARE.map((row, index) => {
    const reportingDate = addCalendarDays(asOf, row.day);
    return {
      id: `sample-square-${index}`,
      kind: row.kind,
      locationName: location,
      createdAt: `${reportingDate}T15:00:00Z`,
      reportingDate,
      currency: "USD",
      amountMinor: row.amountMinor,
      sourceType: "CARD",
    };
  });
}
