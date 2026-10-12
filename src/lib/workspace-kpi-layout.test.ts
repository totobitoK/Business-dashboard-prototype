import { describe, expect, it } from "vitest";
import {
  normalizeOverviewKpiLayout,
  toggleKpiHidden,
  visibleKpiIds,
} from "./workspace-kpi-layout";

describe("workspace kpi layout", () => {
  it("keeps at least one overview KPI visible", () => {
    const { order, hidden } = normalizeOverviewKpiLayout({
      overviewKpiOrder: ["payments_collected", "jobs_completed"],
      overviewHiddenKpis: ["payments_collected"],
    });
    expect(visibleKpiIds(order, hidden).length).toBeGreaterThanOrEqual(1);
  });

  it("does not hide the last visible KPI", () => {
    const order = ["payments_collected", "jobs_completed"] as const;
    const hidden = toggleKpiHidden([...order], ["jobs_completed"], "payments_collected");
    expect(visibleKpiIds(order, hidden)).toEqual(["payments_collected"]);
  });
});
