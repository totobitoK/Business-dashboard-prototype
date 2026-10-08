import { MARKETING_DATA_SOURCES } from "@/lib/marketing-data-sources";

/**
 * Static illustrative HVAC dashboard — not connected to live data or the internal CRM.
 */
export function HvacDashboardPreview() {
  const trend = [
    { label: "Aug", amount: 38200 },
    { label: "Sep", amount: 42100 },
    { label: "Oct", amount: 46800 },
    { label: "Nov", amount: 44200 },
    { label: "Dec", amount: 43900 },
    { label: "Jan", amount: 46100 },
    { label: "Feb", amount: 48250 },
  ];
  const maxTrend = Math.max(...trend.map((t) => t.amount));
  const barColors = [
    "bg-purple-300",
    "bg-purple-400",
    "bg-purple",
    "bg-purple-light",
    "bg-purple-400",
    "bg-purple",
    "bg-purple-dark",
  ];

  const appointments = [
    { date: "Wed, Mar 12", time: "8:00 AM", title: "Seasonal maintenance — Garcia residence" },
    { date: "Wed, Mar 12", time: "11:30 AM", title: "Estimate — Northside Office Park" },
    { date: "Thu, Mar 13", time: "9:15 AM", title: "Service call — Kim household" },
  ];
  const appointmentStyles = [
    "border-purple-200 bg-purple-50/90",
    "border-purple-300/60 bg-purple-100/50",
    "border-purple-200 bg-purple-50/70",
  ];
  const upcomingTotal = 7;
  const moreAppointments = upcomingTotal - appointments.length;

  const pillStyles = [
    "border-purple-200 bg-purple-50 text-purple-dark",
    "border-purple-300/70 bg-purple-100/80 text-ink",
    "border-purple-200 bg-white text-purple-dark",
    "border-purple-300/50 bg-purple-50 text-ink",
    "border-purple-200 bg-purple-100/60 text-purple-dark",
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-purple-100/40 shadow-card">
      <div className="border-b border-purple-200/80 bg-gradient-to-r from-purple to-purple-dark px-4 py-2.5 sm:px-5">
        <p className="text-center text-sm font-semibold text-white sm:text-left">
          Illustrative HVAC dashboard • Sample data
        </p>
      </div>

      <div className="border-b border-purple-100 bg-purple-50/40 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {MARKETING_DATA_SOURCES.map((source, i) => (
            <SourcePill
              key={source.id}
              label={source.label}
              className={pillStyles[i % pillStyles.length]}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-medium text-ink">
          Preview only — not connected to live integrations.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <MetricCard
          label="Payments received"
          sublabel="Month to date"
          value="$48,250"
          hint="QuickBooks payments MTD"
          tone="mint"
        />
        <MetricCard
          label="Outstanding invoices"
          sublabel="Open balances"
          value="$12,840"
          hint="Open balances in QuickBooks"
          tone="purple"
        />
        <MetricCard
          label="Upcoming appointments"
          sublabel="Next 7 days"
          value="7"
          hint="Google Calendar events"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 border-t border-purple-100 bg-white/60 px-4 py-3.5 sm:grid-cols-2 sm:px-5 sm:py-4">
        <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3">
          <h3 className="text-sm font-semibold text-ink">Payments trend</h3>
          <p className="mt-0.5 text-xs font-medium text-purple-dark">Last 7 months (sample)</p>
          <ul className="mt-4 flex items-end justify-between gap-1 sm:gap-2" aria-hidden>
            {trend.map((bar, i) => (
              <li key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full max-w-[2.25rem] rounded-t ${barColors[i]} ${
                    i === trend.length - 1 ? "ring-2 ring-purple-200 ring-offset-1" : ""
                  }`}
                  style={{
                    height: `${Math.max(12, Math.round((bar.amount / maxTrend) * 56))}px`,
                  }}
                />
                <span className="text-[10px] font-medium text-ink">{bar.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-purple-100 bg-purple-50/20 p-3">
          <h3 className="text-sm font-semibold text-ink">Appointment list</h3>
          <p className="mt-0.5 text-xs font-medium text-purple-dark">From calendar — scheduling only</p>
          <ul className="mt-3 space-y-2">
            {appointments.map((appt, i) => (
              <li
                key={`${appt.date}-${appt.time}-${appt.title}`}
                className={`rounded-lg border px-3 py-1.5 ${appointmentStyles[i % appointmentStyles.length]}`}
              >
                <p className="text-xs font-semibold text-purple-dark">
                  {appt.date} · {appt.time}
                </p>
                <p className="mt-0.5 text-sm font-medium text-ink">{appt.title}</p>
              </li>
            ))}
          </ul>
          {moreAppointments > 0 && (
            <p className="mt-2 text-xs font-semibold text-purple">
              +{moreAppointments} more this week
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SourcePill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className ?? "border-purple-200 bg-white text-ink"}`}
    >
      {label}
    </span>
  );
}

function MetricCard({
  label,
  sublabel,
  value,
  hint,
  tone,
}: {
  label: string;
  sublabel: string;
  value: string;
  hint: string;
  tone: "mint" | "purple" | "violet";
}) {
  const tones = {
    mint: {
      box: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white",
      value: "text-emerald-700",
    },
    purple: {
      box: "border-purple-300/80 bg-gradient-to-br from-purple-100/90 to-purple-50/50",
      value: "text-purple-dark",
    },
    violet: {
      box: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-50/40",
      value: "text-purple",
    },
  };
  const t = tones[tone];

  return (
    <div className={`rounded-xl border p-3 shadow-sm sm:p-3.5 ${t.box}`}>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-[11px] font-medium text-ink">{sublabel}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${t.value}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-snug font-medium text-ink">{hint}</p>
    </div>
  );
}
