"use client";

import { DashboardDatePicker } from "@/components/customer/DashboardDatePicker";

/** Custom from/to fields — nest inside the reporting period panel (`embedded`). */
export function ReportingPeriodCustomRange({
  customStart,
  customEnd,
  maxDate,
  onStartChange,
  onEndChange,
  embedded = false,
}: {
  customStart: string;
  customEnd: string;
  maxDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  embedded?: boolean;
}) {
  const fields = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
      <DashboardDatePicker
        label="From"
        value={customStart}
        max={maxDate}
        onChange={onStartChange}
      />
      <div
        className="hidden shrink-0 pb-2.5 text-sm font-medium text-white/45 sm:block"
        aria-hidden
      >
        to
      </div>
      <DashboardDatePicker label="To" value={customEnd} max={maxDate} onChange={onEndChange} />
    </div>
  );

  if (embedded) {
    return <div className="relative z-20 px-1 pb-1 pt-2">{fields}</div>;
  }

  return (
    <div className="mt-2 rounded-xl border border-white/25 bg-white/10 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-3">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
        Custom range
      </p>
      {fields}
    </div>
  );
}
