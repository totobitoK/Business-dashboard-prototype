"use client";

import { useMemo, useState } from "react";
import { DashboardWorkspaceNav } from "@/components/customer/DashboardWorkspaceNav";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  DEMO_AS_OF_DATE,
  getWorkspaceBusinessData,
  type BusinessAppointment,
} from "@/lib/workspace-business-data";
import { listUpcomingAppointments } from "@/lib/workspace-analytics";
import { BUSINESS_TIMEZONE } from "@/lib/workspace-reporting-period";

const CALENDAR_YEAR = 2026;
const CALENDAR_MONTH = 3; // March (demo month)

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: BUSINESS_TIMEZONE,
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: BUSINESS_TIMEZONE,
    }),
  };
}

export function WorkspaceScheduleDashboard() {
  const { workspaceId, theme, workspaceSessionKey } = useCustomerPortal();
  const data = getWorkspaceBusinessData(workspaceId);
  const [selectedDay, setSelectedDay] = useState<number | null>(12);
  const isHvac = workspaceId.includes("hvac");

  const { weeks, appointmentsByDay, monthAppointments } = useMemo(() => {
    if (!data) {
      return { weeks: [], appointmentsByDay: new Map(), monthAppointments: [] };
    }
    const first = new Date(Date.UTC(CALENDAR_YEAR, CALENDAR_MONTH - 1, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(CALENDAR_YEAR, CALENDAR_MONTH, 0)).getUTCDate();

    const byDay = new Map<number, BusinessAppointment[]>();
    for (const appt of data.appointments) {
      const datePart = appt.startAt.slice(0, 10);
      const [y, m, dayStr] = datePart.split("-").map(Number);
      if (
        y === CALENDAR_YEAR &&
        m === CALENDAR_MONTH &&
        appt.status !== "canceled"
      ) {
        const day = dayStr!;
        const list = byDay.get(day) ?? [];
        list.push(appt);
        byDay.set(day, list);
      }
    }

    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const upcoming = listUpcomingAppointments(data.appointments, 14, DEMO_AS_OF_DATE);

    return {
      weeks,
      appointmentsByDay: byDay,
      monthAppointments: upcoming,
    };
  }, [data]);

  if (!data) {
    return <p className="text-sm text-ink-muted">No schedule data for this workspace.</p>;
  }

  const selectedList: BusinessAppointment[] =
    selectedDay != null ? appointmentsByDay.get(selectedDay) ?? [] : [];

  return (
    <div
      key={`schedule-${workspaceId}-${workspaceSessionKey}`}
      className={`overflow-hidden rounded-2xl shadow-card ${theme.card}`}
    >
      <div className={`px-4 py-3 sm:px-5 ${theme.header} ${theme.headerText}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {isHvac ? "Field schedule" : "Operations calendar"}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}>
            Sample data
          </span>
        </div>
        <DashboardWorkspaceNav embedded />
        <p className="mt-2 text-[11px] opacity-90">
          March {CALENDAR_YEAR} · Demo as-of {DEMO_AS_OF_DATE} ({BUSINESS_TIMEZONE})
        </p>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-5 lg:p-5">
        <div className="lg:col-span-3">
          <table className="w-full table-fixed border-collapse text-center text-xs">
            <thead>
              <tr className="text-ink-muted">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <th key={d} className="pb-2 font-semibold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    if (day == null) {
                      return <td key={di} className="h-12 border border-purple-50/80" />;
                    }
                    const count = appointmentsByDay.get(day)?.length ?? 0;
                    const isAsOf = day === 12;
                    const selected = selectedDay === day;
                    return (
                      <td key={di} className="h-12 border border-purple-50/80 p-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`flex h-full w-full flex-col items-center justify-center rounded-md text-xs transition-colors ${
                            selected
                              ? "bg-purple text-white"
                              : isAsOf
                                ? "ring-1 ring-purple/40 bg-purple-50/80"
                                : "hover:bg-purple-50/60"
                          }`}
                        >
                          <span className="font-semibold">{day}</span>
                          {count > 0 && (
                            <span
                              className={`mt-0.5 text-[9px] ${selected ? "text-white/90" : "text-purple-dark"}`}
                            >
                              {count} appt{count === 1 ? "" : "s"}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink">
            {selectedDay != null
              ? `March ${selectedDay}, ${CALENDAR_YEAR}`
              : "Select a day"}
          </h3>
          <ul className="mt-2 space-y-2">
            {selectedList.length === 0 ? (
              <li className="text-sm text-ink-muted">No appointments this day.</li>
            ) : (
              selectedList.map((appt) => {
                const { time } = formatDateTime(appt.startAt);
                return (
                  <li
                    key={appt.id}
                    className={`rounded-lg border p-2 text-sm ${theme.listRow}`}
                  >
                    <p className={`text-xs font-bold ${theme.listAccent}`}>
                      {time}
                    </p>
                    <p className="font-medium text-ink">{appt.title}</p>
                    <p className="text-xs text-ink-muted">{appt.location}</p>
                  </li>
                );
              })
            )}
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-ink">Next 14 days</h3>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {monthAppointments.map((appt) => {
              const { date, time } = formatDateTime(appt.startAt);
              return (
                <li key={appt.id} className="text-ink-muted">
                  <span className="font-medium text-ink">{date}</span> {time} —{" "}
                  {appt.title}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
