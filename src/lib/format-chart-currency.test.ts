import { describe, expect, it } from "vitest";
import { chartYAxisMax, chartYAxisTicks, formatDashboardMoney } from "./format-chart-currency";

describe("chartYAxisTicks", () => {
  it("uses even thousands when the peak is near $3,000", () => {
    expect(chartYAxisTicks(2800)).toEqual([1000, 2000, 3000]);
    expect(chartYAxisMax(2800)).toBe(3000);
  });

  it("raises the steps when the peak passes that ceiling", () => {
    expect(chartYAxisTicks(3350)).toEqual([1500, 3000, 4500]);
    expect(chartYAxisMax(3350)).toBe(4500);
  });

  it("uses two labels on the revenue chart", () => {
    expect(chartYAxisTicks(2800, 2)).toEqual([1500, 3000]);
    expect(chartYAxisMax(2800, 2)).toBe(3000);
    expect(chartYAxisTicks(3350, 2)).toEqual([2000, 4000]);
  });

  it("keeps cents on live amounts and whole dollars on round amounts", () => {
    expect(formatDashboardMoney(10.1)).toBe("$10.10");
    expect(formatDashboardMoney(5281.52)).toBe("$5,281.52");
    expect(formatDashboardMoney(12889)).toBe("$12,889");
  });

  it("uses sensible steps for smaller peaks", () => {
    expect(chartYAxisTicks(850)).toEqual([300, 600, 900]);
    expect(chartYAxisMax(850)).toBe(900);
    expect(chartYAxisTicks(0)).toEqual([100, 200, 300]);
  });
});
