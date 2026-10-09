import { describe, expect, it } from "vitest";
import { DEMO_AS_OF_DATE } from "./workspace-business-data";
import {
  addCalendarDays,
  daysBetweenInclusive,
  formatComparisonDelta,
  isDateInRange,
  mtdComparisonRange,
  resolveReportingRange,
} from "./workspace-reporting-period";

describe("workspace reporting period", () => {
  it("last 7 days is exactly seven calendar dates including as-of", () => {
    const r = resolveReportingRange("last7");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.start).toBe("2026-03-06");
    expect(r.range.end).toBe(DEMO_AS_OF_DATE);
    expect(daysBetweenInclusive(r.range.start, r.range.end)).toBe(7);
  });

  it("last 30 days spans 30 inclusive days", () => {
    const r = resolveReportingRange("last30");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(daysBetweenInclusive(r.range.start, r.range.end)).toBe(30);
  });

  it("previous month handles year boundary", () => {
    const r = resolveReportingRange("prev_month");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.start).toBe("2026-02-01");
    expect(r.range.end).toBe("2026-02-28");
  });

  it("rejects custom range when start after end", () => {
    const r = resolveReportingRange("custom", "2026-03-10", "2026-03-01");
    expect(r.ok).toBe(false);
  });

  it("rejects custom end beyond demo as-of", () => {
    const r = resolveReportingRange("custom", "2026-03-01", "2026-03-20");
    expect(r.ok).toBe(false);
  });

  it("MTD comparison uses prior month elapsed days", () => {
    const cmp = mtdComparisonRange(DEMO_AS_OF_DATE);
    expect(cmp.start).toBe("2026-02-01");
    expect(cmp.end).toBe("2026-02-12");
  });

  it("excludes dates outside inclusive range", () => {
    const r = resolveReportingRange("last7");
    if (!r.ok) return;
    expect(isDateInRange("2026-03-05", r.range)).toBe(false);
    expect(isDateInRange("2026-03-06", r.range)).toBe(true);
  });

  it("handles zero comparison baseline copy", () => {
    expect(formatComparisonDelta(100, 0).text).toMatch(/No comparison baseline/);
    expect(formatComparisonDelta(0, 0).text).toMatch(/Flat/);
  });

  it("addCalendarDays crosses month boundary", () => {
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
