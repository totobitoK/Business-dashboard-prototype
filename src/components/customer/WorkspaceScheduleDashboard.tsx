"use client";

import { useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/customer/DashboardWorkspaceNav";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  DEMO_AS_OF_DATE,
  getWorkspaceBusinessData,
  type BusinessAppointment,
} from "@/lib/workspace-business-data";
import { listUpcomingAppointments } from "@/lib/workspace-analytics";
import {
  BUSINESS_TIMEZONE,
  formatIsoDate,
  parseIsoDate,
} from "@/lib/workspace-reporting-period";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function chipTime(iso: string): string {
  return formatDateTime(iso).time.toLowerCase();
}

/** Time plus the first word of the visit title, for a calendar chip. */
function chipLabel(appt: BusinessAppointment, timeOnly: boolean): string {
  const time = chipTime(appt.startAt);
  if (timeOnly) return time;
  const word = (appt.title.trim().split(/\s+/)[0] ?? "").replace(/-/g, " ");
  return word ? `${time} ${word}` : time;
}

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

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function monthTitle(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

type CalendarCell = { iso: string; day: number; inMonth: boolean };

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const count = daysInMonth(year, month);
  const cells: CalendarCell[] = [];

  const prev = shiftMonth(year, month, -1);
  const prevCount = daysInMonth(prev.year, prev.month);
  for (let i = 0; i < firstDow; i++) {
    const day = prevCount - firstDow + 1 + i;
    cells.push({
      day,
      inMonth: false,
      iso: formatIsoDate(prev.year, prev.month, day),
    });
  }

  for (let day = 1; day <= count; day++) {
    cells.push({ day, inMonth: true, iso: formatIsoDate(year, month, day) });
  }

  const next = shiftMonth(year, month, 1);
  let spill = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: spill,
      inMonth: false,
      iso: formatIsoDate(next.year, next.month, spill),
    });
    spill += 1;
  }
  return cells;
}

export function WorkspaceScheduleDashboard() {
  const { workspaceId, theme, workspaceSessionKey, businessName } = useCustomerPortal();
  const data = getWorkspaceBusinessData(workspaceId);
  const asOf = parseIsoDate(DEMO_AS_OF_DATE);
  const [viewYear, setViewYear] = useState(asOf.y);
  const [viewMonth, setViewMonth] = useState(asOf.m);
  const [selectedIso, setSelectedIso] = useState(DEMO_AS_OF_DATE);
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<string | null>(null);
  const isHvac = workspaceId.includes("hvac");

  const appointmentsByIso = useMemo(() => {
    const byIso = new Map<string, BusinessAppointment[]>();
    if (!data) return byIso;
    for (const appt of data.appointments) {
      if (appt.status === "canceled") continue;
      const iso = appt.startAt.slice(0, 10);
      const list = byIso.get(iso) ?? [];
      list.push(appt);
      byIso.set(iso, list);
    }
    return byIso;
  }, [data]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const upcoming = useMemo(
    () => (data ? listUpcomingAppointments(data.appointments, 14, DEMO_AS_OF_DATE) : []),
    [data]
  );

  if (!data) {
    return <p className="text-sm text-ink-muted">No schedule data for this workspace.</p>;
  }

  const selected = parseIsoDate(selectedIso);
  const selectedList = appointmentsByIso.get(selectedIso) ?? [];
  const selectedUpcoming = upcoming.find((appt) => appt.id === selectedUpcomingId) ?? null;
  const monthCount = cells.reduce(
    (sum, cell) => (cell.inMonth ? sum + (appointmentsByIso.get(cell.iso)?.length ?? 0) : sum),
    0
  );
  const viewingAsOfMonth = viewYear === asOf.y && viewMonth === asOf.m;

  function showMonth(year: number, month: number, day?: number) {
    setViewYear(year);
    setViewMonth(month);
    if (day != null) {
      const clamped = Math.min(day, daysInMonth(year, month));
      setSelectedIso(formatIsoDate(year, month, clamped));
    }
  }

  function openDay(cell: CalendarCell) {
    const parsed = parseIsoDate(cell.iso);
    if (!cell.inMonth) {
      showMonth(parsed.y, parsed.m, parsed.d);
      return;
    }
    setSelectedIso(cell.iso);
  }

  return (
    <div
      key={`schedule-${workspaceId}-${workspaceSessionKey}`}
      className={`flex min-h-full w-full flex-1 flex-col overflow-hidden border-0 shadow-none ${theme.dashboardCanvas}`}
    >
      <div className={`${theme.header} ${theme.headerText}`}>
        <DashboardTopBar
          title={businessName}
          trailing={
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}>
              Sample data
            </span>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-5 lg:p-5">
        <div className="contents">
          <section
            className={`overflow-hidden lg:col-span-3 ${theme.sectionPanel}`}
            aria-label={`${monthTitle(viewYear, viewMonth)} calendar`}
          >
            <div className={`flex items-center justify-between gap-3 px-4 py-3 ${theme.header} ${theme.headerText}`}>
              <button
                type="button"
                onClick={() => {
                  const next = shiftMonth(viewYear, viewMonth, -1);
                  showMonth(next.year, next.month);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none transition hover:bg-white/25"
                aria-label="Previous month"
              >
                ‹
              </button>
              <div className="min-w-0 text-center">
                <p className="text-lg font-semibold leading-none sm:text-xl">
                  {monthTitle(viewYear, viewMonth)}
                </p>
                <p className="mt-1 text-[11px] opacity-90">
                  {`${isHvac ? "Field schedule" : "Operations calendar"} · ${monthCount} visit${monthCount === 1 ? "" : "s"} · ${BUSINESS_TIMEZONE}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {!viewingAsOfMonth ? (
                  <button
                    type="button"
                    onClick={() => showMonth(asOf.y, asOf.m, asOf.d)}
                    className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-white/25"
                  >
                    Today
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const next = shiftMonth(viewYear, viewMonth, 1);
                    showMonth(next.year, next.month);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none transition hover:bg-white/25"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-7 border-b ${theme.widgetListHeader} ${theme.sectionHeader}`}>
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className={`px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${theme.detailSectionLabel}`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const visits = appointmentsByIso.get(cell.iso) ?? [];
                const selectedDay = cell.iso === selectedIso;
                const splitDay = visits.length > 4;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => openDay(cell)}
                    aria-pressed={selectedDay}
                    aria-label={`${cell.iso}, ${visits.length} visit${visits.length === 1 ? "" : "s"}`}
                    className={`flex min-h-16 flex-col items-stretch border-b border-r p-1 text-left transition sm:min-h-24 ${theme.detailPanelBorder} ${
                      selectedDay
                        ? `${theme.sectionPanel} !rounded-none text-ink`
                        : !cell.inMonth
                          ? "bg-black/[0.03] text-ink-muted/60"
                          : `bg-white/70 ${theme.operationsListHover}`
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        selectedDay || cell.inMonth ? "text-ink" : ""
                      }`}
                    >
                      {cell.day}
                    </span>
                    {visits.length > 0 ? (
                      <span
                        className={`mt-1 min-h-0 gap-0.5 ${
                          splitDay ? "grid grid-cols-2" : "flex flex-col"
                        }`}
                      >
                        {visits.map((appt) => (
                          <span
                            key={appt.id}
                            className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-white ${theme.chartBarHi}`}
                          >
                            {chipLabel(appt, splitDay)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`overflow-hidden lg:col-span-3 lg:col-start-1 lg:row-start-2 ${theme.sectionPanel}`}>
            <div className={`px-4 py-3 ${theme.sectionHeader}`}>
              <h3 className="text-sm font-semibold text-ink">Next 14 days</h3>
              <p className={`mt-0.5 text-xs ${theme.detailSectionLabel}`}>
                From {formatDateTime(`${DEMO_AS_OF_DATE}T12:00:00`).date}
              </p>
            </div>
            <ul className="space-y-2 p-3">
              {upcoming.length === 0 ? (
                <li className="px-1 py-2 text-sm text-ink-muted">No upcoming visits.</li>
              ) : (
                upcoming.map((appt) => {
                  const { date, time } = formatDateTime(appt.startAt);
                  const iso = appt.startAt.slice(0, 10);
                  const active = appt.id === selectedUpcoming?.id;
                  return (
                    <li key={appt.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseIsoDate(iso);
                          showMonth(parsed.y, parsed.m, parsed.d);
                          setSelectedUpcomingId(appt.id);
                        }}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${theme.listRow} ${
                          active ? theme.operationsListSelected : theme.operationsListHover
                        }`}
                      >
                        <span className="w-28 shrink-0">
                          <span className={`block text-xs font-bold ${theme.listAccent}`}>{date}</span>
                          <span className={`text-[11px] ${theme.metricValueA}`}>{time}</span>
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate font-medium ${active ? theme.metricValueA : "text-ink"}`}>
                            {appt.title}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">{appt.location}</span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {selectedUpcoming ? (
            <aside
              className={`flex min-h-0 flex-col overflow-hidden lg:col-span-2 lg:col-start-4 lg:row-start-2 ${theme.sectionPanel}`}
              aria-label="Visit details"
            >
              <div className={`px-4 py-3 ${theme.sectionHeader}`}>
                <h3 className="text-sm font-semibold text-ink">{selectedUpcoming.title}</h3>
                <p className={`mt-0.5 text-xs ${theme.detailSectionLabel}`}>Visit details</p>
              </div>
              <dl className="min-h-0 flex-1 space-y-2 overflow-auto p-3 text-sm">
                <VisitDetailRow
                  label="When"
                  value={`${formatDateTime(selectedUpcoming.startAt).date} · ${formatDateTime(selectedUpcoming.startAt).time}`}
                />
                <VisitDetailRow label="Where" value={selectedUpcoming.location} />
                <VisitDetailRow label="Assigned to" value={selectedUpcoming.assignee} />
                <VisitDetailRow
                  label="Status"
                  value={selectedUpcoming.status === "canceled" ? "Canceled" : "Scheduled"}
                />
                <VisitDetailRow label="Source" value={selectedUpcoming.sourceLabel} />
              </dl>
            </aside>
          ) : null}
        </div>

        <aside
          className={`flex min-h-0 flex-col overflow-hidden lg:col-span-2 lg:col-start-4 lg:row-start-1 ${theme.sectionPanel}`}
        >
          <div className={`px-4 py-3 ${theme.sectionHeader}`}>
            <h3 className="text-sm font-semibold text-ink">
              {new Date(Date.UTC(selected.y, selected.m - 1, selected.d)).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h3>
            <p className={`mt-0.5 text-xs ${theme.detailSectionLabel}`}>
              {`${selectedList.length} visit${selectedList.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {selectedList.length === 0 ? (
              <li className="px-1 py-2 text-sm text-ink-muted">No appointments this day.</li>
            ) : (
              selectedList.map((appt) => {
                const { time } = formatDateTime(appt.startAt);
                return (
                  <li key={appt.id} className={`rounded-lg border p-3 text-sm ${theme.listRow}`}>
                    <p className={`text-xs font-bold ${theme.listAccent}`}>{time}</p>
                    <p className="mt-0.5 font-medium text-ink">{appt.title}</p>
                    <p className="text-xs text-ink-muted">{appt.location}</p>
                    {appt.assignee ? (
                      <p className={`mt-1 text-[11px] font-medium ${theme.metricValueA}`}>{appt.assignee}</p>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function VisitDetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useCustomerPortal();
  return (
    <div className={`rounded-lg px-3 py-2 ${theme.listRow}`}>
      <dt className={`text-[11px] font-semibold uppercase tracking-wide ${theme.detailSectionLabel}`}>
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
