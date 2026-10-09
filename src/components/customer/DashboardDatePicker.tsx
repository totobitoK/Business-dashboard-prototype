"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUSINESS_TIMEZONE,
  compareIsoDates,
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
}: {
  label: string;
  value: string;
  max: string;
  onChange: (iso: string) => void;
}) {
  const parsed = parseIsoDate(value);
  const [open, setOpen] = useState(false);
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
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-purple-100/80 bg-white px-3 py-2 text-left text-sm font-semibold text-purple-dark shadow-sm transition hover:border-purple-200 focus:outline-none focus:ring-2 focus:ring-white/50"
      >
        <span>{formatPickerDisplay(value)}</span>
        <CalendarIcon className="shrink-0 text-purple/55" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label} date`}
          className="absolute right-0 top-full z-[100] mt-1.5 w-[16.75rem] origin-top-right overflow-hidden rounded-xl border border-purple-200/90 bg-gradient-to-b from-white via-white to-purple-50/90 p-2 shadow-[0_12px_32px_-12px_rgba(124,58,237,0.35)] ring-1 ring-purple-100"
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
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-purple-dark transition hover:bg-purple-100 disabled:opacity-30"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-xs font-semibold text-purple-dark">{monthYearLabel(viewY, viewM)}</p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => {
                const next = shiftMonth(viewY, viewM, 1);
                setViewY(next.y);
                setViewM(next.m);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-purple-dark transition hover:bg-purple-100 disabled:opacity-30"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="pb-0.5 text-[9px] font-bold uppercase tracking-wide text-purple/60"
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
                      ? "bg-purple text-white shadow-md shadow-purple/30"
                      : disabled
                        ? "cursor-not-allowed text-ink-muted/35"
                        : isMaxDay
                          ? "bg-purple-100/80 text-purple-dark ring-1 ring-purple-200"
                          : "text-ink hover:bg-purple-100/70"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-purple-100/80 pt-1.5">
            <button
              type="button"
              className="text-xs font-semibold text-purple/70 hover:text-purple-dark"
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-purple/10 px-2 py-0.5 text-[11px] font-semibold text-purple-dark hover:bg-purple/15"
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
