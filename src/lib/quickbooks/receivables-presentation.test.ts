import { describe, expect, it } from "vitest";
import { RECEIVABLES_COPY, buildReceivablesViewModel } from "./receivables-presentation";

describe("receivables presentation", () => {
  it("does not label unpaid balances as revenue or collections", () => {
    expect(RECEIVABLES_COPY.openLabel).toBe("Open balance");
    expect(RECEIVABLES_COPY.overdueLabel).toBe("Overdue balance");
    expect(RECEIVABLES_COPY.openLabel.toLowerCase()).not.toMatch(/revenue|collection/);
    expect(RECEIVABLES_COPY.overdueLabel.toLowerCase()).not.toMatch(/revenue|collection/);
    expect(RECEIVABLES_COPY.intro).toContain("not revenue");
    expect(RECEIVABLES_COPY.intro).toContain("not money collected");
  });

  it("hides numbers until a successful sync and marks stale data", () => {
    const missing = buildReceivablesViewModel({
      deploymentEnvironment: "sandbox",
      status: {
        connected: true,
        status: "connected",
        intuit_environment: "sandbox",
        last_successful_sync_at: null,
        open_balance: 0,
      },
      invoices: [],
      loadError: false,
      now: new Date("2026-11-05T15:00:00Z"),
    });
    expect(missing.showBalances).toBe(false);
    expect(missing.messages.join(" ")).toContain("No successful sync yet");

    const stale = buildReceivablesViewModel({
      deploymentEnvironment: "sandbox",
      status: {
        connected: true,
        status: "connected",
        intuit_environment: "sandbox",
        company_name: "Sandbox Co",
        reporting_date: "2026-11-01",
        reporting_timezone: "America/Chicago",
        reporting_timezone_source: "configured",
        last_successful_sync_at: "2026-11-03T15:00:00Z",
        open_balance: "40.00",
        overdue_balance: "15.00",
        invoice_count: 1,
      },
      invoices: [
        {
          id: "inv-1",
          doc_number: "1001",
          customer_name: "Ada",
          due_date: "2026-10-31",
          remaining_balance: "40.00",
        },
      ],
      loadError: false,
      now: new Date("2026-11-05T15:00:00Z"),
    });
    expect(stale.showBalances).toBe(true);
    expect(stale.openBalance).toBe(40);
    expect(stale.overdueBalance).toBe(15);
    expect(stale.stale).toBe(true);
    expect(stale.invoices[0]?.overdue).toBe(true);
    expect(stale.messages.join(" ")).toContain("out of date");
  });

  it("hides balances when the deployment environment does not match the connection", () => {
    const hidden = buildReceivablesViewModel({
      deploymentEnvironment: "production",
      status: {
        connected: true,
        status: "connected",
        intuit_environment: "sandbox",
        last_successful_sync_at: "2026-11-05T12:00:00Z",
        open_balance: 40,
        overdue_balance: 10,
        reporting_date: "2026-11-05",
      },
      invoices: [],
      loadError: false,
    });
    expect(hidden.showBalances).toBe(false);
    expect(hidden.openBalance).toBeNull();
    expect(hidden.messages.join(" ")).toContain("hidden");
  });

  it("links an invoice with its QuickBooks id and keeps the original total", () => {
    const model = buildReceivablesViewModel({
      deploymentEnvironment: "sandbox",
      status: {
        connected: true,
        status: "connected",
        intuit_environment: "sandbox",
        realm_id: "9341458650768455",
        last_successful_sync_at: "2026-11-06T15:00:00Z",
        reporting_date: "2026-11-06",
        open_balance: "450.00",
        overdue_balance: "0",
        invoice_count: 2,
      },
      invoices: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          qbo_invoice_id: "16",
          doc_number: "1007",
          customer_name: "Amy",
          txn_date: "2026-10-01",
          due_date: "2026-11-06",
          total_amount: "750.00",
          remaining_balance: "450.00",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          doc_number: "1008",
          remaining_balance: "10.00",
        },
      ],
      loadError: false,
      now: new Date("2026-11-06T16:00:00Z"),
    });
    const linked = model.invoices[0];
    expect(linked?.totalAmount).toBe(750);
    expect(linked?.overdue).toBe(false);
    expect(linked?.quickBooksUrl).toBe(
      "https://sandbox.qbo.intuit.com/app/invoice?txnId=16&deeplinkcompanyid=9341458650768455"
    );
    expect(model.invoices[1]?.quickBooksUrl).toBeNull();
    expect(model.invoices[1]?.totalAmount).toBeNull();
  });
});
