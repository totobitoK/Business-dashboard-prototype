import { describe, expect, it } from "vitest";
import { parseGoogleEvent } from "./parse-event";

describe("parseGoogleEvent", () => {
  it("parses timed events with time zone", () => {
    const parsed = parseGoogleEvent({
      id: "evt1",
      summary: "Site visit",
      status: "confirmed",
      updated: "2026-03-20T12:00:00.000Z",
      start: { dateTime: "2026-03-21T15:00:00-04:00", timeZone: "America/New_York" },
      end: { dateTime: "2026-03-21T16:00:00-04:00", timeZone: "America/New_York" },
    });
    expect(parsed.allDay).toBe(false);
    expect(parsed.title).toBe("Site visit");
    expect(parsed.startsAt).toBeTruthy();
  });

  it("parses all-day events", () => {
    const parsed = parseGoogleEvent({
      id: "evt2",
      start: { date: "2026-03-22" },
      end: { date: "2026-03-23" },
    });
    expect(parsed.allDay).toBe(true);
    expect(parsed.allDayStart).toBe("2026-03-22");
    expect(parsed.allDayEnd).toBe("2026-03-23");
  });

  it("marks cancelled status", () => {
    const parsed = parseGoogleEvent({ id: "evt3", status: "cancelled" });
    expect(parsed.status).toBe("cancelled");
  });
});
