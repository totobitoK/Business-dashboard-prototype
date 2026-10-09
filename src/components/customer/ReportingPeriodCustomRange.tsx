"use client";

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
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

function DateField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative z-20 flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
        {label}
      </span>
      <div className="relative isolate">
        <input
          type="date"
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="reporting-period-date w-full min-w-0 rounded-lg border border-purple-100/80 bg-white px-3 py-2 pr-9 text-sm font-semibold text-purple-dark shadow-sm [color-scheme:light] transition hover:border-purple-200 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-white/50"
        />
        <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-purple/50" />
      </div>
    </label>
  );
}

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
      <DateField label="From" value={customStart} max={maxDate} onChange={onStartChange} />
      <div
        className="hidden shrink-0 pb-2.5 text-sm font-medium text-white/45 sm:block"
        aria-hidden
      >
        to
      </div>
      <DateField label="To" value={customEnd} max={maxDate} onChange={onEndChange} />
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
