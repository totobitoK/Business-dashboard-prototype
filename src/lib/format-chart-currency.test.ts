import { describe, expect, it } from "vitest";
import { chartYAxisMax } from "./format-chart-currency";

describe("chartYAxisMax", () => {
  it("rounds up thousands for large peaks", () => {
    expect(chartYAxisMax(3350)).toBe(4000);
  });

  it("uses sensible steps for smaller peaks", () => {
    expect(chartYAxisMax(850)).toBe(900);
    expect(chartYAxisMax(0)).toBe(1000);
  });
});
