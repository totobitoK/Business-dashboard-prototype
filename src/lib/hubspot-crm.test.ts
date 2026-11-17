import { describe, expect, it } from "vitest";
import { companyCalendarDay, livePipelineRead, normalizeHubSpotCrm } from "./hubspot-crm";
import { DEMO_HUBSPOT_CRM, demoPipelineRead } from "./hubspot-pipeline-sample";
import { buildPipelineView } from "./hubspot-pipeline";
import type { ReportingDateRange } from "./workspace-reporting-period";

const zone = "America/Denver";
const march: ReportingDateRange = { start: "2026-03-01", end: "2026-03-12", preset: "mtd" };

describe("normalizeHubSpotCrm", () => {
  it("classifies custom stages from pipeline metadata and keeps the company calendar day", () => {
    expect(companyCalendarDay("2026-03-14T00:00:00.000Z", zone)).toBe("2026-03-13");
    expect(companyCalendarDay("2026-03-14T18:00:00.000Z", zone)).toBe("2026-03-14");

    const read = demoPipelineRead(zone);
    const security = read.pipelines
      .find((pipeline) => pipeline.id === "81234567")
      ?.stages.find((stage) => stage.id === "1268071801");
    expect(security?.kind).toBe("open");
    expect(read.deals.find((deal) => deal.id === "1608")).toMatchObject({
      stageId: "1268071801",
      amount: 15000,
      expectedClose: null,
      owner: null,
      company: "Harbor Industrial",
      url: "https://app.hubspot.com/contacts/24490123/record/0-3/1608",
    });
    expect(read.deals.find((deal) => deal.id === "1603")?.company).toBeNull();
    expect(read.deals.find((deal) => deal.id === "1604")?.amount).toBeNull();
  });

  it("gives a live payload and the demo fixture the same deals and the same metrics", () => {
    const demo = demoPipelineRead(zone);
    const live = livePipelineRead({
      payload: DEMO_HUBSPOT_CRM,
      timeZone: zone,
      state: "ready",
      lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
      message: null,
    });
    expect(live.sampleLabel).toBeNull();
    expect(live.deals).toEqual(demo.deals);
    expect(live.pipelines).toEqual(demo.pipelines);

    const metrics = (read: typeof demo) =>
      buildPipelineView({ read, range: march, timeZone: zone });
    const demoView = metrics(demo);
    const liveView = metrics(live);
    expect(liveView.openCount).toBe(demoView.openCount);
    expect(liveView.openValue).toEqual(demoView.openValue);
    expect(liveView.wonCount).toBe(demoView.wonCount);
    expect(liveView.wonValue).toEqual(demoView.wonValue);
    expect(liveView.closingSoon.map((deal) => deal.id)).toEqual(demoView.closingSoon.map((deal) => deal.id));
    expect(demoView.missingAmountCount).toBe(1);
  });

  it("does not fill a live first sync, failure, or empty account with demo deals", () => {
    const waiting = livePipelineRead({
      payload: null,
      timeZone: zone,
      state: "pending_first_sync",
      lastSuccessfulSyncAt: null,
      message: null,
    });
    expect(waiting.deals).toEqual([]);
    expect(waiting.sampleLabel).toBeNull();

    const empty = normalizeHubSpotCrm({
      payload: { ...DEMO_HUBSPOT_CRM, deals: [] },
      timeZone: zone,
      state: "verified_empty",
      sampleLabel: null,
      lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
      message: null,
    });
    const view = buildPipelineView({ read: empty, range: march, timeZone: zone, pipelineId: "default" });
    expect(view.showFigures).toBe(true);
    expect(view.openCount).toBe(0);
    expect(view.stageRows.map((row) => row.id)).toEqual([
      "default:appointmentscheduled",
      "default:presentationscheduled",
    ]);
  });
});
