import type { ReportingPeriodKey } from "./workspace-business-data";
import {
  DEMO_AS_OF_DATE,
  type BusinessAppointment,
  type BusinessInvoice,
  type BusinessPayment,
  type WorkspaceBusinessData,
} from "./workspace-business-data";

const AS_OF = new Date(`${DEMO_AS_OF_DATE}T23:59:59`);

function parseDay(iso: string): Date {
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
}

function inPeriod(date: Date, period: ReportingPeriodKey): boolean {
  const start = new Date(AS_OF);
  if (period === "mtd") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return date >= start && date <= AS_OF;
  }
  if (period === "last30") {
    const s = new Date(AS_OF);
    s.setDate(s.getDate() - 30);
    return date >= s && date <= AS_OF;
  }
  const s = new Date(AS_OF);
  s.setDate(s.getDate() - 7);
  return date >= s && date <= AS_OF;
}

export function sumPaymentsInPeriod(
  payments: BusinessPayment[],
  period: ReportingPeriodKey
): number {
  return payments
    .filter((p) => inPeriod(parseDay(p.date), period))
    .reduce((s, p) => s + p.amount, 0);
}

export function sumOutstandingInvoices(invoices: BusinessInvoice[]): number {
  return invoices
    .filter((inv) => inv.status !== "Paid" && inv.balanceDue > 0)
    .reduce((s, inv) => s + inv.balanceDue, 0);
}

export function countUpcomingAppointments(
  appointments: BusinessAppointment[],
  windowDays = 7,
  asOf: Date = AS_OF
): number {
  const end = new Date(asOf);
  end.setDate(end.getDate() + windowDays);
  return appointments.filter((a) => {
    const d = parseDay(a.startAt);
    return d >= asOf && d <= end;
  }).length;
}

export function buildTrendFromPayments(
  data: WorkspaceBusinessData,
  buckets = 7
): { label: string; amount: number }[] {
  const sorted = [...data.payments].sort(
    (a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime()
  );
  const slice = sorted.slice(-buckets);
  return slice.map((p) => ({
    label: parseDay(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: p.amount,
  }));
}

export function filterInvoicesBySearch(
  invoices: BusinessInvoice[],
  query: string
): BusinessInvoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return invoices;
  return invoices.filter(
    (inv) =>
      inv.customer.toLowerCase().includes(q) ||
      inv.lineSummary.toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q)
  );
}

export function getReportingPeriodLabel(period: ReportingPeriodKey): string {
  switch (period) {
    case "mtd":
      return "Month to date (demo as of Mar 12, 2026)";
    case "last30":
      return "Last 30 days";
    case "last7":
      return "Last 7 days";
  }
}
