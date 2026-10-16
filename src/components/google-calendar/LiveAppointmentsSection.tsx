import { formatAppointmentWhen } from "@/lib/google-calendar/format-appointment";
import type { GoogleCalendarStatus } from "./LiveGoogleCalendarPanel";

export type AppointmentRow = {
  id: string;
  title: string;
  google_calendar_id: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  timezone: string | null;
  imported_at: string;
};

export function LiveAppointmentsSection({
  status,
  appointments,
  calendarNames,
}: {
  status: GoogleCalendarStatus | null;
  appointments: AppointmentRow[];
  calendarNames: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">Appointments</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Upcoming and recent events from your connected Google Calendars (appointments only — not
        revenue or payments).
      </p>

      <div className="mt-4">{renderBody(status, appointments, calendarNames)}</div>
    </section>
  );
}

function renderBody(
  status: GoogleCalendarStatus | null,
  appointments: AppointmentRow[],
  calendarNames: Record<string, string>
) {
  if (!status || !status.connected) {
    return (
      <p className="text-sm text-ink-muted">
        No Google Calendar connected.{" "}
        <a href="/dashboard/settings" className="font-semibold text-purple hover:underline">
          Connect in settings
        </a>{" "}
        (owners only).
      </p>
    );
  }

  if (status.status === "reconnect_required") {
    return (
      <p className="text-sm text-amber-900">
        Google Calendar needs to be reconnected before appointments can update.{" "}
        <a href="/dashboard/settings" className="font-semibold text-purple hover:underline">
          Open settings
        </a>
        .
      </p>
    );
  }

  if (status.selected_calendar_count === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Connected, but no calendars are selected yet. Owners can choose calendars in{" "}
        <a href="/dashboard/settings" className="font-semibold text-purple hover:underline">
          settings
        </a>
        .
      </p>
    );
  }

  if (status.status === "syncing" && appointments.length === 0) {
    return <p className="text-sm text-purple-dark">Syncing appointments from Google Calendar…</p>;
  }

  if (status.status === "error" && appointments.length === 0) {
    return (
      <p className="text-sm text-amber-900">
        Sync hit a temporary error. Showing appointments may be stale until the next successful
        sync.
      </p>
    );
  }

  if (appointments.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No appointments in the selected date window yet. Sync runs automatically after you connect
        and select calendars.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-purple-50">
      {appointments.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-ink">{row.title}</p>
            <p className="text-sm text-ink-muted">
              {calendarNames[row.google_calendar_id] ?? row.google_calendar_id}
            </p>
            <p className="text-sm text-ink">
              {formatAppointmentWhen({
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                allDay: row.all_day,
                timezone: row.timezone,
              })}
            </p>
          </div>
          <p className="shrink-0 text-xs text-ink-muted">
            Last updated {new Date(row.imported_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
