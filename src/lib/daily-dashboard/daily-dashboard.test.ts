import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emptyLiveSnapshot } from "./types";
import { describeLiveFigures, liveBusinessData } from "./live-figures";
import { describe, expect, it } from "vitest";
import { WORKSPACE_ALPINE_HVAC } from "@/lib/customer-workspaces";
import { classifyCalendar, classifyQuickBooks, classifySquare } from "./connector-state";
import { resolveDashboardPeriod, summarizeCollectionsPeriod } from "./collections-period";
import { buildDemoDailySnapshot } from "./demo-snapshot";
import { resolveDailyTheme } from "./theme";
import type { SquareTransactionRow } from "@/lib/square/collections-presentation";

describe("daily dashboard themes", () => {
  it("maps saved appearance ids onto the three client themes", () => {
    expect(resolveDailyTheme("purple").name).toBe("RavenView Indigo");
    expect(resolveDailyTheme("forest").name).toBe("Evergreen Slate");
    expect(resolveDailyTheme("ocean").name).toBe("Porcelain");
    expect(resolveDailyTheme("missing").id).toBe("purple");
  });
});

describe("daily dashboard connector states", () => {
  const readyBooks = {
    loadError: false,
    deploymentConfigured: true,
    connected: true,
    environmentMismatch: false,
    connectionStatus: "connected",
    hasSuccessfulSync: true,
    showBalances: true,
    stale: false,
    openBalance: 40,
    visibleInvoiceCount: 1,
  };

  it("keeps a failed read, a disconnect, and an empty successful read apart", () => {
    expect(classifyQuickBooks({ ...readyBooks, loadError: true, showBalances: false })).toBe(
      "load_error"
    );
    expect(
      classifyQuickBooks({ ...readyBooks, connected: false, showBalances: false, hasSuccessfulSync: false })
    ).toBe("disconnected");
    expect(
      classifyQuickBooks({ ...readyBooks, openBalance: 0, visibleInvoiceCount: 0 })
    ).toBe("verified_empty");
    expect(classifyQuickBooks({ ...readyBooks, stale: true })).toBe("stale");
    expect(
      classifyQuickBooks({ ...readyBooks, deploymentConfigured: false, showBalances: false })
    ).toBe("unavailable");
    expect(classifyQuickBooks({ ...readyBooks, connectionStatus: "reconnect_required" })).toBe(
      "reconnect_required"
    );
    expect(
      classifySquare({
        loadError: false,
        deploymentConfigured: true,
        connected: true,
        environmentMismatch: false,
        locationsReady: false,
        connectionStatus: "connected",
        hasSuccessfulSync: false,
        showTotals: false,
        stale: false,
        zeroActivity: false,
        transactionCount: 0,
      })
    ).toBe("setup_incomplete");
    expect(
      classifyCalendar({
        loadError: false,
        deploymentConfigured: true,
        connected: true,
        connectionStatus: "connected",
        selectedCalendarCount: 1,
        appointmentCount: 0,
      })
    ).toBe("verified_empty");
  });
});

describe("collections reporting period", () => {
  it("changes totals, chart, and transactions from the same rows", () => {
    const snapshot = buildDemoDailySnapshot({
      workspaceId: WORKSPACE_ALPINE_HVAC,
      companyName: "Alpine Comfort HVAC",
    });
    expect(snapshot.sampleLabel).toBe("Alpine HVAC sample");
    expect(snapshot.source).toBe("demo");

    const week = resolveDashboardPeriod(snapshot.asOfDate, "last7");
    const day = resolveDashboardPeriod(snapshot.asOfDate, "day");
    const weekSummary = summarizeCollectionsPeriod({
      transactions: snapshot.collections.transactions,
      range: week,
      authoritativeDay: snapshot.collections.authoritativeDay,
      loadedCap: snapshot.collections.loadedCap,
    });
    const daySummary = summarizeCollectionsPeriod({
      transactions: snapshot.collections.transactions,
      range: day,
      authoritativeDay: snapshot.collections.authoritativeDay,
      loadedCap: snapshot.collections.loadedCap,
    });

    expect(weekSummary.currencies[0]).toMatchObject({
      currency: "USD",
      paymentsMinor: 89000,
      refundsMinor: 3500,
      netMinor: 85500,
    });
    expect(weekSummary.transactions).toHaveLength(9);
    expect(weekSummary.showChart).toBe(true);
    expect(weekSummary.trend.reduce((sum, bucket) => sum + bucket.amount, 0)).toBeCloseTo(855);

    expect(daySummary.authoritative).toBe(true);
    expect(daySummary.totalsExceedList).toBe(false);
    expect(daySummary.currencies[0]?.netMinor).toBe(16500);
    expect(daySummary.transactions).toHaveLength(2);
    expect(daySummary.showChart).toBe(false);
    expect(daySummary.transactions.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(19500);
  });

  it("does not treat a capped read that misses the start of the range as zero", () => {
    const rows: SquareTransactionRow[] = [
      {
        id: "1",
        kind: "payment",
        locationName: "Main",
        createdAt: "2026-11-06T15:00:00Z",
        reportingDate: "2026-11-06",
        currency: "USD",
        amountMinor: 500,
        sourceType: "CARD",
      },
    ];
    const summary = summarizeCollectionsPeriod({
      transactions: rows,
      range: { start: "2026-11-01", end: "2026-11-06" },
      authoritativeDay: null,
      loadedCap: 1,
    });
    expect(summary.partial).toBe(true);
    expect(summary.verifiedEmpty).toBe(false);
    expect(summary.currencies[0]?.paymentsMinor).toBe(500);
  });
});

describe("live dashboard company selection", () => {
  it("uses membership and does not read a demo workspace parameter", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/daily-dashboard/load-live-dashboard.ts"),
      "utf8"
    );
    expect(src).toContain("companyIds[0]");
    expect(src).not.toContain("searchParams");
    expect(src).not.toMatch(/workspace/i);
  });
});

describe("live figures in the restored sections", () => {
  it("hides unsupported metrics and does not invent a zero from a disconnected read", () => {
    const snapshot = emptyLiveSnapshot("Acme Heating", "2026-11-11");
    const figures = describeLiveFigures(snapshot, {
      start: "2026-11-05",
      end: "2026-11-11",
    });
    const data = liveBusinessData(snapshot);

    expect(figures.paymentsAmount).toBeNull();
    expect(figures.paymentsMessage).toBeTruthy();
    expect(figures.revenueMessage).toMatch(/revenue/i);
    expect(figures.pipelineMessage).toMatch(/pipeline/i);
    expect(figures.jobsMessage).toMatch(/job/i);
    expect(figures.receivablesMessage).toBeTruthy();
    expect(data.jobs).toEqual([]);
    expect(data.payments).toEqual([]);
    expect(data.invoices).toEqual([]);
    expect(data.workspaceId).toBe("live-company");
  });

  it("shows a zero only after a successful empty collections read", () => {
    const snapshot = emptyLiveSnapshot("Acme Heating", "2026-11-11");
    snapshot.collections = {
      ...snapshot.collections,
      state: "verified_empty",
      messages: [],
      showTotals: true,
      authoritativeDay: {
        date: "2026-11-11",
        currencies: [{ currency: "USD", paymentsMinor: 0, refundsMinor: 0, netMinor: 0 }],
      },
      transactions: [],
      loadedCap: 40,
    };
    const figures = describeLiveFigures(snapshot, {
      start: "2026-11-11",
      end: "2026-11-11",
    });
    expect(figures.paymentsMessage).toBeNull();
    expect(figures.paymentsAmount).toBe(0);
    expect(figures.revenueMessage).toMatch(/revenue/i);
  });
});
