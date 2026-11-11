"use client";

import { useMemo, useState } from "react";
import type { DailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyAppointment, DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import {
  formatCalendarDateDisplay,
  formatIsoDate,
  parseIsoDate,
} from "@/lib/workspace-reporting-period";
import { MessageList, SectionCard, StateBadge } from "./DailyBlocks";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function DailySchedule({
  snapshot,
  theme,
  compact,
}: {
  snapshot: DailyDashboardSnapshot;
  theme: DailyTheme;
  compact?: boolean;
}) {
  const asOf = parseIsoDate(snapshot.asOfDate);
  const [cursor, setCursor] = useState({ year: asOf.y, month: asOf.m });
  const [selectedIso, setSelectedIso] = useState(snapshot.asOfDate);
  const byDay = useMemo(() => {
    const map = new Map<string, DailyAppointment[]>();
    for (const appointment of snapshot.schedule.appointments) {
      const list = map.get(appointment.isoDate) ?? [];
      list.push(appointment);
      map.set(appointment.isoDate, list);
    }
    return map;
  }, [snapshot.schedule.appointments]);

  const blocked = ["disconnected", "unavailable", "setup_incomplete", "reconnect_required", "load_error"].includes(
    snapshot.schedule.state
  );
  const upcoming = snapshot.schedule.appointments.filter((appointment) => appointment.isoDate >= snapshot.asOfDate);
  const selected = byDay.get(selectedIso) ?? [];
  const showingUpcoming = selectedIso === snapshot.asOfDate;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <SectionCard
        theme={theme}
        eyebrow={snapshot.schedule.windowLabel}
        title="Agenda"
        compact={compact}
        action={<StateBadge state={snapshot.schedule.state} theme={theme} />}
      >
        <p className={`text-xs tabular-nums ${theme.subtle}`}>
          As of {formatCalendarDateDisplay(snapshot.asOfDate)} · {snapshot.timeZone}
        </p>
        {blocked ? (
          <div className="mt-3">
            <MessageList messages={snapshot.schedule.messages} theme={theme} />
          </div>
        ) : showingUpcoming ? (
          <AgendaList appointments={upcoming} theme={theme} empty="No appointments in the Today / Upcoming window." />
        ) : (
          <div className="mt-3">
            <button
              type="button"
              className={`text-sm ${theme.link} ${theme.focus}`}
              onClick={() => setSelectedIso(snapshot.asOfDate)}
            >
              Back to Today / Upcoming
            </button>
            <AgendaList
              appointments={selected}
              theme={theme}
              empty={`No visits on ${formatCalendarDateDisplay(selectedIso)}.`}
            />
          </div>
        )}
      </SectionCard>

      <div>
        <details className={`lg:hidden ${theme.card}`}>
          <summary className={`cursor-pointer px-4 py-3 text-sm font-semibold ${theme.text}`}>Month</summary>
          <div className="px-3 pb-3">
            <MonthGrid
              cursor={cursor}
              setCursor={setCursor}
              selectedIso={selectedIso}
              asOf={snapshot.asOfDate}
              byDay={byDay}
              theme={theme}
              onSelect={setSelectedIso}
            />
          </div>
        </details>
        <div className={`hidden lg:block ${theme.card} p-3`}>
          <MonthGrid
            cursor={cursor}
            setCursor={setCursor}
            selectedIso={selectedIso}
            asOf={snapshot.asOfDate}
            byDay={byDay}
            theme={theme}
            onSelect={setSelectedIso}
          />
        </div>
      </div>
    </div>
  );
}

function AgendaList({
  appointments,
  theme,
  empty,
}: {
  appointments: DailyAppointment[];
  theme: DailyTheme;
  empty: string;
}) {
  if (appointments.length === 0) return <p className={`mt-3 text-sm ${theme.muted}`}>{empty}</p>;
  return (
    <ul className="mt-3 space-y-2">
      {appointments.map((appointment, index) => (
        <li key={appointment.id} className={`rounded-xl px-3 py-2 ${index === 0 ? theme.rowAlt : theme.row}`}>
          {index === 0 ? (
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme.subtle}`}>Next</p>
          ) : null}
          <p className={`text-sm font-semibold ${theme.text}`}>{appointment.title}</p>
          <p className={`text-sm tabular-nums ${theme.muted}`}>{appointment.whenLabel}</p>
          {appointment.calendarName ? (
            <p className={`text-xs ${theme.subtle}`}>{appointment.calendarName}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MonthGrid({
  cursor,
  setCursor,
  selectedIso,
  asOf,
  byDay,
  theme,
  onSelect,
}: {
  cursor: { year: number; month: number };
  setCursor: (next: { year: number; month: number }) => void;
  selectedIso: string;
  asOf: string;
  byDay: Map<string, DailyAppointment[]>;
  theme: DailyTheme;
  onSelect: (iso: string) => void;
}) {
  const cells = buildMonth(cursor.year, cursor.month);
  const title = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className={`rounded-md px-2 py-1 text-sm ${theme.navIdle} ${theme.focus}`}
          onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}
          aria-label="Previous month"
        >
          Prev
        </button>
        <p className={`text-sm font-semibold ${theme.text}`}>{title}</p>
        <button
          type="button"
          className={`rounded-md px-2 py-1 text-sm ${theme.navIdle} ${theme.focus}`}
          onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}
          aria-label="Next month"
        >
          Next
        </button>
      </div>
      <div className={`grid grid-cols-7 gap-1 text-center text-[11px] font-semibold ${theme.subtle}`}>
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = byDay.get(cell.iso)?.length ?? 0;
          const selected = cell.iso === selectedIso;
          const today = cell.iso === asOf;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => {
                if (!cell.inMonth) setCursor({ year: cell.year, month: cell.month });
                onSelect(cell.iso);
              }}
              className={`flex h-10 flex-col items-center justify-center rounded-lg text-xs tabular-nums ${theme.focus} ${
                selected ? theme.navActive : theme.navIdle
              } ${today && !selected ? "ring-1 ring-current" : ""} ${cell.inMonth ? "" : "opacity-40"}`}
            >
              <span>{cell.day}</span>
              {count > 0 ? <span className="text-[9px]">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function buildMonth(year: number, month: number) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: { iso: string; day: number; inMonth: boolean; year: number; month: number }[] = [];
  const prev = shiftMonth(year, month, -1);
  const prevCount = new Date(Date.UTC(prev.year, prev.month, 0)).getUTCDate();
  for (let i = 0; i < firstDow; i++) {
    const day = prevCount - firstDow + 1 + i;
    cells.push({
      day,
      inMonth: false,
      year: prev.year,
      month: prev.month,
      iso: formatIsoDate(prev.year, prev.month, day),
    });
  }
  for (let day = 1; day <= count; day++) {
    cells.push({ day, inMonth: true, year, month, iso: formatIsoDate(year, month, day) });
  }
  const next = shiftMonth(year, month, 1);
  let spill = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: spill,
      inMonth: false,
      year: next.year,
      month: next.month,
      iso: formatIsoDate(next.year, next.month, spill),
    });
    spill += 1;
  }
  return cells;
}
