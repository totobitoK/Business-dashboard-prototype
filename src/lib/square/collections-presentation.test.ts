import { describe, expect, it } from "vitest";
import {
  SQUARE_COLLECTIONS_COPY,
  buildSquareCollectionsViewModel,
  formatMinorAmount,
} from "./collections-presentation";

const synced = {
  connected: true,
  status: "connected",
  square_environment: "sandbox",
  merchant_name: "Sandbox Seller",
  reporting_date: "2026-11-06",
  reporting_timezone: "America/New_York",
  last_successful_sync_at: "2026-11-06T15:00:00Z",
  locations_confirmed: true,
  selected_location_count: 1,
};

describe("Square collections presentation", () => {
  it("keeps Square collections separate from QuickBooks and from processing fees", () => {
    expect(SQUARE_COLLECTIONS_COPY.title).toBe("Square Collections");
    expect(SQUARE_COLLECTIONS_COPY.intro).toContain("before processing fees");
    expect(SQUARE_COLLECTIONS_COPY.intro).toContain("not QuickBooks receivables");
    expect(SQUARE_COLLECTIONS_COPY.intro).toContain("not QuickBooks collections");
    expect(SQUARE_COLLECTIONS_COPY.netLabel).toBe("Net collected");
  });

  it("distinguishes a missing sync from a reporting date with no activity", () => {
    const missing = buildSquareCollectionsViewModel({
      deploymentEnvironment: "sandbox",
      status: { ...synced, last_successful_sync_at: null, currency_totals: null },
      transactions: [],
      loadError: false,
      now: new Date("2026-11-06T16:00:00Z"),
    });
    expect(missing.showTotals).toBe(false);
    expect(missing.zeroActivity).toBe(false);
    expect(missing.messages.join(" ")).toContain("No successful sync yet");

    const quiet = buildSquareCollectionsViewModel({
      deploymentEnvironment: "sandbox",
      status: { ...synced, currency_totals: [] },
      transactions: [],
      loadError: false,
      now: new Date("2026-11-06T16:00:00Z"),
    });
    expect(quiet.showTotals).toBe(true);
    expect(quiet.zeroActivity).toBe(true);
    expect(quiet.currencies).toEqual([]);
  });

  it("keeps each currency separate and subtracts only same-day completed refunds", () => {
    const model = buildSquareCollectionsViewModel({
      deploymentEnvironment: "sandbox",
      status: {
        ...synced,
        currency_totals: [
          { currency: "USD", payments_minor: 1000, refunds_minor: 250 },
          { currency: "CAD", payments_minor: "500", refunds_minor: "0" },
        ],
      },
      transactions: [
        {
          id: "1",
          kind: "payment",
          location_name: "Main",
          created_at: "2026-11-07T03:30:00Z",
          reporting_date: "2026-11-06",
          currency: "USD",
          amount_minor: 1000,
          source_type: "CARD",
        },
        {
          id: "2",
          kind: "refund",
          location_name: "Main",
          created_at: "2026-11-05T18:00:00Z",
          reporting_date: "2026-11-05",
          currency: "USD",
          amount_minor: 100,
          source_type: "CARD",
        },
      ],
      loadError: false,
      now: new Date("2026-11-06T16:00:00Z"),
    });
    expect(model.currencies).toEqual([
      { currency: "USD", paymentsMinor: 1000, refundsMinor: 250, netMinor: 750 },
      { currency: "CAD", paymentsMinor: 500, refundsMinor: 0, netMinor: 500 },
    ]);
    expect(formatMinorAmount(750, "USD")).toBe("$7.50");
    expect(formatMinorAmount(500, "CAD")).toBe("CA$5.00");
    expect(model.transactions[1]?.reportingDate).toBe("2026-11-05");
    expect(model.currencies.some((row) => row.paymentsMinor === 1500)).toBe(false);
  });

  it("hides totals when the deployment environment does not match the seller", () => {
    const hidden = buildSquareCollectionsViewModel({
      deploymentEnvironment: "production",
      status: { ...synced, currency_totals: [{ currency: "USD", payments_minor: 1000, refunds_minor: 0 }] },
      transactions: [],
      loadError: false,
    });
    expect(hidden.showTotals).toBe(false);
    expect(hidden.currencies).toEqual([]);
    expect(hidden.messages.join(" ")).toContain("hidden");
  });

  it("marks a sync older than a day as stale without turning totals into missing data", () => {
    const stale = buildSquareCollectionsViewModel({
      deploymentEnvironment: "sandbox",
      status: {
        ...synced,
        last_successful_sync_at: "2026-11-04T15:00:00Z",
        currency_totals: [{ currency: "USD", payments_minor: 100, refunds_minor: 0 }],
      },
      transactions: [],
      loadError: false,
      now: new Date("2026-11-06T16:00:00Z"),
    });
    expect(stale.stale).toBe(true);
    expect(stale.showTotals).toBe(true);
    expect(stale.messages.join(" ")).toContain("out of date");
  });
});
