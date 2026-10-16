import type { GoogleEventItem } from "./google-api";

export type ParsedCalendarEvent = {
  googleEventId: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  timezone: string | null;
  status: string;
  googleUpdatedAt: string | null;
};

export function parseGoogleEvent(item: GoogleEventItem): ParsedCalendarEvent {
  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  const tz = item.start?.timeZone ?? null;

  if (allDay && item.start?.date) {
    startsAt = `${item.start.date}T00:00:00.000Z`;
    if (item.end?.date) {
      endsAt = `${item.end.date}T00:00:00.000Z`;
    }
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
    timezone: tz,
    status: item.status ?? "confirmed",
    googleUpdatedAt: item.updated ? new Date(item.updated).toISOString() : null,
  };
}
