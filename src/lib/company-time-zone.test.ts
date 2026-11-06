import { describe, expect, it } from "vitest";
import { companyTimeZoneLabel, timeZoneForNewCompany } from "./company-time-zone";

describe("company time zone", () => {
  it("uses Eastern when a new company has no address", () => {
    expect(timeZoneForNewCompany(null)).toEqual({
      timeZone: "America/New_York",
      source: "eastern_default",
    });
    expect(timeZoneForNewCompany({ country: "US" })).toEqual({
      timeZone: "America/New_York",
      source: "eastern_default",
    });
  });

  it("uses the state on a new company address", () => {
    expect(timeZoneForNewCompany({ country: "United States", region: "ny" })).toEqual({
      timeZone: "America/New_York",
      source: "address",
    });
    expect(timeZoneForNewCompany({ country: "US", region: "CA" })).toEqual({
      timeZone: "America/Los_Angeles",
      source: "address",
    });
    expect(timeZoneForNewCompany({ country: "Canada", region: "BC" })).toEqual({
      timeZone: "America/Vancouver",
      source: "address",
    });
  });

  it("labels the Eastern zone without the IANA name", () => {
    expect(companyTimeZoneLabel("America/New_York")).toBe("Eastern");
    expect(companyTimeZoneLabel(null)).toBe("Eastern");
    expect(companyTimeZoneLabel("America/Chicago")).toBe("America/Chicago");
  });
});
