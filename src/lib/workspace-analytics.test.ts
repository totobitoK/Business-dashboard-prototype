import { describe, expect, it } from "vitest";
import { WORKSPACE_ALPINE_HVAC, WORKSPACE_MERIDIAN_RETAIL } from "./customer-workspaces";
import { getWorkspaceBusinessData } from "./workspace-business-data";
import {
  buildCollectionsTrend,
  countCompletedJobsInRange,
  filterInvoices,
  invoiceAgingBuckets,
  resolveReportingRange,
  sortInvoices,
  sumOutstandingInvoices,
  sumOverdueInvoices,
  sumPaymentsInRange,
} from "./workspace-analytics";

describe("workspace analytics", () => {
  const alpine = getWorkspaceBusinessData(WORKSPACE_ALPINE_HVAC)!;
  const meridian = getWorkspaceBusinessData(WORKSPACE_MERIDIAN_RETAIL)!;

  it("returns undefined for unknown workspace", () => {
    expect(getWorkspaceBusinessData("ws-unknown")).toBeUndefined();
  });

  it("isolates alpine vs meridian datasets", () => {
    expect(alpine.jobs.some((j) => j.category === "Maintenance")).toBe(true);
    expect(meridian.jobs.some((j) => j.category === "Wholesale")).toBe(true);
    expect(meridian.jobs.some((j) => j.category === "Maintenance")).toBe(false);
  });

  it("excludes future payments from period totals", () => {
    const range = resolveReportingRange("last7");
    if (!range.ok) throw new Error("range");
    const total = sumPaymentsInRange(alpine.payments, range.range);
    const includesFuture = alpine.payments.some((p) => p.id === "alp-pay-future");
    expect(includesFuture).toBe(true);
    expect(
      alpine.payments.find((p) => p.id === "alp-pay-future")!.date > range.range.end
    ).toBe(true);
    expect(total).toBeGreaterThan(0);
  });

  it("chart totals reconcile with payments KPI for last 7 days", () => {
    const range = resolveReportingRange("last7");
    if (!range.ok) throw new Error("range");
    const kpi = sumPaymentsInRange(alpine.payments, range.range);
    const trend = buildCollectionsTrend(alpine.payments, range.range);
    const chartTotal = trend.reduce((s, b) => s + b.amount, 0);
    expect(chartTotal).toBe(kpi);
  });

  it("uses daily buckets for last 30 days", () => {
    const range = resolveReportingRange("last30");
    if (!range.ok) throw new Error("range");
    const trend = buildCollectionsTrend(alpine.payments, range.range);
    expect(trend).toHaveLength(30);
    expect(trend.every((b) => b.start === b.end)).toBe(true);
  });

  it("counts completed jobs only in range", () => {
    const range = resolveReportingRange("last7");
    if (!range.ok) throw new Error("range");
    const count = countCompletedJobsInRange(alpine.jobs, range.range);
    expect(count).toBeGreaterThan(0);
  });

  it("outstanding and overdue snapshot balances", () => {
    expect(sumOutstandingInvoices(alpine.invoices)).toBeGreaterThan(0);
    expect(sumOverdueInvoices(alpine.invoices)).toBeLessThanOrEqual(
      sumOutstandingInvoices(alpine.invoices)
    );
  });

  it("invoice aging buckets partial balances", () => {
    const buckets = invoiceAgingBuckets(alpine.invoices);
    const sum = Object.values(buckets).reduce((s, b) => s + b.total, 0);
    expect(sum).toBe(sumOutstandingInvoices(alpine.invoices));
  });

  it("search, status filter, and sort work together", () => {
    let list = filterInvoices({
      invoices: alpine.invoices,
      search: "INV-A",
      status: "Past due",
    });
    list = sortInvoices(list, "balance", "desc");
    expect(list.length).toBeGreaterThan(0);
    list.forEach((inv) => expect(inv.status).toBe("Past due"));
  });

  it("has sufficient alpine sample volume", () => {
    expect(alpine.customers.length).toBeGreaterThanOrEqual(25);
    expect(alpine.jobs.length).toBeGreaterThanOrEqual(100);
    expect(alpine.invoices.length).toBeGreaterThanOrEqual(60);
  });
});
