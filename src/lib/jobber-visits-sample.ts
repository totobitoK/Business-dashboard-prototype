import { normalizeJobberVisits, type JobberVisitsPayload, type JobberScheduleRead } from "./jobber-visits";

/**
 * Jobber-shaped visit records for the demo. Metrics and calendar placement
 * come from `demoJobberRead`, which uses the same normalizer as a live payload.
 * Close nothing here to a guessed stage id. Times are instants. The company
 * time zone decides the calendar day. March 2026 in Denver is MDT (UTC-6).
 */
export const DEMO_JOBBER_VISITS: JobberVisitsPayload = {
  accountId: "jobber-demo-alpine",
  visits: [
    {
      id: "visit-timed",
      title: "Furnace tune-up",
      startAt: "2026-03-12T13:30:00.000Z",
      endAt: "2026-03-12T15:00:00.000Z",
      allDay: false,
      isComplete: false,
      client: { name: "Garcia residence" },
      job: { id: "job-1", jobNumber: "1042", title: "Spring maintenance" },
      assignedUsers: { nodes: [{ id: "user-1", name: { full: "Maria Santos" } }, { id: "user-2", name: { full: "Tech team B" } }] },
    },
    {
      id: "visit-anytime",
      title: "Filter drop-off",
      startAt: "2026-03-14T06:00:00.000Z",
      endAt: "2026-03-15T05:59:00.000Z",
      allDay: true,
      isComplete: false,
      client: { name: "Kim household" },
      job: { id: "job-2", jobNumber: "1048" },
      assignedUsers: { nodes: [{ id: "user-1", name: { full: "Maria Santos" } }] },
    },
    {
      id: "visit-unscheduled",
      title: "Callback — no heat",
      startAt: null,
      endAt: null,
      allDay: false,
      isComplete: false,
      client: { name: "Northside Office Park" },
      job: { id: "job-3", jobNumber: "1051" },
      assignedUsers: { nodes: [] },
    },
    {
      id: "visit-completed",
      title: "Thermostat install",
      startAt: "2026-03-11T16:00:00.000Z",
      endAt: "2026-03-11T18:00:00.000Z",
      allDay: false,
      isComplete: true,
      completedAt: "2026-03-11T17:40:00.000Z",
      client: { name: "Riverside Retail" },
      job: { id: "job-4", jobNumber: "1033" },
      assignedUsers: { nodes: [{ id: "user-2", name: { full: "Tech team B" } }] },
    },
    {
      id: "visit-recur-1",
      title: "Weekly boiler check",
      startAt: "2026-03-13T15:00:00.000Z",
      endAt: "2026-03-13T16:00:00.000Z",
      allDay: false,
      isComplete: false,
      client: { name: "Plaza HVAC" },
      job: { id: "job-5", jobNumber: "990" },
      assignedUsers: { nodes: [{ id: "user-2", name: { full: "Tech team B" } }] },
    },
    {
      id: "visit-recur-2",
      title: "Weekly boiler check",
      startAt: "2026-03-20T15:00:00.000Z",
      endAt: "2026-03-20T16:00:00.000Z",
      allDay: false,
      isComplete: false,
      client: { name: "Plaza HVAC" },
      job: { id: "job-5", jobNumber: "990" },
      assignedUsers: { nodes: [{ id: "user-2", name: { full: "Tech team B" } }] },
    },
    {
      id: "visit-no-url",
      title: "Estimate walk-through",
      startAt: "2026-03-16T18:00:00.000Z",
      endAt: "2026-03-16T19:00:00.000Z",
      allDay: false,
      isComplete: false,
      client: null,
      job: null,
      assignedUsers: null,
    },
  ],
};

export function demoJobberRead(timeZone: string): JobberScheduleRead {
  return normalizeJobberVisits({
    payload: DEMO_JOBBER_VISITS,
    timeZone,
    state: "ready",
    sampleLabel: "Sample",
    lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
    message: null,
  });
}
