export function formatAppointmentWhen(params: {
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  timezone: string | null;
}): string {
  if (!params.startsAt) return "—";
  const start = new Date(params.startsAt);
  if (params.allDay) {
    return start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const end = params.endsAt ? new Date(params.endsAt) : null;
  const datePart = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const startTime = start.toLocaleTimeString(undefined, timeFmt);
  const endTime = end ? end.toLocaleTimeString(undefined, timeFmt) : null;
  const tz = params.timezone ? ` ${params.timezone}` : "";
  return endTime
    ? `${datePart} · ${startTime} – ${endTime}${tz}`
    : `${datePart} · ${startTime}${tz}`;
}
