"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/customer/DashboardWorkspaceNav";
import { DashboardChipGroup } from "@/components/customer/dashboard-controls";
import { useDashboardComposition } from "@/components/customer/use-dashboard-composition";
import { liveAppointments } from "@/lib/daily-dashboard/live-figures";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { isLightDashboardTheme } from "@/lib/layout-customize-themes";
import { WORKSPACE_ALPINE_HVAC, isValidWorkspaceId } from "@/lib/customer-workspaces";
import { DEMO_AS_OF_DATE, getWorkspaceBusinessData } from "@/lib/workspace-business-data";
import {
  BUSINESS_TIMEZONE,
  formatCalendarDateDisplay,
  formatIsoDate,
  parseIsoDate,
} from "@/lib/workspace-reporting-period";
import {
  appointmentAsScheduleVisit,
  filterVisitsBySource,
  jobberStatusMessage,
  liveJobberRead,
  scheduleSources,
  sourceLabel,
  unscheduledVisits,
  upcomingVisits,
  visitClockLabel,
  visitsOnDay,
  type ScheduleSource,
  type ScheduleVisit,
} from "@/lib/jobber-visits";
import { demoJobberRead } from "@/lib/jobber-visits-sample";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Time plus the first word of the visit title, for a calendar chip. */
function chipLabel(visit: ScheduleVisit, timeOnly: boolean, timeZone: string): string {
  const time = visitClockLabel(visit, timeZone);
  if (timeOnly) return time;
  const word = (visit.title.trim().split(/\s+/)[0] ?? "").replace(/-/g, " ");
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

export function WorkspaceScheduleDashboard({
  liveSnapshot = null,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
}) {
  const { workspaceId, theme, workspaceSessionKey } = useCustomerPortal();
  const composition = useDashboardComposition(liveSnapshot);
  const sampleWorkspaceId = isValidWorkspaceId(workspaceId)
    ? workspaceId
    : WORKSPACE_ALPINE_HVAC;
  const sample = liveSnapshot ? undefined : getWorkspaceBusinessData(sampleWorkspaceId);
  const asOfDate = liveSnapshot?.asOfDate ?? DEMO_AS_OF_DATE;
  const timeZone = liveSnapshot?.timeZone ?? BUSINESS_TIMEZONE;
  const appointments = useMemo(
    () => (liveSnapshot ? liveAppointments(liveSnapshot) : sample?.appointments ?? []),
    [liveSnapshot, sample]
  );
  const jobberRead = useMemo(() => {
    if (liveSnapshot) {
      if (!composition?.service) return null;
      return liveJobberRead({
        payload: null,
        timeZone,
        state: "pending_first_sync",
        lastSuccessfulSyncAt: null,
        message: null,
      });
    }
    return demoJobberRead(timeZone);
  }, [composition?.service, liveSnapshot, timeZone]);
  const visits = useMemo(
    () => [...appointments.map(appointmentAsScheduleVisit), ...(jobberRead?.visits ?? [])],
    [appointments, jobberRead]
  );
  const sources = scheduleSources(visits);
  const asOf = parseIsoDate(asOfDate);
  const [viewYear, setViewYear] = useState(asOf.y);
  const [viewMonth, setViewMonth] = useState(asOf.m);
  const [selectedIso, setSelectedIso] = useState(asOfDate);
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<ScheduleSource | "all">("all");
  const isHvac = !liveSnapshot && workspaceId.includes("hvac");
  const filtered = filterVisitsBySource(visits, sources.length > 1 ? sourceFilter : "all");

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const upcoming = useMemo(
    () => upcomingVisits(filtered, asOfDate, 14, timeZone),
    [filtered, asOfDate, timeZone]
  );
  const unscheduled = useMemo(() => unscheduledVisits(filtered), [filtered]);

  if (!liveSnapshot && !sample) {
    return <p className="text-sm text-ink-muted">No schedule data for this workspace.</p>;
  }

  const selected = parseIsoDate(selectedIso);
  const selectedList = visitsOnDay(filtered, selectedIso, timeZone);
  const selectedUpcoming = upcoming.find((appt) => appt.id === selectedUpcomingId) ?? null;
  const monthCount = cells.reduce(
    (sum, cell) => (cell.inMonth ? sum + visitsOnDay(filtered, cell.iso, timeZone).length : sum),
    0
  );
  const jobberNote = jobberStatusMessage(jobberRead);
  const viewingAsOfMonth = viewYear === asOf.y && viewMonth === asOf.m;
  const scheduleNotice =
    liveSnapshot && !["ready", "verified_empty", "stale"].includes(liveSnapshot.schedule.state)
      ? liveSnapshot.schedule.messages[0] ?? "Appointments are unavailable."
      : null;

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
    <DashboardShell
      key={`schedule-${workspaceId}-${workspaceSessionKey}`}
      title="Schedule"
    >
      {sources.length > 1 || jobberNote || scheduleNotice || jobberRead?.sampleLabel ? (
        <div className="flex flex-col gap-2 px-4 pt-4 lg:px-5">
          {jobberRead?.sampleLabel ? (
            <p className="text-sm text-ink">Jobber · {jobberRead.sampleLabel}</p>
          ) : null}
          {sources.length > 1 ? (
            <DashboardChipGroup
              theme={theme}
              aria-label="Schedule source"
              value={sourceFilter}
              options={[
                { value: "all", label: "All" },
                ...sources.map((source) => ({ value: source, label: sourceLabel(source) })),
              ]}
              onChange={setSourceFilter}
            />
          ) : null}
          {jobberNote || scheduleNotice ? (
            <p className="text-sm text-ink">{[jobberNote, scheduleNotice].filter(Boolean).join(" ")}</p>
          ) : null}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-5 lg:p-5">
        <div className="contents">
          <section
            className={`overflow-hidden lg:col-span-3 ${theme.sectionPanel}`}
            aria-label={`${monthTitle(viewYear, viewMonth)} calendar`}
          >
            <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 text-ink ${theme.sectionHeader}`}>
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
                <p className={scheduleNotice ? "mt-1 text-xs text-ink" : "mt-1 text-[11px] opacity-90"}>
                  {scheduleNotice ??
                    `${isHvac ? "Field schedule" : "Operations calendar"} · ${monthCount} visit${monthCount === 1 ? "" : "s"} · ${BUSINESS_TIMEZONE}`}
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
                const visits = visitsOnDay(filtered, cell.iso, timeZone);
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
                        ? isLightDashboardTheme(theme.id)
                          ? "bg-white text-ink"
                          : "bg-white/[0.2] text-ink"
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
                            className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${
                              theme.id === "purple"
                                ? "bg-violet-300 text-[#312e81]"
                                : `text-white ${theme.chartBarHi}`
                            }`}
                          >
                            {chipLabel(appt, splitDay, timeZone)}
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
                  {scheduleNotice ??
                    `From ${formatDateTime(`${asOfDate}T12:00:00`).date}${
                      liveSnapshot ? " · Today / Upcoming" : ""
                    }`}
                </p>
            </div>
            <ul className="space-y-2 p-3">
              {unscheduled.length > 0 ? (
                <li className="px-1 pb-2">
                  <p className="text-xs font-semibold text-ink">Unscheduled</p>
                  <ul className="mt-1 space-y-1">
                    {unscheduled.map((visit) => (
                      <li key={visit.id} className="text-sm text-ink">
                        {visit.title}
                        {visit.assignees.length ? ` · ${visit.assignees.join(", ")}` : ""}
                        {sources.length > 1 ? ` · ${visit.sourceName}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null}
              {upcoming.length === 0 ? (
                <li className="px-1 py-2 text-sm text-ink-muted">No upcoming visits.</li>
              ) : (
                upcoming.map((visit) => {
                  const active = visit.id === selectedUpcoming?.id;
                  const people = visit.assignees.join(", ");
                  return (
                    <li key={visit.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!visit.day) return;
                          const parsed = parseIsoDate(visit.day);
                          showMonth(parsed.y, parsed.m, parsed.d);
                          setSelectedUpcomingId(visit.id);
                        }}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${theme.listRow} ${
                          active ? theme.operationsListSelected : theme.operationsListHover
                        }`}
                      >
                        <span className="w-28 shrink-0">
                          <span className={`block text-xs font-bold ${theme.listAccent}`}>
                            {visit.day ? formatCalendarDateDisplay(visit.day, "withWeekday") : "Unscheduled"}
                          </span>
                          <span className={`text-[11px] ${theme.metricValueA}`}>
                            {visitClockLabel(visit, timeZone)}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate font-medium ${active ? theme.metricValueA : "text-ink"}`}>
                            {visit.title}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {[people || null, sources.length > 1 ? visit.sourceName : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
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
                  value={`${selectedUpcoming.day ? formatCalendarDateDisplay(selectedUpcoming.day, "withWeekday") : "Unscheduled"} · ${visitClockLabel(selectedUpcoming, timeZone)}`}
                />
                <VisitDetailRow
                  label="Assigned to"
                  value={selectedUpcoming.assignees.join(", ") || "Not reported"}
                />
                <VisitDetailRow
                  label="Status"
                  value={selectedUpcoming.completed ? "Completed" : "Scheduled"}
                />
                <VisitDetailRow label="Source" value={selectedUpcoming.sourceName} />
                {selectedUpcoming.url ? (
                  <a
                    href={selectedUpcoming.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex text-xs font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
                  >
                    Open in Jobber
                  </a>
                ) : null}
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
              selectedList.map((visit) => (
                  <li key={visit.id} className={`rounded-lg border p-3 text-sm ${theme.listRow}`}>
                    <p className={`text-xs font-bold ${theme.listAccent}`}>{visitClockLabel(visit, timeZone)}</p>
                    <p className="mt-0.5 font-medium text-ink">{visit.title}</p>
                    {visit.clientName ? <p className="text-xs text-ink-muted">{visit.clientName}</p> : null}
                    {visit.assignees.length ? (
                      <p className={`mt-1 text-[11px] font-medium ${theme.metricValueA}`}>
                        {visit.assignees.join(", ")}
                      </p>
                    ) : null}
                    {visit.completed ? <p className="mt-1 text-[11px] text-ink-muted">Completed</p> : null}
                    {sources.length > 1 ? (
                      <p className="mt-1 text-[11px] text-ink-muted">{visit.sourceName}</p>
                    ) : null}
                    {visit.url ? (
                      <a
                        href={visit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-1 inline-flex text-[11px] font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
                      >
                        Open in Jobber
                      </a>
                    ) : null}
                  </li>
                ))
            )}
          </ul>
        </aside>
      </div>
    </DashboardShell>
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
