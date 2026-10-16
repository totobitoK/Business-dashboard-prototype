import type { GoogleEventItem } from "./google-api";

export type ParsedCalendarEvent = {
  googleEventId: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  allDayStart: string | null;
  allDayEnd: string | null;
  timezone: string | null;
  status: string;
  googleUpdatedAt: string | null;
};

export function parseGoogleEvent(item: GoogleEventItem): ParsedCalendarEvent {
  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let allDayStart: string | null = null;
  let allDayEnd: string | null = null;
  const tz = item.start?.timeZone ?? item.end?.timeZone ?? null;

  if (allDay && item.start?.date) {
    allDayStart = item.start.date;
    allDayEnd = item.end?.date ?? null;
    startsAt = null;
    endsAt = null;
  } else if (item.start?.dateTime) {
    startsAt = new Date(item.start.dateTime).toISOString();
    endsAt = item.end?.dateTime ? new Date(item.end.dateTime).toISOString() : null;
  }

  return {
    googleEventId: item.id,
    title: item.summary?.trim() || "(No title)",
    startsAt,
    endsAt,
    allDay,
    allDayStart,
    allDayEnd,
    timezone: tz,
    status: item.status ?? "confirmed",
    googleUpdatedAt: item.updated ? new Date(item.updated).toISOString() : null,
  };
}
