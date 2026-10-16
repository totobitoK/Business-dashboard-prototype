import { describe, expect, it } from "vitest";
import { formatAppointmentWhen } from "./format-appointment";

describe("formatAppointmentWhen", () => {
  it("formats all-day events from calendar dates (not UTC midnight local shift)", () => {
    const text = formatAppointmentWhen({
      startsAt: null,
      endsAt: null,
      allDay: true,
      allDayStart: "2026-03-10",
      allDayEnd: "2026-03-11",
      timezone: null,
    });
    expect(text).toContain("Mar");
    expect(text).toContain("10");
    expect(text).not.toContain("12:00");
  });

  it("formats multi-day all-day spans", () => {
    const text = formatAppointmentWhen({
      startsAt: null,
      endsAt: null,
      allDay: true,
      allDayStart: "2026-03-10",
      allDayEnd: "2026-03-13",
      timezone: null,
    });
    expect(text).toContain("–");
    expect(text).toContain("12");
  });

  it("formats timed events using event timezone for date and clock", () => {
    const text = formatAppointmentWhen({
      startsAt: "2026-03-08T14:30:00.000Z",
      endsAt: "2026-03-08T15:30:00.000Z",
      allDay: false,
      timezone: "America/New_York",
    });
    expect(text).toContain("Mar");
    expect(text).toMatch(/9:30|10:30/);
    expect(text).not.toContain("America/New_York");
  });
});
