import { describe, expect, it } from "vitest";
import { SAMPLE_PIPELINE_READ } from "./hubspot-pipeline-sample";
import { buildPipelineView, type PipelineRead } from "./hubspot-pipeline";
import type { ReportingDateRange } from "./workspace-reporting-period";

const march: ReportingDateRange = { start: "2026-03-01", end: "2026-03-12", preset: "mtd" };
const lateMarch: ReportingDateRange = { start: "2026-03-10", end: "2026-03-12", preset: "custom" };
const zone = "America/Denver";

function view(range: ReportingDateRange, pipelineId?: string | null, read: PipelineRead = SAMPLE_PIPELINE_READ) {
  return buildPipelineView({ read, range, timeZone: zone, pipelineId });
}

describe("buildPipelineView", () => {
  it("keeps open pipeline as a snapshot and won deals inside the reporting period", () => {
    const full = view(march);
    const narrow = view(lateMarch);
    expect(full.openCount).toBe(5);
    expect(full.missingAmountCount).toBe(1);
    expect(full.openValue).toEqual([
      { currency: "EUR", amount: 5000, dealCount: 1 },
      { currency: "USD", amount: 35400, dealCount: 3 },
    ]);
    expect(full.closingSoon.map((deal) => deal.name)).toEqual([
      "Lumen kiosk",
      "Unpriced renewal",
    ]);
    expect(full.wonCount).toBe(3);
    expect(full.wonMissingAmountCount).toBe(1);
    expect(full.wonValue).toEqual([{ currency: "USD", amount: 7054, dealCount: 2 }]);
    expect(full.stageRows.map((row) => row.label)).toContain("Enterprise · Security review");
    expect(full.deals.find((deal) => deal.name === "Euro pop-up")?.company).toBeNull();
    expect(full.deals.find((deal) => deal.name === "Harbor security review")?.owner).toBeNull();
    expect(full.deals.find((deal) => deal.name === "Harbor security review")?.date).toBeNull();

    expect(narrow.openCount).toBe(full.openCount);
    expect(narrow.openValue).toEqual(full.openValue);
    expect(narrow.wonCount).toBe(1);
    expect(narrow.wonValue).toEqual([{ currency: "USD", amount: 4000, dealCount: 1 }]);
    expect(narrow.deals.map((deal) => deal.name)).not.toContain("February booth");
    expect(narrow.deals.map((deal) => deal.name)).not.toContain("Lost lead");
  });

  it("uses the selected pipeline's own stages", () => {
    const sales = view(march, "default");
    expect(sales.openCount).toBe(4);
    expect(sales.openValue).toEqual([
      { currency: "EUR", amount: 5000, dealCount: 1 },
      { currency: "USD", amount: 20400, dealCount: 2 },
    ]);
    expect(sales.stageRows.map((row) => row.label)).toEqual([
      "Appointment Scheduled",
      "Presentation Scheduled",
    ]);
    expect(sales.wonCount).toBe(2);
    expect(sales.wonValue).toEqual([{ currency: "USD", amount: 3054, dealCount: 1 }]);
    expect(sales.deals.find((deal) => deal.name === "Lumen kiosk")?.dateLabel).toBe("Expected close");
    expect(sales.deals.find((deal) => deal.name === "March wholesale")?.dateLabel).toBe("Close date");
  });

  it("separates first sync, failure, stale data, and an empty pipeline", () => {
    const waiting = view(march, null, {
      ...SAMPLE_PIPELINE_READ,
      state: "pending_first_sync",
      deals: [],
      sampleLabel: null,
      lastSuccessfulSyncAt: null,
    });
    expect(waiting.showFigures).toBe(false);
    expect(waiting.openCount).toBe(0);
    expect(waiting.message).toMatch(/first HubSpot sync/);

    const failed = view(march, null, {
      ...SAMPLE_PIPELINE_READ,
      state: "failed",
      message: "HubSpot returned an error.",
      lastSuccessfulSyncAt: "2026-03-01T15:00:00.000Z",
    });
    expect(failed.showFigures).toBe(false);
    expect(failed.message).toBe("HubSpot returned an error.");
    expect(failed.syncLabel).toBeTruthy();

    const stale = view(march, null, {
      ...SAMPLE_PIPELINE_READ,
      state: "stale",
      message: null,
    });
    expect(stale.showFigures).toBe(true);
    expect(stale.openCount).toBe(5);
    expect(stale.message).toMatch(/stale/);

    const empty = view(march, "default", {
      ...SAMPLE_PIPELINE_READ,
      state: "verified_empty",
      deals: [],
    });
    expect(empty.showFigures).toBe(true);
    expect(empty.openCount).toBe(0);
    expect(empty.stageRows.map((row) => row.label)).toEqual([
      "Appointment Scheduled",
      "Presentation Scheduled",
    ]);
    expect(empty.message).toMatch(/no deals/i);
  });
});
