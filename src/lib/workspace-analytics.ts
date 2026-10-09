import {
  DEMO_AS_OF_DATE,
  type BusinessAppointment,
  type BusinessInvoice,
  type BusinessJob,
  type BusinessPayment,
  type WorkspaceBusinessData,
} from "./workspace-business-data";
import { anyCalendarDateMatchesSearch } from "./calendar-date-search";
import {
  compareIsoDates,
  isDateInRange,
  isDateOnOrBeforeDemo,
  mtdComparisonRange,
  priorComparisonRange,
  type ReportingDateRange,
  type ReportingPeriodPreset,
  resolveReportingRange,
} from "./workspace-reporting-period";

export {
  formatComparisonDelta,
  formatRangeForDisplay,
  resolveReportingRange,
  type ReportingDateRange,
  type ReportingPeriodPreset,
} from "./workspace-reporting-period";

export function sumPaymentsInRange(
  payments: BusinessPayment[],
  range: ReportingDateRange
): number {
  return payments
    .filter(
      (p) =>
        isDateOnOrBeforeDemo(p.date) && isDateInRange(p.date, range)
    )
    .reduce((s, p) => s + p.amount, 0);
}

export function countCompletedJobsInRange(
  jobs: BusinessJob[],
  range: ReportingDateRange
): number {
  return jobs.filter(
    (j) =>
      j.status === "completed" &&
      j.completedDate &&
      isDateOnOrBeforeDemo(j.completedDate) &&
      isDateInRange(j.completedDate, range)
  ).length;
}

export function getComparisonRange(
  range: ReportingDateRange
): ReportingDateRange {
  if (range.preset === "mtd") {
    return mtdComparisonRange(DEMO_AS_OF_DATE);
  }
  return priorComparisonRange(range);
}

export function sumOutstandingInvoices(invoices: BusinessInvoice[]): number {
  return invoices
    .filter((inv) => inv.balanceDue > 0 && inv.status !== "Paid")
    .reduce((s, inv) => s + inv.balanceDue, 0);
}

export function sumOverdueInvoices(
  invoices: BusinessInvoice[],
  asOf: string = DEMO_AS_OF_DATE
): number {
  return invoices
    .filter(
      (inv) =>
        inv.balanceDue > 0 &&
        inv.status !== "Paid" &&
        inv.dueDate < asOf
    )
    .reduce((s, inv) => s + inv.balanceDue, 0);
}

export function countOverdueInvoices(
  invoices: BusinessInvoice[],
  asOf: string = DEMO_AS_OF_DATE
): number {
  return invoices.filter(
    (inv) =>
      inv.balanceDue > 0 &&
      inv.status !== "Paid" &&
      inv.dueDate < asOf
  ).length;
}

export function oldestUnpaidInvoiceDaysOverdue(
  invoices: BusinessInvoice[],
  asOf: string = DEMO_AS_OF_DATE
): number | null {
  const unpaid = invoices.filter((inv) => inv.balanceDue > 0 && inv.status !== "Paid");
  if (unpaid.length === 0) return null;
  const oldest = unpaid.reduce((a, b) => (a.dueDate < b.dueDate ? a : b));
  const due = new Date(`${oldest.dueDate}T12:00:00Z`);
  const as = new Date(`${asOf}T12:00:00Z`);
  const days = Math.floor((as.getTime() - due.getTime()) / 86400000);
  return Math.max(0, days);
}

export type InvoiceAgingBucket =
  | "not_due"
  | "1_30"
  | "31_60"
  | "61_90"
  | "90_plus";

export function invoiceAgingBuckets(
  invoices: BusinessInvoice[],
  asOf: string = DEMO_AS_OF_DATE
): Record<InvoiceAgingBucket, { count: number; total: number }> {
  const buckets: Record<InvoiceAgingBucket, { count: number; total: number }> = {
    not_due: { count: 0, total: 0 },
    "1_30": { count: 0, total: 0 },
    "31_60": { count: 0, total: 0 },
    "61_90": { count: 0, total: 0 },
    "90_plus": { count: 0, total: 0 },
  };
  for (const inv of invoices) {
    if (inv.balanceDue <= 0 || inv.status === "Paid") continue;
    const due = new Date(`${inv.dueDate}T12:00:00Z`);
    const as = new Date(`${asOf}T12:00:00Z`);
    const daysOver = Math.floor((as.getTime() - due.getTime()) / 86400000);
    let key: InvoiceAgingBucket = "not_due";
    if (daysOver <= 0) key = "not_due";
    else if (daysOver <= 30) key = "1_30";
    else if (daysOver <= 60) key = "31_60";
    else if (daysOver <= 90) key = "61_90";
    else key = "90_plus";
    buckets[key].count += 1;
    buckets[key].total += inv.balanceDue;
  }
  return buckets;
}

export interface TrendBucket {
  label: string;
  start: string;
  end: string;
  amount: number;
}

export function buildCollectionsTrend(
  payments: BusinessPayment[],
  range: ReportingDateRange
): TrendBucket[] {
  const inRange = payments.filter(
    (p) => isDateOnOrBeforeDemo(p.date) && isDateInRange(p.date, range)
  );
  const daySpan =
    Math.floor(
      (new Date(`${range.end}T12:00:00Z`).getTime() -
        new Date(`${range.start}T12:00:00Z`).getTime()) /
        86400000
    ) + 1;
  if (daySpan <= 31) {
    const buckets: TrendBucket[] = [];
    let cursor = range.start;
    while (cursor <= range.end) {
      const amount = inRange
        .filter((p) => p.date === cursor)
        .reduce((s, p) => s + p.amount, 0);
      buckets.push({
        label: new Date(`${cursor}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        start: cursor,
        end: cursor,
        amount,
      });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  return buildMondaySundayWeeklyBuckets(inRange, range);
}

/** Calendar weeks Mon–Sun; first/last buckets may be partial within the range. */
function buildMondaySundayWeeklyBuckets(
  inRange: BusinessPayment[],
  range: ReportingDateRange
): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let weekStart = range.start;
  while (compareIsoDates(weekStart, range.end) <= 0) {
    const sunday = endOfCalendarWeek(weekStart);
    const weekEnd =
      compareIsoDates(sunday, range.end) > 0 ? range.end : sunday;
    const amount = inRange
      .filter((p) => p.date >= weekStart && p.date <= weekEnd)
      .reduce((s, p) => s + p.amount, 0);
    buckets.push({
      label: `${weekStart}–${weekEnd}`,
      start: weekStart,
      end: weekEnd,
      amount,
    });
    weekStart = addDays(weekEnd, 1);
  }
  return buckets;
}

function utcDayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Sunday at the end of the Mon–Sun week containing `iso`. */
function endOfCalendarWeek(iso: string): string {
  const dow = utcDayOfWeek(iso);
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  return addDays(iso, daysUntilSunday);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function countUpcomingAppointments(
  appointments: BusinessAppointment[],
  windowDays = 7,
  asOf: string = DEMO_AS_OF_DATE
): number {
  const start = new Date(`${asOf}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + windowDays);
  return appointments.filter((a) => {
    if (a.status === "canceled") return false;
    const d = new Date(a.startAt);
    return d >= start && d <= end;
  }).length;
}

export function listUpcomingAppointments(
  appointments: BusinessAppointment[],
  windowDays = 7,
  asOf: string = DEMO_AS_OF_DATE
): BusinessAppointment[] {
  const start = new Date(`${asOf}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + windowDays);
  return appointments
    .filter((a) => {
      if (a.status === "canceled") return false;
      const d = new Date(a.startAt);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export type InvoiceSortKey = "dueDate" | "balance";

export function filterInvoices({
  invoices,
  search,
  status,
}: {
  invoices: BusinessInvoice[];
  search: string;
  status: "all" | "Open" | "Past due" | "Paid";
}): BusinessInvoice[] {
  let list = invoices;
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (inv) =>
        inv.customer.toLowerCase().includes(q) ||
        inv.lineSummary.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        anyCalendarDateMatchesSearch([inv.issueDate, inv.dueDate], q)
    );
  }
  if (status !== "all") {
    list = list.filter((inv) => inv.status === status);
  }
  return list;
}

export function sortInvoices(
  invoices: BusinessInvoice[],
  sortKey: InvoiceSortKey,
  direction: "asc" | "desc"
): BusinessInvoice[] {
  const sorted = [...invoices].sort((a, b) => {
    if (sortKey === "dueDate") {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.balanceDue - b.balanceDue;
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function paymentsForInvoice(
  data: WorkspaceBusinessData,
  invoiceId: string
): BusinessPayment[] {
  return data.payments.filter((p) => p.invoiceId === invoiceId);
}

export function filterJobsInRange({
  jobs,
  range,
  status,
  category,
}: {
  jobs: BusinessJob[];
  range: ReportingDateRange;
  status: "all" | BusinessJob["status"];
  category: string;
}): BusinessJob[] {
  return jobs.filter((j) => {
    const activityDate =
      j.status === "completed" && j.completedDate
        ? j.completedDate
        : j.scheduledDate;
    if (!isDateOnOrBeforeDemo(activityDate)) return false;
    if (j.status === "completed" && j.completedDate) {
      if (!isDateInRange(j.completedDate, range)) return false;
    } else if (!isDateInRange(j.scheduledDate, range)) {
      return false;
    }
    if (status !== "all" && j.status !== status) return false;
    if (category !== "all" && j.category !== category) return false;
    return true;
  });
}

export function appointmentAssigneeBreakdown(
  appointments: BusinessAppointment[]
): { assignee: string; count: number }[] {
  const map = new Map<string, number>();
  for (const appt of appointments) {
    if (appt.status === "canceled") continue;
    map.set(appt.assignee, (map.get(appt.assignee) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count || a.assignee.localeCompare(b.assignee));
}

export function serviceCategoryBreakdown(
  jobs: BusinessJob[],
  range: ReportingDateRange
): { category: string; completed: number }[] {
  const map = new Map<string, number>();
  for (const j of jobs) {
    if (j.status !== "completed" || !j.completedDate) continue;
    if (!isDateInRange(j.completedDate, range)) continue;
    map.set(j.category, (map.get(j.category) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([category, completed]) => ({ category, completed }))
    .sort((a, b) => b.completed - a.completed);
}

/** Legacy helper */
export function sumPaymentsInPeriod(
  payments: BusinessPayment[],
  period: "mtd" | "last30" | "last7"
): number {
  const resolved = resolveReportingRange(period);
  if (!resolved.ok) return 0;
  return sumPaymentsInRange(payments, resolved.range);
}

export function filterInvoicesBySearch(
  invoices: BusinessInvoice[],
  query: string
): BusinessInvoice[] {
  return filterInvoices({ invoices, search: query, status: "all" });
}

export function getReportingPeriodLabel(period: ReportingPeriodPreset): string {
  switch (period) {
    case "mtd":
      return "Month to date";
    case "last30":
      return "Last 30 days";
    case "last7":
      return "Last 7 days";
    case "prev_month":
      return "Previous calendar month";
    case "custom":
      return "Custom range";
  }
}

export function buildTrendFromPayments(
  data: WorkspaceBusinessData,
  range?: ReportingDateRange
): { label: string; amount: number }[] {
  const fallback: ReportingDateRange = {
    start: addDays(DEMO_AS_OF_DATE, -6),
    end: DEMO_AS_OF_DATE,
    preset: "last7",
  };
  const r =
    range ??
    (resolveReportingRange("last7").ok
      ? (resolveReportingRange("last7") as Extract<
          ReturnType<typeof resolveReportingRange>,
          { ok: true }
        >).range
      : fallback);
  return buildCollectionsTrend(data.payments, r).map((b) => ({
    label: b.label,
    amount: b.amount,
  }));
}
