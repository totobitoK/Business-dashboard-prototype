import type { BusinessInvoice, BusinessJob, BusinessPayment } from "./workspace-business-data";
import {
  formatComparisonDelta,
  isDateInRange,
  isDateOnOrBeforeDemo,
  type ReportingDateRange,
} from "./workspace-reporting-period";

export type SalesSlice = {
  label: string;
  amount: number;
  count: number;
  share: number;
};

export type SalesInsight = {
  total: number;
  count: number;
  average: number;
  median: number;
  largest: SalesSlice | null;
  compare: { text: string; tone: "neutral" | "up" | "down" };
  accountCount: number;
  repeatAccountCount: number;
  topAccounts: SalesSlice[];
  topAccountShare: number;
  /** What the collected dollars paid for, or the payment source when that is unknown. */
  mixLabel: string;
  /** Always the collected total, so this card is the same money as revenue. */
  mixTotal: number;
  mix: SalesSlice[];
};

function datedInRange(date: string, range: ReportingDateRange): boolean {
  return isDateOnOrBeforeDemo(date) && isDateInRange(date, range);
}

function median(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function closedSlices(
  rows: { label: string; amount: number; count: number }[],
  total: number,
  limit: number
): SalesSlice[] {
  const sorted = rows
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
  const visible =
    sorted.length > limit
      ? [
          ...sorted.slice(0, limit - 1),
          {
            label: "Other",
            amount: sorted.slice(limit - 1).reduce((sum, row) => sum + row.amount, 0),
            count: sorted.slice(limit - 1).reduce((sum, row) => sum + row.count, 0),
          },
        ]
      : sorted;
  if (visible.length > 0) {
    const shown = visible.reduce((sum, row) => sum + row.amount, 0);
    visible[visible.length - 1]!.amount += total - shown;
  }
  return visible.map((row) => ({
    ...row,
    share: total > 0 ? row.amount / total : 0,
  }));
}

function addAmount(
  groups: Map<string, { amount: number; count: number }>,
  label: string,
  amount: number
) {
  if (amount <= 0) return;
  const row = groups.get(label) ?? { amount: 0, count: 0 };
  row.amount += amount;
  row.count += 1;
  groups.set(label, row);
}

/** Depth on the sales behind a collections total: ticket size, accounts, and what sold. */
export function summarizeSalesInsight(input: {
  payments: BusinessPayment[];
  jobs: BusinessJob[];
  invoices?: BusinessInvoice[];
  range: ReportingDateRange;
  prior: ReportingDateRange;
}): SalesInsight | null {
  const current = input.payments.filter(
    (payment) => payment.amount > 0 && datedInRange(payment.date, input.range)
  );
  if (current.length === 0) return null;

  const priorPayments = input.payments.filter(
    (payment) => payment.amount > 0 && datedInRange(payment.date, input.prior)
  );
  const total = current.reduce((sum, payment) => sum + payment.amount, 0);
  const priorTotal = priorPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const largestPayment = current.reduce((best, payment) =>
    payment.amount > best.amount ? payment : best
  );

  const byAccount = new Map<string, { amount: number; count: number }>();
  for (const payment of current) {
    const row = byAccount.get(payment.customer) ?? { amount: 0, count: 0 };
    row.amount += payment.amount;
    row.count += 1;
    byAccount.set(payment.customer, row);
  }
  const accounts = [...byAccount.entries()].map(([label, row]) => ({ label, ...row }));
  const topAccounts = closedSlices(accounts, total, 3);

  const invoiceById = new Map((input.invoices ?? []).map((invoice) => [invoice.id, invoice]));
  const jobsByCustomer = new Map<string, BusinessJob[]>();
  for (const job of input.jobs) {
    if (
      job.status !== "completed" ||
      !job.completedDate ||
      job.amount <= 0 ||
      !datedInRange(job.completedDate, input.range)
    ) {
      continue;
    }
    for (const key of new Set([job.customerId, job.customer])) {
      const list = jobsByCustomer.get(key) ?? [];
      list.push(job);
      jobsByCustomer.set(key, list);
    }
  }

  const mixGroups = new Map<string, { amount: number; count: number }>();
  let soldFromRecord = false;
  for (const payment of current) {
    const line = payment.invoiceId
      ? invoiceById.get(payment.invoiceId)?.lineSummary.trim()
      : "";
    if (line) {
      soldFromRecord = true;
      addAmount(mixGroups, line, payment.amount);
      continue;
    }
    const customerJobs =
      jobsByCustomer.get(payment.customerId) ?? jobsByCustomer.get(payment.customer) ?? [];
    const weights = new Map<string, number>();
    for (const job of customerJobs) {
      weights.set(job.category, (weights.get(job.category) ?? 0) + job.amount);
    }
    const weightRows = [...weights.entries()].filter(([, weight]) => weight > 0);
    const weightTotal = weightRows.reduce((sum, [, weight]) => sum + weight, 0);
    if (weightTotal > 0) {
      soldFromRecord = true;
      let used = 0;
      weightRows.forEach(([label, weight], index) => {
        const slice =
          index === weightRows.length - 1
            ? payment.amount - used
            : Math.round((payment.amount * weight) / weightTotal);
        if (index !== weightRows.length - 1) used += slice;
        addAmount(mixGroups, label, slice);
      });
      continue;
    }
    addAmount(mixGroups, payment.sourceLabel.trim() || "Sales", payment.amount);
  }
  const mixRows = [...mixGroups.entries()].map(([label, row]) => ({ label, ...row }));

  return {
    total,
    count: current.length,
    average: total / current.length,
    median: median(current.map((payment) => payment.amount)),
    largest: {
      label: largestPayment.customer,
      amount: largestPayment.amount,
      count: 1,
      share: total > 0 ? largestPayment.amount / total : 0,
    },
    compare: formatComparisonDelta(total, priorTotal),
    accountCount: accounts.length,
    repeatAccountCount: accounts.filter((account) => account.count > 1).length,
    topAccounts,
    topAccountShare: topAccounts.find((row) => row.label !== "Other")?.share ?? 0,
    mixLabel: soldFromRecord ? "Invoice lines" : "Payment source",
    mixTotal: total,
    mix: closedSlices(mixRows, total, 4),
  };
}
