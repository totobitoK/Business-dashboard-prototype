import { describe, expect, it } from "vitest";
import {
  appointmentAsScheduleVisit,
  companyCalendarDay,
  liveJobberRead,
  normalizeJobberVisits,
  reconcileVisitWindow,
  upcomingVisits,
  unscheduledVisits,
} from "./jobber-visits";
import { DEMO_JOBBER_VISITS, demoJobberRead } from "./jobber-visits-sample";
import type { BusinessAppointment } from "./workspace-business-data";

const zone = "America/Denver";

describe("normalizeJobberVisits", () => {
  it("classifies timed, anytime, unscheduled, and completed visits from the payload", () => {
    expect(companyCalendarDay("2026-03-14T00:00:00.000Z", zone)).toBe("2026-03-13");
    const read = demoJobberRead(zone);
    const byId = new Map(read.visits.map((visit) => [visit.id, visit]));
    expect(byId.get("jobber:jobber-demo-alpine:visit-timed")).toMatchObject({
      day: "2026-03-12",
      anytime: false,
      startsAt: "2026-03-12T13:30:00.000Z",
      assignees: ["Maria Santos", "Tech team B"],
      clientName: "Garcia residence",
      url: null,
    });
    expect(byId.get("jobber:jobber-demo-alpine:visit-anytime")).toMatchObject({
      day: "2026-03-14",
      anytime: true,
      startsAt: null,
    });
    expect(byId.get("jobber:jobber-demo-alpine:visit-unscheduled")).toMatchObject({
      day: null,
      anytime: false,
      assignees: [],
    });
    expect(byId.get("jobber:jobber-demo-alpine:visit-completed")?.completed).toBe(true);
    expect(byId.get("jobber:jobber-demo-alpine:visit-no-url")).toMatchObject({
      clientName: null,
      assignees: [],
      url: null,
      title: "Estimate walk-through",
    });
    const recurring = read.visits.filter((visit) => visit.title === "Weekly boiler check");
    expect(recurring.map((visit) => visit.id)).toEqual([
      "jobber:jobber-demo-alpine:visit-recur-1",
      "jobber:jobber-demo-alpine:visit-recur-2",
    ]);
  });

  it("gives a live payload and the demo fixture the same visits", () => {
    const demo = demoJobberRead(zone);
    const live = liveJobberRead({
      payload: DEMO_JOBBER_VISITS,
      timeZone: zone,
      state: "ready",
      lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
      message: null,
    });
    expect(live.sampleLabel).toBeNull();
    expect(live.visits).toEqual(demo.visits);
    const upcoming = upcomingVisits(demo.visits, "2026-03-12", 7).map((visit) => visit.id);
    expect(upcoming).toContain("jobber:jobber-demo-alpine:visit-timed");
    expect(upcoming).toContain("jobber:jobber-demo-alpine:visit-anytime");
    expect(upcoming).not.toContain("jobber:jobber-demo-alpine:visit-completed");
    expect(upcoming).not.toContain("jobber:jobber-demo-alpine:visit-unscheduled");
    expect(upcoming).not.toContain("jobber:jobber-demo-alpine:visit-recur-2");
    expect(unscheduledVisits(demo.visits).map((visit) => visit.title)).toEqual(["Callback — no heat"]);
  });

  it("does not fill a failed or first sync with demo visits, and keeps the last good window", () => {
    const waiting = liveJobberRead({
      payload: null,
      timeZone: zone,
      state: "pending_first_sync",
      previous: demoJobberRead(zone).visits,
      lastSuccessfulSyncAt: null,
      message: null,
    });
    expect(waiting.visits).toEqual([]);
    expect(waiting.sampleLabel).toBeNull();

    const previous = demoJobberRead(zone).visits;
    const failed = liveJobberRead({
      payload: { accountId: "jobber-demo-alpine", visits: [] },
      timeZone: zone,
      state: "failed",
      previous,
      lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
      message: "Jobber returned an error.",
    });
    expect(failed.visits).toEqual(previous);
    expect(failed.message).toMatch(/error/);

    const moved = previous.filter((visit) => !visit.id.endsWith("visit-timed"));
    const reconciled = reconcileVisitWindow({
      previous,
      incoming: moved.filter((visit) => visit.day && visit.day >= "2026-03-01" && visit.day <= "2026-03-31"),
      windowStart: "2026-03-01",
      windowEnd: "2026-03-31",
      unscheduledComplete: true,
    });
    expect(reconciled.some((visit) => visit.id.endsWith("visit-timed"))).toBe(false);
    expect(reconciled.some((visit) => visit.id.endsWith("visit-unscheduled"))).toBe(false);
  });

  it("maps a Google Calendar appointment without treating it as a Jobber visit", () => {
    const appt: BusinessAppointment = {
      id: "gcal-1",
      startAt: "2026-03-12T08:00:00",
      title: "Estimate walkthrough",
      location: "Oak St",
      assignee: "Tech team B",
      status: "scheduled",
      sourceLabel: "Google Calendar",
    };
    expect(appointmentAsScheduleVisit(appt)).toMatchObject({
      source: "google-calendar",
      day: "2026-03-12",
      anytime: false,
      assignees: ["Tech team B"],
      url: null,
    });
    const empty = normalizeJobberVisits({
      payload: { accountId: "acct", visits: [] },
      timeZone: zone,
      state: "verified_empty",
      sampleLabel: null,
      lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
      message: null,
    });
    expect(empty.visits).toEqual([]);
    expect(upcomingVisits(empty.visits, "2026-03-12")).toEqual([]);
  });
});
