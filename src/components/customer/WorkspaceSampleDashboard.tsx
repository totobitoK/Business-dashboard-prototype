"use client";

import type { ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { getWorkspaceSampleData } from "@/lib/workspace-sample-data";

export function WorkspaceSampleDashboard({ compact }: { compact?: boolean }) {
  const { workspaceId, theme, settings } = useCustomerPortal();
  const data = getWorkspaceSampleData(workspaceId);
  const maxTrend = Math.max(...data.trend.map((t) => t.amount));

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-card ${theme.card}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
        <p className="text-sm font-semibold">{workspaceId.includes("hvac") ? "Operations dashboard" : "Retail pulse"}</p>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          Sample data — not live
        </span>
      </div>

      <div className={`grid gap-3 p-4 ${compact || settings.showCompactMetrics ? "sm:grid-cols-3" : "sm:grid-cols-3"} sm:p-5`}>
        <MetricTile
          label="Payments received"
          sub={data.periodLabel}
          value={<CurrencyAmount amount={data.paymentsReceived} className="text-2xl font-bold" />}
          box={theme.metricA}
          valueClass={theme.metricValueA}
        />
        <MetricTile
          label="Outstanding invoices"
          sub="Open balances"
          value={<CurrencyAmount amount={data.outstandingInvoices} className="text-2xl font-bold" />}
          box={theme.metricB}
          valueClass={theme.metricValueB}
        />
        <MetricTile
          label="Upcoming"
          sub="Scheduled items"
          value={
            <span className={`text-2xl font-bold ${theme.metricValueA}`}>
              {data.upcomingAppointments}
            </span>
          }
          box={theme.metricA}
          valueClass={theme.metricValueA}
        />
      </div>

      <div className="grid gap-4 border-t border-purple-100/80 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div className={`rounded-xl border p-3 ${theme.chartPanel}`}>
          <h3 className="text-sm font-semibold text-ink">Payments trend</h3>
          <ul className="mt-3 flex items-end justify-between gap-1" aria-hidden>
            {data.trend.map((bar, i) => (
              <li key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full max-w-[1.75rem] rounded-t ${
                    i === data.trend.length - 1 ? theme.chartBarHi : theme.chartBar
                  }`}
                  style={{
                    height: `${Math.max(10, Math.round((bar.amount / maxTrend) * 48))}px`,
                  }}
                />
                <span className="text-[9px] font-medium text-ink">{bar.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`rounded-xl border p-3 ${theme.listPanel}`}>
          <h3 className="text-sm font-semibold text-ink">Appointment list</h3>
          <ul className="mt-2 space-y-1.5">
            {data.appointments.map((appt) => (
              <li key={appt.id} className={`rounded-md border px-2 py-1.5 ${theme.listRow}`}>
                <p className={`text-[10px] font-bold ${theme.listAccent}`}>
                  {appt.date} · {appt.time}
                </p>
                <p className="text-xs font-medium text-ink">{appt.title}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-purple-100/80 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-ink">Open invoices</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-purple-100 text-xs font-semibold uppercase tracking-wide text-ink">
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-purple-50">
                  <td className="py-2 pr-3 font-medium text-ink">{inv.customer}</td>
                  <td className="py-2 pr-3 text-ink">{inv.dueDate}</td>
                  <td className="py-2 pr-3">
                    <CurrencyAmount amount={inv.amount} />
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        inv.status === "Past due"
                          ? "bg-amber-100 text-amber-900"
                          : inv.status === "Open"
                            ? "bg-purple-50 text-purple-dark"
                            : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  sub,
  value,
  box,
  valueClass,
}: {
  label: string;
  sub: string;
  value: ReactNode;
  box: string;
  valueClass: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${box}`}>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-[10px] font-medium text-ink">{sub}</p>
      <div className={`mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}
