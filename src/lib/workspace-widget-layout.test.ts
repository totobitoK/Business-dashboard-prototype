import { describe, expect, it } from "vitest";
import { normalizeLayoutSettings } from "./workspace-widget-layout";

describe("workspace widget layout", () => {
  it("drops Needs Attention from a saved layout and keeps the other preferences", () => {
    const settings = normalizeLayoutSettings({
      themeId: "forest",
      showCompactMetrics: true,
      widgetOrder: ["invoices", "needs_attention", "metrics", "collections_chart"],
      hiddenWidgets: ["job_activity", "needs_attention"],
      overviewKpiOrder: ["payments_collected", "outstanding_balance"],
      overviewHiddenKpis: ["jobs_completed"],
    });

    expect(settings.widgetOrder).not.toContain("needs_attention");
    expect(settings.hiddenWidgets).toEqual(["job_activity"]);
    expect(settings.widgetOrder.slice(0, 3)).toEqual([
      "invoices",
      "metrics",
      "collections_chart",
    ]);
    expect(settings.themeId).toBe("forest");
    expect(settings.showCompactMetrics).toBe(true);
    expect(settings.overviewKpiOrder[0]).toBe("payments_collected");
    expect(settings.overviewHiddenKpis).toContain("jobs_completed");
  });
});
