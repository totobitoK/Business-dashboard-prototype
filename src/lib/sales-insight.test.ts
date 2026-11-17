import { describe, expect, it } from "vitest";
import { WORKSPACE_MERIDIAN_RETAIL } from "./customer-workspaces";
import { summarizeSalesInsight } from "./sales-insight";
import { sumPaymentsInRange } from "./workspace-analytics";
import { getWorkspaceBusinessData, type BusinessJob, type BusinessPayment } from "./workspace-business-data";
import type { ReportingDateRange } from "./workspace-reporting-period";

const range: ReportingDateRange = { start: "2026-03-01", end: "2026-03-12", preset: "custom" };
const prior: ReportingDateRange = { start: "2026-02-17", end: "2026-02-28", preset: "custom" };

function payment(partial: Partial<BusinessPayment> & Pick<BusinessPayment, "id" | "date" | "amount" | "customer">): BusinessPayment {
  return {
    customerId: partial.customer,
    sourceLabel: "Square",
    ...partial,
  };
}

describe("summarizeSalesInsight", () => {
  const payments = [
    payment({ id: "1", date: "2026-03-02", amount: 100, customer: "Oak St" }),
    payment({ id: "2", date: "2026-03-04", amount: 300, customer: "Oak St" }),
    payment({ id: "3", date: "2026-03-08", amount: 100, customer: "Plaza" }),
    payment({ id: "4", date: "2026-02-20", amount: 200, customer: "Oak St" }),
    payment({ id: "5", date: "2026-03-20", amount: 900, customer: "Future" }),
  ];
  const jobs: BusinessJob[] = [
    {
      id: "j1",
      customerId: "c",
      customer: "Oak St",
      serviceType: "Tune-up",
      category: "Maintenance",
      assignee: "A",
      scheduledDate: "2026-03-02",
      scheduledAt: "2026-03-02T09:00:00",
      amount: 250,
      completedDate: "2026-03-02",
      status: "completed",
    },
    {
      id: "j2",
      customerId: "c2",
      customer: "Plaza",
      serviceType: "Repair",
      category: "Service",
      assignee: "B",
      scheduledDate: "2026-03-08",
      scheduledAt: "2026-03-08T09:00:00",
      amount: 150,
      completedDate: "2026-03-08",
      status: "completed",
    },
  ];

  it("splits the same collected dollars by what the customer bought", () => {
    const insight = summarizeSalesInsight({ payments, jobs, range, prior });
    expect(insight).not.toBeNull();
    expect(insight!.total).toBe(500);
    expect(insight!.count).toBe(3);
    expect(insight!.average).toBeCloseTo(500 / 3);
    expect(insight!.median).toBe(100);
    expect(insight!.largest?.label).toBe("Oak St");
    expect(insight!.largest?.amount).toBe(300);
    expect(insight!.accountCount).toBe(2);
    expect(insight!.repeatAccountCount).toBe(1);
    expect(insight!.topAccounts[0]?.label).toBe("Oak St");
    expect(insight!.topAccounts[0]?.share).toBeCloseTo(0.8);
    expect(insight!.topAccounts.reduce((sum, row) => sum + row.amount, 0)).toBe(500);
    expect(insight!.mixLabel).toBe("Invoice lines");
    expect(insight!.mixTotal).toBe(500);
    expect(insight!.mix).toEqual([
      expect.objectContaining({ label: "Maintenance", amount: 400 }),
      expect.objectContaining({ label: "Service", amount: 100 }),
    ]);
    expect(insight!.compare.tone).toBe("up");
  });

  it("uses the invoice line for collected dollars instead of the job price", () => {
    const insight = summarizeSalesInsight({
      payments: [
        payment({
          id: "inv",
          date: "2026-03-04",
          amount: 300,
          customer: "Oak St",
          invoiceId: "inv-1",
        }),
      ],
      jobs,
      invoices: [
        {
          id: "inv-1",
          invoiceNumber: "INV-1",
          customerId: "Oak St",
          customer: "Oak St",
          issueDate: "2026-03-01",
          dueDate: "2026-03-20",
          amount: 900,
          balanceDue: 600,
          status: "Open",
          lineSummary: "Wholesale restock",
          sourceLabel: "Google Sheets",
        },
      ],
      range,
      prior,
    });
    expect(insight!.mixTotal).toBe(300);
    expect(insight!.mix).toEqual([
      expect.objectContaining({ label: "Wholesale restock", amount: 300, share: 1 }),
    ]);
  });

  it("keeps Meridian's sales cards equal to collections, not completed job prices", () => {
    const data = getWorkspaceBusinessData(WORKSPACE_MERIDIAN_RETAIL);
    expect(data).not.toBeNull();
    const insight = summarizeSalesInsight({
      payments: data!.payments,
      jobs: data!.jobs,
      invoices: data!.invoices,
      range,
      prior,
    });
    const collected = sumPaymentsInRange(data!.payments, range);
    expect(collected).toBeGreaterThan(0);
    expect(insight!.total).toBe(collected);
    expect(insight!.mixTotal).toBe(collected);
    expect(insight!.mix.reduce((sum, row) => sum + row.amount, 0)).toBe(collected);
    expect(insight!.topAccounts.reduce((sum, row) => sum + row.amount, 0)).toBe(collected);
    expect(insight!.average * insight!.count).toBeCloseTo(collected);
  });

  it("returns nothing when the range has no sales", () => {
    expect(
      summarizeSalesInsight({
        payments: [payment({ id: "later", date: "2026-04-01", amount: 40, customer: "Oak St" })],
        jobs: [],
        range,
        prior,
      })
    ).toBeNull();
  });
});