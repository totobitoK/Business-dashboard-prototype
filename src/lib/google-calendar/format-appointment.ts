const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

function parseIsoDateParts(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  return { y: y!, m: m! - 1, d: d! };
}

function formatIsoDateLocal(isoDate: string): string {
  const { y, m, d } = parseIsoDateParts(isoDate);
  return new Date(y, m, d).toLocaleDateString(undefined, DATE_FMT);
}

function formatIsoDateRangeLocal(start: string, endExclusive: string | null): string {
  if (!endExclusive || endExclusive <= start) {
    return formatIsoDateLocal(start);
  }
  const endInclusive = addDaysIso(endExclusive, -1);
  if (endInclusive === start) {
    return formatIsoDateLocal(start);
  }
  return `${formatIsoDateLocal(start)} – ${formatIsoDateLocal(endInclusive)}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const { y, m, d } = parseIsoDateParts(isoDate);
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatInTimeZone(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(iso));
}

export function formatAppointmentWhen(params: {
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  allDayStart?: string | null;
  allDayEnd?: string | null;
  timezone: string | null;
}): string {
  if (params.allDay && params.allDayStart) {
    return formatIsoDateRangeLocal(params.allDayStart, params.allDayEnd ?? null);
  }
  if (!params.startsAt) return "—";

  const tz = params.timezone ?? undefined;
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  const datePart = tz
    ? formatInTimeZone(params.startsAt, tz, dateOpts)
    : new Date(params.startsAt).toLocaleDateString(undefined, dateOpts);
  const startTime = tz
    ? formatInTimeZone(params.startsAt, tz, timeOpts)
    : new Date(params.startsAt).toLocaleTimeString(undefined, timeOpts);
  const endTime = params.endsAt
    ? tz
      ? formatInTimeZone(params.endsAt, tz, timeOpts)
      : new Date(params.endsAt).toLocaleTimeString(undefined, timeOpts)
    : null;

  return endTime ? `${datePart} · ${startTime} – ${endTime}` : `${datePart} · ${startTime}`;
}
