import { describe, expect, it } from "vitest";
import { getWorkspaceBusinessData } from "./workspace-business-data";
import { WORKSPACE_ALPINE_HVAC } from "./customer-workspaces";
import {
  sumPaymentsInPeriod,
  sumOutstandingInvoices,
  filterInvoicesBySearch,
} from "./workspace-analytics";

describe("workspace analytics", () => {
  const data = getWorkspaceBusinessData(WORKSPACE_ALPINE_HVAC)!;

  it("returns undefined for unknown workspace", () => {
    expect(getWorkspaceBusinessData("ws-unknown")).toBeUndefined();
  });

  it("sums MTD payments from fictional records", () => {
    const mtd = sumPaymentsInPeriod(data.payments, "mtd");
    expect(mtd).toBe(41250);
  });

  it("filters last7 separately from mtd", () => {
    const last7 = sumPaymentsInPeriod(data.payments, "last7");
    const mtd = sumPaymentsInPeriod(data.payments, "mtd");
    expect(last7).toBeLessThanOrEqual(mtd);
  });

  it("outstanding sums open balances only", () => {
    const open = sumOutstandingInvoices(data.invoices);
    expect(open).toBe(12840);
  });

  it("search filters by customer", () => {
    const hits = filterInvoicesBySearch(data.invoices, "Garcia");
    expect(hits.length).toBe(1);
  });
});
