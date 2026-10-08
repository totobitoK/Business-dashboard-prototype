import { MARKETING_DATA_SOURCES } from "@/lib/marketing-data-sources";

/** Static marketing illustrations — HTML/CSS only, sample data. */

export function FragmentedToolsVisual() {
  const tools = [
    {
      label: "QuickBooks",
      box: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40",
      text: "text-emerald-900",
    },
    {
      label: "Calendar",
      box: "border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/50",
      text: "text-sky-900",
    },
    {
      label: "Sheets",
      box: "border-green-200 bg-gradient-to-br from-green-50 to-lime-50/80",
      text: "text-green-900",
    },
    {
      label: "Inbox",
      box: "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60",
      text: "text-amber-950",
    },
  ];
  return (
    <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/30 p-5 shadow-soft">
      <p className="text-sm font-semibold text-ink">Before: scattered tools</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {tools.map((t) => (
          <div
            key={t.label}
            className={`rounded-xl border px-3 py-4 text-center text-sm font-semibold shadow-sm ${t.box} ${t.text}`}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className="my-4 flex justify-center text-purple" aria-hidden>
        ↓
      </div>
      <div className="rounded-xl border-2 border-purple bg-gradient-to-r from-purple-100/80 via-purple-50 to-violet-100/70 px-4 py-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-purple-dark">One dashboard</p>
        <p className="mt-1 text-xs font-medium text-ink">
          Revenue · Invoices · Schedule
        </p>
      </div>
    </div>
  );
}

export function UnifiedMetricsVisual() {
  const metrics = [
    {
      label: "Revenue MTD",
      value: "$124K",
      box: "border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-white",
      valueClass: "text-emerald-700",
    },
    {
      label: "Open invoices",
      value: "$18K",
      box: "border-violet-200/90 bg-gradient-to-br from-violet-50 to-purple-50/40",
      valueClass: "text-purple-dark",
    },
    {
      label: "Jobs this week",
      value: "23",
      box: "border-sky-200/90 bg-gradient-to-br from-sky-50 to-white",
      valueClass: "text-sky-800",
    },
    {
      label: "Utilization",
      value: "87%",
      box: "border-purple-300/70 bg-gradient-to-br from-purple-100/80 to-purple-50",
      valueClass: "text-purple",
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-violet-50/40 shadow-card">
      <div className="border-b border-purple-200/60 bg-gradient-to-r from-purple to-purple-dark px-6 py-3 sm:px-7">
        <p className="text-base font-semibold text-white">Sample unified view</p>
      </div>
      <div className="p-6 sm:p-7">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className={`rounded-xl border p-4 shadow-sm ${m.box}`}
            >
              <p className="text-sm font-semibold text-ink">{m.label}</p>
              <p
                className={`mt-1.5 text-2xl font-semibold sm:text-[1.75rem] ${m.valueClass}`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-purple-dark">
          Illustrative metrics — agreed in scope
        </p>
      </div>
    </div>
  );
}

export function ProcessTimelineVisual() {
  const steps = ["Intake", "Discovery", "Scope", "Connect", "Launch"];
  return (
    <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-soft">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((label, i) => (
          <li key={label} className="flex sm:flex-1 sm:flex-col sm:items-center sm:text-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple text-sm font-bold text-white">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="ml-3 text-sm font-semibold text-ink sm:ml-0 sm:mt-2">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function IntegrationsVisual() {
  return (
    <div className="space-y-3">
      {MARKETING_DATA_SOURCES.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-purple-100 bg-white px-4 py-4 shadow-soft"
        >
          <span className="font-semibold text-ink">{item.label}</span>
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple">
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FaqSupportVisual() {
  const points = [
    "Keep your existing software",
    "Custom scope per business",
    "Provider sign-in — no shared passwords",
  ];
  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/30 p-6">
      <p className="text-lg font-semibold text-ink">Built for operators</p>
      <ul className="mt-4 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-sm font-medium text-ink">
            <span className="text-purple" aria-hidden>
              ✓
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
