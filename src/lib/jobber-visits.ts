import type { BusinessAppointment } from "./workspace-business-data";

/**
 * Jobber visit fields RavenView is prepared to read.
 * Confirmed from Jobber's public Visit type on 2026-11-16: an unscheduled visit
 * has null startAt and endAt, and allDay means the visit covers a full day.
 * GraphiQL against a RavenView test account has not been run. Title, job title,
 * assigned-user shape, web URL, scope names, and the active API version still
 * need that check. Missing fields stay null.
 */
export type JobberVisitRecord = {
  id: string;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean | null;
  isComplete?: boolean | null;
  completedAt?: string | null;
  client?: { name?: string | null } | null;
  job?: { id?: string | null; jobNumber?: string | null; title?: string | null } | null;
  assignedUsers?: {
    nodes?: { id?: string | null; name?: { full?: string | null } | null }[] | null;
  } | null;
  /** Set only when a response field is confirmed to be the account's visit URL. */
  webUri?: string | null;
};

export type JobberVisitsPayload = {
  accountId: string;
  visits: JobberVisitRecord[];
};

export type ScheduleSource = "jobber" | "google-calendar";

export type ScheduleVisit = {
  id: string;
  /** Null when the row is not a Jobber or Google Calendar feed. */
  source: ScheduleSource | null;
  /** Name shown on the row. Sample appointments keep their own source. */
  sourceName: string;
  title: string;
  /** Company-local day. Null when the visit has no date. */
  day: string | null;
  startsAt: string | null;
  endsAt: string | null;
  anytime: boolean;
  completed: boolean;
  canceled: boolean;
  assignees: string[];
  clientName: string | null;
  url: string | null;
};

export type JobberScheduleState =
  | "ready"
  | "pending_first_sync"
  | "syncing"
  | "stale"
  | "failed"
  | "reconnect_required"
  | "verified_empty";

export type JobberScheduleRead = {
  state: JobberScheduleState;
  sampleLabel: string | null;
  lastSuccessfulSyncAt: string | null;
  message: string | null;
  accountId: string | null;
  visits: ScheduleVisit[];
};

export function companyCalendarDay(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function visitTitle(record: JobberVisitRecord): string {
  const title = record.title?.trim();
  if (title) return title;
  const jobTitle = record.job?.title?.trim();
  if (jobTitle) return jobTitle;
  const jobNumber = record.job?.jobNumber?.trim();
  if (jobNumber) return `Job ${jobNumber}`;
  return "Visit";
}

function assignees(record: JobberVisitRecord): string[] {
  const nodes = record.assignedUsers?.nodes ?? [];
  const names: string[] = [];
  for (const node of nodes) {
    const name = node?.name?.full?.trim();
    if (name) names.push(name);
  }
  return names;
}

export function normalizeJobberVisit(
  record: JobberVisitRecord,
  accountId: string,
  timeZone: string
): ScheduleVisit {
  const start = record.startAt?.trim() || null;
  const end = record.endAt?.trim() || null;
  const unscheduled = !start && !end;
  const day = start ? companyCalendarDay(start, timeZone) : null;
  const anytime = !unscheduled && record.allDay === true;
  return {
    id: `jobber:${accountId}:${record.id}`,
    source: "jobber",
    sourceName: "Jobber",
    title: visitTitle(record),
    day: unscheduled ? null : day,
    startsAt: anytime || unscheduled ? null : start,
    endsAt: anytime || unscheduled ? null : end,
    anytime,
    completed: record.isComplete === true || Boolean(record.completedAt?.trim()),
    canceled: false,
    assignees: assignees(record),
    clientName: record.client?.name?.trim() || null,
    url: record.webUri?.trim() || null,
  };
}

export function normalizeJobberVisits(input: {
  payload: JobberVisitsPayload;
  timeZone: string;
  state: JobberScheduleState;
  sampleLabel: string | null;
  lastSuccessfulSyncAt: string | null;
  message: string | null;
}): JobberScheduleRead {
  return {
    state: input.state,
    sampleLabel: input.sampleLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    message: input.message,
    accountId: input.payload.accountId,
    visits: input.payload.visits.map((visit) =>
      normalizeJobberVisit(visit, input.payload.accountId, input.timeZone)
    ),
  };
}

/** A live read with no payload stays on that sync state and does not borrow demo visits. */
export function liveJobberRead(input: {
  payload: JobberVisitsPayload | null;
  timeZone: string;
  state: JobberScheduleState;
  previous?: ScheduleVisit[];
  lastSuccessfulSyncAt: string | null;
  message: string | null;
}): JobberScheduleRead {
  const previous = input.previous ?? [];
  if (!input.payload || input.state === "pending_first_sync" || input.state === "syncing") {
    return {
      state: input.state,
      sampleLabel: null,
      lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
      message: input.message,
      accountId: null,
      visits: input.state === "pending_first_sync" ? [] : previous,
    };
  }
  if (input.state === "failed" || input.state === "reconnect_required") {
    return {
      state: input.state,
      sampleLabel: null,
      lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
      message: input.message,
      accountId: input.payload.accountId,
      visits: previous,
    };
  }
  return normalizeJobberVisits({
    payload: input.payload,
    timeZone: input.timeZone,
    state: input.state,
    sampleLabel: null,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    message: input.message,
  });
}

/**
 * Drops dated visits inside a fully refreshed window when Jobber no longer
 * returns them. Visits outside that window stay. Unscheduled rows are replaced
 * only when the unscheduled page finished.
 */
export function reconcileVisitWindow(input: {
  previous: ScheduleVisit[];
  incoming: ScheduleVisit[];
  windowStart: string;
  windowEnd: string;
  unscheduledComplete: boolean;
}): ScheduleVisit[] {
  const incomingIds = new Set(input.incoming.map((visit) => visit.id));
  const kept = input.previous.filter((visit) => {
    if (incomingIds.has(visit.id)) return false;
    if (!visit.day) return !input.unscheduledComplete;
    return visit.day < input.windowStart || visit.day > input.windowEnd;
  });
  return [...kept, ...input.incoming];
}

export function appointmentAsScheduleVisit(appt: BusinessAppointment): ScheduleVisit {
  const day = /^\d{4}-\d{2}-\d{2}/.test(appt.startAt) ? appt.startAt.slice(0, 10) : null;
  const jobber = /jobber/i.test(appt.sourceLabel);
  const google = /google\s*calendar/i.test(appt.sourceLabel);
  const source: ScheduleSource | null = jobber ? "jobber" : google ? "google-calendar" : null;
  return {
    id: appt.id,
    source,
    sourceName: appt.sourceLabel.trim() || (source ? sourceLabel(source) : "Schedule"),
    title: appt.title,
    day,
    startsAt: appt.startAt,
    endsAt: null,
    anytime: false,
    completed: false,
    canceled: appt.status === "canceled",
    assignees: appt.assignee.trim() ? [appt.assignee.trim()] : [],
    clientName: null,
    url: null,
  };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localClock(visit: ScheduleVisit, timeZone: string): string {
  if (visit.anytime || !visit.startsAt) return "99:99";
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(visit.startsAt)) {
    return visit.startsAt.match(/T(\d{2}:\d{2})/)?.[1] ?? "99:99";
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(visit.startsAt));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function byScheduleOrder(timeZone: string) {
  return (a: ScheduleVisit, b: ScheduleVisit) => {
    if (a.day !== b.day) return (a.day ?? "").localeCompare(b.day ?? "");
    return localClock(a, timeZone).localeCompare(localClock(b, timeZone));
  };
}

export function upcomingVisits(
  visits: ScheduleVisit[],
  asOf: string,
  windowDays = 7,
  timeZone = "UTC"
): ScheduleVisit[] {
  const end = addDays(asOf, windowDays);
  return visits
    .filter((visit) => {
      if (visit.canceled || visit.completed || !visit.day) return false;
      return visit.day >= asOf && visit.day < end;
    })
    .sort(byScheduleOrder(timeZone));
}

export function unscheduledVisits(visits: ScheduleVisit[]): ScheduleVisit[] {
  return visits
    .filter((visit) => !visit.canceled && !visit.completed && !visit.day)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function visitsOnDay(visits: ScheduleVisit[], day: string, timeZone = "UTC"): ScheduleVisit[] {
  return visits.filter((visit) => !visit.canceled && visit.day === day).sort(byScheduleOrder(timeZone));
}

export function filterVisitsBySource(
  visits: ScheduleVisit[],
  source: ScheduleSource | "all"
): ScheduleVisit[] {
  if (source === "all") return visits;
  return visits.filter((visit) => visit.source === source);
}

export function scheduleSources(visits: ScheduleVisit[]): ScheduleSource[] {
  const sources = new Set(visits.map((visit) => visit.source));
  return (["jobber", "google-calendar"] as const).filter((source) => sources.has(source));
}

export function sourceLabel(source: ScheduleSource): string {
  return source === "jobber" ? "Jobber" : "Google Calendar";
}

export function visitClockLabel(visit: ScheduleVisit, timeZone: string): string {
  if (!visit.day) return "Unscheduled";
  if (visit.anytime || !visit.startsAt) return "Anytime";
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(visit.startsAt)) {
    const match = visit.startsAt.match(/T(\d{2}):(\d{2})/);
    if (!match) return "Anytime";
    const hour = Number(match[1]);
    const suffix = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${match[2]} ${suffix}`;
  }
  return new Date(visit.startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function jobberStatusMessage(read: JobberScheduleRead | null): string | null {
  if (!read) return null;
  if (read.state === "pending_first_sync") return "Waiting for the first Jobber sync.";
  if (read.state === "syncing") return "Jobber is syncing. Showing the last schedule we saved.";
  if (read.state === "failed") return read.message ?? "Jobber could not be loaded. Showing the last saved schedule.";
  if (read.state === "reconnect_required") return "Reconnect Jobber to load the schedule.";
  if (read.state === "stale") {
    return read.message ?? "The Jobber schedule is stale. Showing the last successful sync.";
  }
  if (read.state === "verified_empty") return "Jobber returned no visits.";
  return read.message;
}
