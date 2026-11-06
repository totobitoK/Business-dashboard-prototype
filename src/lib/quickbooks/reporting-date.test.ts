import { afterEach, describe, expect, it } from "vitest";
import { reportingDateInTimeZone, selectReportingTimeZone } from "./reporting-date";

describe("company reporting dates", () => {
  const previous = process.env.QUICKBOOKS_REPORTING_TIMEZONE;

  afterEach(() => {
    if (previous === undefined) delete process.env.QUICKBOOKS_REPORTING_TIMEZONE;
    else process.env.QUICKBOOKS_REPORTING_TIMEZONE = previous;
  });

  it("uses the company date across Eastern midnight", () => {
    expect(reportingDateInTimeZone("America/New_York", new Date("2026-11-07T04:30:00Z"))).toBe(
      "2026-11-06"
    );
    expect(reportingDateInTimeZone("America/New_York", new Date("2026-11-07T05:00:00Z"))).toBe(
      "2026-11-07"
    );
    expect(reportingDateInTimeZone("Not/AZone", new Date("2026-11-07T04:30:00Z"))).toBe("2026-11-06");
  });

  it("keeps the company time zone unless this deployment overrides it", () => {
    expect(selectReportingTimeZone("America/Chicago", null)).toBe("America/Chicago");
    expect(selectReportingTimeZone(null, null)).toBe("America/New_York");
    expect(selectReportingTimeZone("Not/AZone", null)).toBe("America/New_York");
    expect(selectReportingTimeZone("America/Chicago", "America/Denver")).toBe("America/Denver");
    delete process.env.QUICKBOOKS_REPORTING_TIMEZONE;
    expect(selectReportingTimeZone("America/Chicago")).toBe("America/Chicago");
  });
});
