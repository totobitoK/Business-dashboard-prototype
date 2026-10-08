"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  DEMO_AS_OF_DATE,
  getWorkspaceBusinessData,
  type ReportingPeriodKey,
} from "@/lib/workspace-business-data";
import {
  buildTrendFromPayments,
  countUpcomingAppointments,
  filterInvoicesBySearch,
  getReportingPeriodLabel,
  sumOutstandingInvoices,
  sumPaymentsInPeriod,
} from "@/lib/workspace-analytics";
import type { DashboardWidgetId } from "@/lib/workspace-widget-layout";

const UPCOMING_WINDOW_DAYS = 7;

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function formatShortDate(iso: string): string {
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
}

export function WorkspaceSampleDashboard({
  changesRequestedNote,
}: {
  changesRequestedNote?: string;
}) {
  const { workspaceId, theme, settings, workspaceSessionKey } = useCustomerPortal();
  const data = getWorkspaceBusinessData(workspaceId);
  const [period, setPeriod] = useState<ReportingPeriodKey>("mtd");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    null
  );

  const compact = settings.showCompactMetrics;
  const density = compact ? "gap-2 p-3 text-xs" : "gap-3 p-4 sm:p-5";

  const computed = useMemo(() => {
    if (!data) return null;
    const paymentsReceived = sumPaymentsInPeriod(data.payments, period);
    const outstanding = sumOutstandingInvoices(data.invoices);
    const upcoming = countUpcomingAppointments(
      data.appointments,
      UPCOMING_WINDOW_DAYS
    );
    const trend = buildTrendFromPayments(data);
    const invoices = filterInvoicesBySearch(data.invoices, invoiceSearch);
    const upcomingList = [...data.appointments]
      .filter((a) => {
        const d = new Date(a.startAt);
        const asOf = new Date(`${DEMO_AS_OF_DATE}T23:59:59`);
        const end = new Date(asOf);
        end.setDate(end.getDate() + UPCOMING_WINDOW_DAYS);
        return d >= asOf && d <= end;
      })
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    return {
      paymentsReceived,
      outstanding,
      upcoming,
      trend,
      invoices,
      upcomingList,
    };
  }, [data, period, invoiceSearch]);

  if (!data || !computed) {
    return (
      <p className="text-sm text-ink-muted">
        No sample business records for this workspace.
      </p>
    );
  }

  const maxTrend = Math.max(...computed.trend.map((t) => t.amount), 1);
  const selectedInvoice = data.invoices.find((i) => i.id === selectedInvoiceId);
  const selectedAppointment = data.appointments.find(
    (a) => a.id === selectedAppointmentId
  );

  const visibleWidgets = settings.widgetOrder.filter(
    (id) => !settings.hiddenWidgets.includes(id)
  );

  const widgetBlocks: Record<DashboardWidgetId, ReactNode> = {
    metrics: (
      <div
        key="metrics"
        className={`grid ${compact ? "gap-2 sm:grid-cols-3" : "gap-3 sm:grid-cols-3"} ${compact ? "p-3" : "p-4 sm:p-5"}`}
      >
        <MetricTile
          compact={compact}
          label="Payments received"
          sub={getReportingPeriodLabel(period)}
          value={
            <CurrencyAmount
              amount={computed.paymentsReceived}
              className={compact ? "text-xl font-bold" : "text-2xl font-bold"}
            />
          }
          box={theme.metricA}
          valueClass={theme.metricValueA}
        />
        <MetricTile
          compact={compact}
          label="Outstanding invoices"
          sub={`Open balances as of ${formatShortDate(DEMO_AS_OF_DATE)} (demo)`}
          value={
            <CurrencyAmount
              amount={computed.outstanding}
              className={compact ? "text-xl font-bold" : "text-2xl font-bold"}
            />
          }
          box={theme.metricB}
          valueClass={theme.metricValueB}
        />
        <MetricTile
          compact={compact}
          label="Upcoming appointments"
          sub={`Next ${UPCOMING_WINDOW_DAYS} days from demo as-of ${formatShortDate(DEMO_AS_OF_DATE)}`}
          value={
            <span
              className={`font-bold ${compact ? "text-xl" : "text-2xl"} ${theme.metricValueA}`}
            >
              {computed.upcoming}
            </span>
          }
          box={theme.metricA}
          valueClass={theme.metricValueA}
        />
      </div>
    ),
    trend: (
      <div
        key="trend"
        className={`rounded-xl border ${compact ? "p-2" : "p-3"} ${theme.chartPanel}`}
      >
        <h3 className="text-sm font-semibold text-ink">Payments trend</h3>
        <p className="text-[10px] text-ink-muted">Recent payments (sample)</p>
        <ul className="mt-3 flex items-end justify-between gap-1" aria-hidden>
          {computed.trend.map((bar, i) => (
            <li key={bar.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full max-w-[1.75rem] rounded-t ${
                  i === computed.trend.length - 1 ? theme.chartBarHi : theme.chartBar
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
    ),
    appointments: (
      <div
        key="appointments"
        className={`rounded-xl border ${compact ? "p-2" : "p-3"} ${theme.listPanel}`}
      >
        <h3 className="text-sm font-semibold text-ink">Appointment list</h3>
        <ul className="mt-2 space-y-1.5">
          {computed.upcomingList.map((appt) => {
            const { date, time } = formatDateTime(appt.startAt);
            return (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentId(appt.id);
                    setSelectedInvoiceId(null);
                  }}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:border-purple-200 ${
                    selectedAppointmentId === appt.id
                      ? "border-purple bg-purple-50/50"
                      : theme.listRow
                  }`}
                >
                  <p className={`text-[10px] font-bold ${theme.listAccent}`}>
                    {date} · {time}
                  </p>
                  <p className="text-xs font-medium text-ink">{appt.title}</p>
                  <p className="text-[10px] text-ink-muted">
                    {appt.sourceLabel} · Last sync (simulated): Mar 12, 2026 6:00 AM
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ),
    invoices: (
      <div key="invoices" className={compact ? "px-3 py-3" : "px-4 py-4 sm:px-5"}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Open invoices</h3>
          <label className="text-xs text-ink">
            <span className="sr-only">Search invoices</span>
            <input
              type="search"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Search customer or invoice…"
              className="rounded-lg border border-purple-100 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-purple-100 text-xs font-semibold uppercase tracking-wide text-ink">
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Balance</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {computed.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`cursor-pointer border-b border-purple-50 hover:bg-purple-50/40 ${
                    selectedInvoiceId === inv.id ? "bg-purple-50/60" : ""
                  }`}
                  onClick={() => {
                    setSelectedInvoiceId(inv.id);
                    setSelectedAppointmentId(null);
                  }}
                >
                  <td className="py-2 pr-3 font-medium text-ink">{inv.customer}</td>
                  <td className="py-2 pr-3 text-ink">{formatShortDate(inv.dueDate)}</td>
                  <td className="py-2 pr-3">
                    <CurrencyAmount amount={inv.balanceDue} />
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
        <p className="mt-2 text-[10px] text-ink-muted">
          Source: QuickBooks / Sheets (simulated) · Demo as-of {DEMO_AS_OF_DATE}
        </p>
      </div>
    ),
  };

  return (
    <div
      key={`${workspaceId}-${workspaceSessionKey}`}
      className={`overflow-hidden rounded-2xl border shadow-card ${theme.card}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
        <p className="text-sm font-semibold">
          {workspaceId.includes("hvac") ? "Operations dashboard" : "Retail pulse"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-medium">
            <span className="opacity-90">Reporting period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as ReportingPeriodKey)}
              className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-[10px] text-inherit"
            >
              <option value="mtd">MTD</option>
              <option value="last30">Last 30 days</option>
              <option value="last7">Last 7 days</option>
            </select>
          </label>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Sample data · as of {DEMO_AS_OF_DATE}
          </span>
        </div>
      </div>

      {changesRequestedNote && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-ink">
          {changesRequestedNote}
        </p>
      )}

      {visibleWidgets.includes("metrics") && widgetBlocks.metrics}

      {(visibleWidgets.includes("trend") || visibleWidgets.includes("appointments")) && (
        <div
          className={`grid border-t border-purple-100/80 ${density} sm:grid-cols-2`}
        >
          {visibleWidgets.includes("trend") && widgetBlocks.trend}
          {visibleWidgets.includes("appointments") && widgetBlocks.appointments}
        </div>
      )}

      {visibleWidgets.includes("invoices") && (
        <div className="border-t border-purple-100/80">{widgetBlocks.invoices}</div>
      )}

      {(selectedInvoice || selectedAppointment) && (
        <div className="border-t border-purple-100/80 bg-white/80 px-4 py-4 sm:px-5">
          {selectedInvoice && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple">
                Invoice detail (read-only)
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {selectedInvoice.customer} — {selectedInvoice.id}
              </p>
              <p className="mt-2 text-sm text-ink">{selectedInvoice.lineSummary}</p>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Issued</dt>
                  <dd>{formatShortDate(selectedInvoice.issueDate)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Due</dt>
                  <dd>{formatShortDate(selectedInvoice.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Balance due</dt>
                  <dd>
                    <CurrencyAmount amount={selectedInvoice.balanceDue} />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Source</dt>
                  <dd>
                    {selectedInvoice.sourceLabel} · sync Mar 12, 2026 6:00 AM (simulated)
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {selectedAppointment && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple">
                Appointment detail (read-only)
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {selectedAppointment.title}
              </p>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">When</dt>
                  <dd>
                    {formatDateTime(selectedAppointment.startAt).date} at{" "}
                    {formatDateTime(selectedAppointment.startAt).time}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Location</dt>
                  <dd>{selectedAppointment.location}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Assignee</dt>
                  <dd>{selectedAppointment.assignee}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Source</dt>
                  <dd>
                    {selectedAppointment.sourceLabel} · sync Mar 12, 2026 6:00 AM
                    (simulated)
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  sub,
  value,
  box,
  valueClass,
  compact,
}: {
  label: string;
  sub: string;
  value: ReactNode;
  box: string;
  valueClass: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl border ${compact ? "p-2" : "p-3"} ${box}`}>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-[10px] font-medium text-ink">{sub}</p>
      <div className={`mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}
