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
});
