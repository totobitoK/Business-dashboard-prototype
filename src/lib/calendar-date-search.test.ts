import { describe, expect, it } from "vitest";
import {
  calendarDateMatchesSearch,
  parseFlexibleCalendarDateQuery,
} from "./calendar-date-search";

const ISO = "2026-09-19";

describe("calendar date search", () => {
  it("matches short month labels", () => {
    expect(calendarDateMatchesSearch(ISO, "Sep 19")).toBe(true);
    expect(calendarDateMatchesSearch(ISO, "sep 19, 2026")).toBe(true);
  });

  it("matches long month and ordinals", () => {
    expect(calendarDateMatchesSearch(ISO, "September 19")).toBe(true);
    expect(calendarDateMatchesSearch(ISO, "September 19th")).toBe(true);
    expect(calendarDateMatchesSearch(ISO, "September 19th, 2026")).toBe(true);
  });

  it("matches numeric slash formats", () => {
    expect(calendarDateMatchesSearch(ISO, "9/19/26")).toBe(true);
    expect(calendarDateMatchesSearch(ISO, "9/19/2026")).toBe(true);
    expect(calendarDateMatchesSearch(ISO, "9/19")).toBe(true);
  });

  it("does not match a different calendar day", () => {
    expect(calendarDateMatchesSearch(ISO, "Sep 20")).toBe(false);
    expect(calendarDateMatchesSearch(ISO, "10/1/2026")).toBe(false);
  });

  it("parses flexible query shapes", () => {
    expect(parseFlexibleCalendarDateQuery("9/19/2026")).toEqual({
      kind: "full",
      iso: ISO,
    });
    expect(parseFlexibleCalendarDateQuery("September 19th")).toEqual({
      kind: "monthDay",
      month: 9,
      day: 19,
    });
  });
});
