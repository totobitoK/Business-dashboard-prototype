"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePopupPresence } from "@/components/customer/dashboard-controls";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";

type AccentCalendar = {
  button: string;
  panel: string;
  muted: string;
  control: string;
  range: string;
  endpoint: string;
  idle: string;
  disabled: string;
};

function accentCalendar(id: string): AccentCalendar | null {
  if (id === "ocean") {
    return {
      button: "border-[#3c2a1e] bg-[#3c2a1e] text-[#f7f3ee] hover:bg-[#4a3428] focus:ring-[#6b4f3a]/40",
      panel: "rounded-xl border border-[#5a4334] bg-[#3c2a1e] py-1 text-[#f7f3ee] shadow-[0_12px_32px_-12px_rgba(60,42,30,0.45)]",
      muted: "text-[#f7f3ee]/75",
      control: "text-[#f7f3ee] hover:bg-[#4a3428]",
      range: "bg-[#5a4334] text-xs text-[#f7f3ee]",
      endpoint: "bg-[#f7f3ee] text-sm text-[#3c2a1e]",
      idle: "text-xs text-[#f7f3ee] hover:bg-[#4a3428]",
      disabled: "cursor-not-allowed text-xs text-[#f7f3ee]/30",
    };
  }
  if (id === "harbor") {
    return {
      button: "border-[#1e3a5f] bg-[#1e3a5f] text-[#f4f7fb] hover:bg-[#2a4d73] focus:ring-[#8aa4c0]/40",
      panel: "rounded-xl border border-[#2a4d73] bg-[#1e3a5f] py-1 text-[#f4f7fb] shadow-[0_12px_32px_-12px_rgba(30,58,95,0.45)]",
      muted: "text-[#f4f7fb]/75",
      control: "text-[#f4f7fb] hover:bg-[#2a4d73]",
      range: "bg-[#2a4d73] text-xs text-[#f4f7fb]",
      endpoint: "bg-[#f4f7fb] text-sm text-[#1e3a5f]",
      idle: "text-xs text-[#f4f7fb] hover:bg-[#2a4d73]",
      disabled: "cursor-not-allowed text-xs text-[#f4f7fb]/30",
    };
  }
  if (id === "ash") {
    return {
      button: "border-[#2c2c2c] bg-[#2c2c2c] text-[#f4f4f5] hover:bg-[#3f3f3f] focus:ring-zinc-400/40",
      panel: "rounded-xl border border-[#3f3f3f] bg-[#2c2c2c] py-1 text-[#f4f4f5] shadow-[0_12px_32px_-12px_rgba(44,44,44,0.45)]",
      muted: "text-[#f4f4f5]/75",
      control: "text-[#f4f4f5] hover:bg-[#3f3f3f]",
      range: "bg-[#3f3f3f] text-xs text-[#f4f4f5]",
      endpoint: "bg-[#f4f4f5] text-sm text-[#2c2c2c]",
      idle: "text-xs text-[#f4f4f5] hover:bg-[#3f3f3f]",
      disabled: "cursor-not-allowed text-xs text-[#f4f4f5]/30",
    };
  }
  return null;
}
import {
  BUSINESS_TIMEZONE,
  compareIsoDates,
  formatCalendarDateDisplay,
  formatIsoDate,
  parseIsoDate,
} from "@/lib/workspace-reporting-period";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v2M17 3v2M4 9h16M5 7h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPickerDisplay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  });
}

function monthYearLabel(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthCells(y: number, m: number): (null | { iso: string; day: number })[] {
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (null | { iso: string; day: number })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: formatIsoDate(y, m, d), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
}

export function DashboardDatePicker({
  label,
  value,
  max,
  onChange,
  theme,
}: {
  label: string;
  value: string;
  max: string;
  onChange: (iso: string) => void;
  theme: LayoutCustomizeTheme;
}) {
  const parsed = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const popup = usePopupPresence(open);
  const [viewY, setViewY] = useState(parsed.y);
  const [viewM, setViewM] = useState(parsed.m);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setViewY(parsed.y);
    setViewM(parsed.m);
  }, [open, parsed.y, parsed.m]);

  useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const maxParsed = parseIsoDate(max);
  const canGoNext =
    viewY < maxParsed.y || (viewY === maxParsed.y && viewM < maxParsed.m);
  const canGoPrev = viewY > 2020;

  const cells = useMemo(() => buildMonthCells(viewY, viewM), [viewY, viewM]);

  function selectDate(iso: string) {
    if (compareIsoDates(iso, max) > 0) return;
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative z-30 flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
        {label}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-white/50 ${theme.swatchRing} ${theme.metricValueA}`}
      >
        <span>{formatPickerDisplay(value)}</span>
        <CalendarIcon className={`shrink-0 ${theme.metricValueB}`} />
      </button>

      {popup.present && (
        <div
          role="dialog"
          aria-label={`Choose ${label} date`}
          ref={popup.panelRef}
          className={`absolute right-0 top-full z-[100] mt-1.5 w-[16.75rem] origin-top overflow-hidden p-2 ${theme.filterMenuPanel}`}
        >
          <div className="mb-1 flex items-center justify-between gap-1">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => {
                const next = shiftMonth(viewY, viewM, -1);
                setViewY(next.y);
                setViewM(next.m);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition disabled:opacity-30 ${theme.metricValueA} ${theme.filterMenuItemIdle}`}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className={`text-xs font-semibold ${theme.metricValueA}`}>{monthYearLabel(viewY, viewM)}</p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => {
                const next = shiftMonth(viewY, viewM, 1);
                setViewY(next.y);
                setViewM(next.m);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition disabled:opacity-30 ${theme.metricValueA} ${theme.filterMenuItemIdle}`}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className={`pb-0.5 text-[9px] font-bold uppercase tracking-wide ${theme.detailSectionLabel}`}
              >
                {d}
              </span>
            ))}
            {cells.map((cell, idx) => {
              if (!cell) {
                return <span key={`empty-${idx}`} className="h-7" aria-hidden />;
              }
              const disabled = compareIsoDates(cell.iso, max) > 0;
              const selected = cell.iso === value;
              const isMaxDay = cell.iso === max;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDate(cell.iso)}
                  className={`flex h-7 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    selected
                      ? theme.navActive
                      : disabled
                        ? "cursor-not-allowed text-ink-muted/35"
                        : isMaxDay
                          ? `${theme.filterMenuItemActive} ring-1 ${theme.swatchRing}`
                          : theme.filterMenuItemIdle
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className={`mt-1.5 flex items-center justify-between border-t pt-1.5 ${theme.toolbarDivider}`}>
            <button
              type="button"
              className={`text-xs font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${theme.filterChipActive}`}
              onClick={() => selectDate(max)}
            >
            Latest demo day
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

const RANGE_CALENDAR_MAX = "2026-12-31";

/** Two-click range: first day starts the range, the next day — in this month or another — ends it. */
export function DashboardRangeCalendar({
  start,
  end,
  onChange,
  theme,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  theme: LayoutCustomizeTheme;
}) {
  const parsed = parseIsoDate(start);
  const [open, setOpen] = useState(false);
  const popup = usePopupPresence(open);
  const [picking, setPicking] = useState<string | null>(null);
  const [viewY, setViewY] = useState(parsed.y);
  const [viewM, setViewM] = useState(parsed.m);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setViewY(parsed.y);
    setViewM(parsed.m);
    setPicking(null);
  }, [open, parsed.y, parsed.m]);

  useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const maxParsed = parseIsoDate(RANGE_CALENDAR_MAX);
  const canGoNext = viewY < maxParsed.y || (viewY === maxParsed.y && viewM < maxParsed.m);
  const canGoPrev = viewY > 2024;
  const cells = useMemo(() => buildMonthCells(viewY, viewM), [viewY, viewM]);

  function choose(iso: string) {
    if (compareIsoDates(iso, RANGE_CALENDAR_MAX) > 0) return;
    if (!picking) {
      setPicking(iso);
      return;
    }
    const rangeStart = compareIsoDates(picking, iso) <= 0 ? picking : iso;
    const rangeEnd = compareIsoDates(picking, iso) <= 0 ? iso : picking;
    onChange(rangeStart, rangeEnd);
    setPicking(null);
    setOpen(false);
  }

  const label = `${formatCalendarDateDisplay(start)} – ${formatCalendarDateDisplay(end)}`;
  const accent = accentCalendar(theme.id);

  return (
    <div ref={rootRef} className="relative max-w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Reporting period ${label}. Choose a start day, then an end day.`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 ${
          accent
            ? accent.button
            : "border-white/30 bg-white/15 text-white hover:bg-white/25 focus:ring-white/50"
        }`}
      >
        <CalendarIcon className="shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </button>

      {popup.present && (
        <div
          role="dialog"
          aria-label="Choose reporting period"
          ref={popup.panelRef}
          className={`absolute right-0 top-full z-[100] mt-1.5 w-[16.75rem] origin-top overflow-hidden p-2 ${
            accent ? accent.panel : theme.filterMenuPanel
          }`}
        >
          <p className={`px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide ${
            accent ? accent.muted : theme.detailSectionLabel
          }`}>
            {picking ? "Choose the end day" : "Choose the start day"}
          </p>
          <div className="mb-1 flex items-center justify-between gap-1">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => {
                const next = shiftMonth(viewY, viewM, -1);
                setViewY(next.y);
                setViewM(next.m);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition disabled:opacity-30 ${
                accent ? accent.control : `${theme.metricValueA} ${theme.filterMenuItemIdle}`
              }`}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className={`text-xs font-semibold ${accent ? accent.control : theme.metricValueA}`}>{monthYearLabel(viewY, viewM)}</p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => {
                const next = shiftMonth(viewY, viewM, 1);
                setViewY(next.y);
                setViewM(next.m);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition disabled:opacity-30 ${
                accent ? accent.control : `${theme.metricValueA} ${theme.filterMenuItemIdle}`
              }`}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className={`pb-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  accent ? accent.muted : theme.detailSectionLabel
                }`}
              >
                {d}
              </span>
            ))}
            {cells.map((cell, idx) => {
              if (!cell) return <span key={`empty-${idx}`} className="h-8" aria-hidden />;
              const disabled = compareIsoDates(cell.iso, RANGE_CALENDAR_MAX) > 0;
              const isPickedStart = picking === cell.iso;
              const inRange =
                !picking &&
                compareIsoDates(cell.iso, start) >= 0 &&
                compareIsoDates(cell.iso, end) <= 0;
              const isEndpoint = isPickedStart || (!picking && (cell.iso === start || cell.iso === end));
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(cell.iso)}
                  className={`flex h-8 items-center justify-center rounded-lg font-semibold transition ${
                    accent
                      ? isEndpoint
                        ? accent.endpoint
                        : inRange
                          ? accent.range
                          : disabled
                            ? accent.disabled
                            : accent.idle
                      : isEndpoint
                        ? `text-sm ${theme.navActive}`
                        : inRange
                          ? `text-xs ${theme.filterMenuItemActive}`
                          : disabled
                            ? "cursor-not-allowed text-xs text-ink-muted/35"
                            : `text-xs ${theme.filterMenuItemIdle}`
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
