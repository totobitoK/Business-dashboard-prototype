import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { emptyLiveSnapshot } from "./daily-dashboard/types";
import {
  composeCustomerDashboard,
  connectedToolsFromClient,
  connectedToolsFromSnapshot,
  visibleAllowedIds,
  visibleDashboardSection,
} from "./dashboard-composition";
import type { Client, GuidedConnection } from "./types";

function connection(label: string, demoStatus: GuidedConnection["demoStatus"]): GuidedConnection {
  return { id: label, label, demoStatus };
}

describe("composeCustomerDashboard", () => {
  it("asks them to connect a source when nothing defines a block", () => {
    for (const connected of [[], ["google-sheets"], ["excel-csv"], ["google-ads"], ["meta-ads"], ["other"]] as const) {
      const layout = composeCustomerDashboard({ connected: [...connected] });
      expect(layout.promptToConnect).toBe(true);
      expect(layout.overviewKpis).toEqual([]);
      expect(layout.widgets).toEqual([]);
      expect(layout.sales).toBe(false);
      expect(layout.service).toBe(false);
      expect(layout.sections).toEqual(["overview"]);
    }
  });

  it("builds the money dashboard from QuickBooks and Square", () => {
    const layout = composeCustomerDashboard({ connected: ["quickbooks", "square"] });
    expect(layout.overviewKpis).toEqual([
      "payments_collected",
      "outstanding_balance",
      "overdue_balance",
    ]);
    expect(layout.revenueKpis).toEqual(["overdue_ar"]);
    expect(layout.widgets).toEqual(["metrics", "collections_chart", "invoices"]);
    expect(layout.sections).toEqual(["overview"]);
    expect(layout.salesBlocks).toEqual([]);
    expect(layout.promptToConnect).toBe(false);
  });

  it("treats Stripe like Square for payments", () => {
    const layout = composeCustomerDashboard({ connected: ["stripe"] });
    expect(layout.overviewKpis).toEqual(["payments_collected"]);
    expect(layout.widgets).toEqual(["metrics", "collections_chart"]);
    expect(layout.sections).toEqual(["overview"]);
  });

  it("adds weekly and monthly revenue only when paid invoices count as revenue", () => {
    const without = composeCustomerDashboard({ connected: ["quickbooks"] });
    expect(without.revenueKpis).toEqual(["overdue_ar"]);
    expect(without.sections).not.toContain("revenue");

    const withRevenue = composeCustomerDashboard({
      connected: ["quickbooks"],
      quickBooksCountsPaidInvoicesAsRevenue: true,
    });
    expect(withRevenue.revenueKpis).toEqual([
      "weekly_revenue",
      "monthly_revenue",
      "overdue_ar",
    ]);
    expect(withRevenue.sections).toEqual(["overview", "revenue"]);
    expect(withRevenue.widgets).toEqual(["metrics", "invoices"]);
  });

  it("builds the operations dashboard from Jobber", () => {
    const layout = composeCustomerDashboard({ connected: ["jobber"] });
    expect(layout.service).toBe(true);
    expect(layout.sales).toBe(false);
    expect(layout.overviewKpis).toEqual(["jobs_completed"]);
    expect(layout.widgets).toEqual(["metrics", "job_activity", "appointments"]);
    expect(layout.sections).toEqual(["overview", "schedule"]);
    expect(layout.revenueKpis).toEqual([]);
  });

  it("keeps Google Calendar on the schedule and off completed jobs", () => {
    const layout = composeCustomerDashboard({ connected: ["google-calendar"] });
    expect(layout.service).toBe(false);
    expect(layout.overviewKpis).toEqual([]);
    expect(layout.widgets).toEqual(["appointments"]);
    expect(layout.sections).toEqual(["overview", "schedule"]);
  });

  it("builds a sales dashboard from HubSpot without invoices or collections", () => {
    const layout = composeCustomerDashboard({ connected: ["hubspot"] });
    expect(layout.sales).toBe(true);
    expect(layout.service).toBe(false);
    expect(layout.salesBlocks).toEqual([
      "month_pipeline",
      "open_pipeline",
      "deals_won_this_month",
      "weighted_pipeline",
    ]);
    expect(layout.overviewKpis).toEqual([]);
    expect(layout.widgets).toEqual([]);
    expect(layout.sections).toEqual(["overview", "revenue"]);
    expect(layout.promptToConnect).toBe(false);
  });

  it("puts QuickBooks money and HubSpot pipeline on one screen", () => {
    const layout = composeCustomerDashboard({ connected: ["quickbooks", "hubspot"] });
    expect(layout.overviewKpis).toEqual(["outstanding_balance", "overdue_balance"]);
    expect(layout.sales).toBe(true);
    expect(layout.widgets).toEqual(["metrics", "invoices"]);
    expect(layout.sections).toEqual(["overview", "revenue"]);
    expect(layout.widgets).not.toContain("collections_chart");
  });
});

describe("connected sources", () => {
  it("ignores sources that are selected but not connected", () => {
    const client = {
      guidedConnections: [
        connection("HubSpot", "not-started"),
        connection("Google Sheets", "awaiting-authorization"),
        connection("QuickBooks Online", "authorized"),
        connection("Google Calendar", "data-validated"),
        connection("Jobber", "needs-attention"),
        connection("Square", "syncing"),
      ],
    } as Client;
    expect(connectedToolsFromClient(client)).toEqual([
      "quickbooks",
      "google-calendar",
      "jobber",
      "square",
    ]);
  });

  it("returns null when the screen has no client", () => {
    expect(connectedToolsFromClient(undefined)).toBeNull();
  });

  it("reads Alpine as QuickBooks and Google Calendar", () => {
    const alpine = demoClients.find((client) => client.id === "client-8");
    expect(connectedToolsFromClient(alpine)).toEqual(["quickbooks", "google-calendar"]);
    const layout = composeCustomerDashboard({
      connected: connectedToolsFromClient(alpine) ?? [],
    });
    expect(layout.widgets).toEqual(["metrics", "appointments", "invoices"]);
    expect(layout.sections).toEqual(["overview", "schedule"]);
    expect(layout.overviewKpis).not.toContain("payments_collected");
    expect(layout.overviewKpis).not.toContain("jobs_completed");
  });

  it("leaves Meridian on the connect prompt until HubSpot is connected", () => {
    const meridian = demoClients.find((client) => client.id === "client-9");
    const connected = connectedToolsFromClient(meridian) ?? [];
    expect(composeCustomerDashboard({ connected }).promptToConnect).toBe(true);
  });

  it("drops a live connector that is disconnected or unavailable", () => {
    const snapshot = emptyLiveSnapshot("Acme Heating", "2026-11-11");
    snapshot.connectors = [
      {
        id: "quickbooks",
        label: "QuickBooks",
        state: "ready",
        detail: "",
        lastSuccessfulSyncAt: null,
      },
      {
        id: "square",
        label: "Square",
        state: "disconnected",
        detail: "",
        lastSuccessfulSyncAt: null,
      },
      {
        id: "google-calendar",
        label: "Google Calendar",
        state: "unavailable",
        detail: "",
        lastSuccessfulSyncAt: null,
      },
    ];
    expect(connectedToolsFromSnapshot(snapshot)).toEqual(["quickbooks"]);
  });
});

describe("visible dashboard section", () => {
  it("sends a missing Revenue or Schedule request back to Overview", () => {
    const layout = composeCustomerDashboard({ connected: ["quickbooks", "square"] });
    expect(visibleDashboardSection("revenue", layout)).toBe("overview");
    expect(visibleDashboardSection("schedule", layout)).toBe("overview");
    expect(visibleDashboardSection("overview", layout)).toBe("overview");
    expect(visibleDashboardSection("schedule", null)).toBe("schedule");
  });

  it("keeps a hidden saved card from removing the last allowed card", () => {
    expect(
      visibleAllowedIds(
        ["payments_collected", "jobs_completed", "outstanding_balance", "overdue_balance"],
        ["outstanding_balance", "overdue_balance"],
        ["outstanding_balance", "overdue_balance"]
      )
    ).toEqual(["outstanding_balance", "overdue_balance"]);
  });
});
