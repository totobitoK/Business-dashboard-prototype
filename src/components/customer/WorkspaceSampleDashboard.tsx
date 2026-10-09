"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  BUSINESS_TIMEZONE,
  formatRangeForDisplay,
  type ReportingPeriodPreset,
} from "@/lib/workspace-reporting-period";
import {
  DEMO_AS_OF_DATE,
  getWorkspaceBusinessData,
  type BusinessJob,
} from "@/lib/workspace-business-data";
import {
  buildCollectionsTrend,
  countCompletedJobsInRange,
  countOverdueInvoices,
  countUpcomingAppointments,
  filterInvoices,
  filterJobsInRange,
  formatComparisonDelta,
  getComparisonRange,
  invoiceAgingBuckets,
  listUpcomingAppointments,
  oldestUnpaidInvoiceDaysOverdue,
  paymentsForInvoice,
  resolveReportingRange,
  serviceCategoryBreakdown,
  sortInvoices,
  sumOverdueInvoices,
  sumOutstandingInvoices,
  sumPaymentsInRange,
} from "@/lib/workspace-analytics";
import { DashboardWorkspaceNav } from "@/components/customer/DashboardWorkspaceNav";
import { dashboardSectionHref } from "@/lib/dashboard-section-routes";
import { CollectionsTrendChart } from "@/components/customer/CollectionsTrendChart";
import { getOperationsListDensity } from "@/lib/operations-list-density";
import { dashboardRoutes } from "@/lib/routes";
import type { DashboardWidgetId } from "@/lib/workspace-widget-layout";

const INVOICE_PAGE_SIZE = 8;

const REPORTING_PERIOD_OPTIONS: { value: ReportingPeriodPreset; label: string }[] = [
  { value: "last7", label: "7 days" },
  { value: "last30", label: "30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "prev_month", label: "Previous month" },
  { value: "custom", label: "Custom" },
];

const headerFieldClass =
  "rounded-lg border border-white/30 bg-white/95 px-2.5 py-1.5 text-sm font-medium text-ink shadow-sm outline-none transition focus:border-white focus:ring-2 focus:ring-white/40";

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  });
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

const REVENUE_WIDGETS: DashboardWidgetId[] = [
  "metrics",
  "collections_chart",
  "needs_attention",
  "invoices",
];

export function WorkspaceSampleDashboard({
  changesRequestedNote,
  mode = "overview",
}: {
  changesRequestedNote?: string;
  mode?: "overview" | "revenue";
}) {
  const { workspaceId, theme, settings, workspaceSessionKey } = useCustomerPortal();
  const data = getWorkspaceBusinessData(workspaceId);

  const [preset, setPreset] = useState<ReportingPeriodPreset>("mtd");
  const [customStart, setCustomStart] = useState("2026-03-01");
  const [customEnd, setCustomEnd] = useState(DEMO_AS_OF_DATE);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"all" | "Open" | "Past due" | "Paid">("all");
  const [invoiceSort, setInvoiceSort] = useState<"dueDate" | "balance">("dueDate");
  const [invoiceLimit, setInvoiceLimit] = useState(INVOICE_PAGE_SIZE);
  const [insightFocus, setInsightFocus] = useState<"none" | "overdue">("none");

  const [jobStatus, setJobStatus] = useState<"all" | "completed" | "scheduled" | "canceled" | "in_progress">("all");
  const [jobCategory, setJobCategory] = useState("all");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    setInvoiceSearch("");
    setInvoiceStatus("all");
    setInsightFocus("none");
    setSelectedInvoiceId(null);
    setSelectedJobId(null);
    setSelectedAppointmentId(null);
    setInvoiceLimit(INVOICE_PAGE_SIZE);
  }, [workspaceSessionKey]);

  const compact = settings.showCompactMetrics;

  const rangeResult = useMemo(() => {
    const r = resolveReportingRange(preset, customStart, customEnd);
    if (!r.ok) {
      return { error: r.error, range: null as null };
    }
    return { error: null as null, range: r.range };
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    setRangeError(rangeResult.error);
  }, [rangeResult.error]);

  const computed = useMemo(() => {
    if (!data || !rangeResult.range) return null;
    const range = rangeResult.range;
    const compareRange = getComparisonRange(range);

    const paymentsCollected = sumPaymentsInRange(data.payments, range);
    const paymentsPrior = sumPaymentsInRange(data.payments, compareRange);
    const jobsCompleted = countCompletedJobsInRange(data.jobs, range);
    const jobsPrior = countCompletedJobsInRange(data.jobs, compareRange);
    const outstanding = sumOutstandingInvoices(data.invoices);
    const overdue = sumOverdueInvoices(data.invoices);
    const overdueCount = countOverdueInvoices(data.invoices);
    const oldestDays = oldestUnpaidInvoiceDaysOverdue(data.invoices);
    const trend = buildCollectionsTrend(data.payments, range);
    const trendTotal = trend.reduce((s, b) => s + b.amount, 0);
    const aging = invoiceAgingBuckets(data.invoices);
    const categories = serviceCategoryBreakdown(data.jobs, range);

    const statusFilter =
      insightFocus === "overdue" ? ("Past due" as const) : invoiceStatus;

    let invoices = filterInvoices({
      invoices: data.invoices,
      search: invoiceSearch,
      status: statusFilter,
    });
    invoices = sortInvoices(invoices, invoiceSort, invoiceSort === "balance" ? "desc" : "asc");
    const filteredBalance = invoices.reduce((s, i) => s + i.balanceDue, 0);

    const jobs = filterJobsInRange({
      jobs: data.jobs,
      range,
      status: jobStatus,
      category: jobCategory,
    });

    const jobCategories = [...new Set(data.jobs.map((j) => j.category))].sort();

    return {
      range,
      paymentsCollected,
      paymentsCompare: formatComparisonDelta(paymentsCollected, paymentsPrior),
      jobsCompleted,
      jobsCompare: formatComparisonDelta(jobsCompleted, jobsPrior),
      outstanding,
      overdue,
      overdueCount,
      oldestDays,
      trend,
      trendTotal,
      aging,
      categories,
      invoices,
      filteredBalance,
      invoiceTotal: data.invoices.length,
      jobs,
      jobCategories,
      upcoming: countUpcomingAppointments(data.appointments),
      upcomingList: listUpcomingAppointments(data.appointments),
    };
  }, [
    data,
    rangeResult.range,
    invoiceSearch,
    invoiceStatus,
    invoiceSort,
    insightFocus,
    jobStatus,
    jobCategory,
  ]);

  if (!data || !computed) {
    return (
      <p className="text-sm text-ink-muted">
        {rangeError ?? "No sample business records for this workspace."}
      </p>
    );
  }

  const selectedInvoice = data.invoices.find((i) => i.id === selectedInvoiceId);
  const selectedJob = data.jobs.find((j) => j.id === selectedJobId);
  const selectedAppointment = data.appointments.find((a) => a.id === selectedAppointmentId);
  const invoicePayments = selectedInvoice
    ? paymentsForInvoice(data, selectedInvoice.id)
    : [];

  const visibleWidgets =
    mode === "revenue"
      ? REVENUE_WIDGETS.filter((id) => !settings.hiddenWidgets.includes(id))
      : settings.widgetOrder.filter((id) => !settings.hiddenWidgets.includes(id));

  const isHvac = workspaceId.includes("hvac");

  const widgetBlocks: Record<DashboardWidgetId, ReactNode> = {
    metrics: (
      <div
        key="metrics"
        className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-4 ${compact ? "p-3" : "p-4 sm:p-5"}`}
      >
        <KpiCard
          compact={compact}
          label="Payments collected"
          sub={formatRangeForDisplay(computed.range)}
          compare={computed.paymentsCompare.text}
          compareTone={computed.paymentsCompare.tone}
          value={<CurrencyAmount amount={computed.paymentsCollected} className="text-xl font-bold sm:text-2xl" />}
          className={theme.metricA}
        />
        <KpiCard
          compact={compact}
          label="Completed jobs"
          sub={formatRangeForDisplay(computed.range)}
          compare={computed.jobsCompare.text}
          compareTone={computed.jobsCompare.tone}
          value={
            <span className={`text-xl font-bold sm:text-2xl ${theme.metricValueA}`}>
              {computed.jobsCompleted}
            </span>
          }
          className={theme.metricB}
        />
        <KpiCard
          compact={compact}
          label="Outstanding invoice balance"
          sub={`As of ${formatShortDate(DEMO_AS_OF_DATE)}`}
          value={<CurrencyAmount amount={computed.outstanding} className="text-xl font-bold sm:text-2xl" />}
          className={theme.metricA}
        />
        <KpiCard
          compact={compact}
          label="Overdue invoice balance"
          sub={`As of ${formatShortDate(DEMO_AS_OF_DATE)}`}
          value={<CurrencyAmount amount={computed.overdue} className="text-xl font-bold sm:text-2xl" />}
          className={theme.metricB}
        />
      </div>
    ),
    collections_chart: (
      <div className={`${compact ? "p-3" : "p-4"} ${theme.chartPanel} rounded-lg`}>
        <h3 className="text-sm font-semibold text-ink">Collections trend</h3>
        <p className="text-xs text-ink-muted">
          {formatRangeForDisplay(computed.range)} · Total{" "}
          <CurrencyAmount amount={computed.trendTotal} className="inline font-semibold" />
        </p>
        <CollectionsTrendChart trend={computed.trend} />
      </div>
    ),
    needs_attention: (
      <div className={`${compact ? "p-3" : "p-4"} rounded-lg border border-amber-100 bg-amber-50/30`}>
        <h3 className="text-sm font-semibold text-ink">Needs attention</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <button
              type="button"
              className="text-left font-medium text-amber-950 underline-offset-2 hover:underline"
              onClick={() => {
                setInsightFocus("overdue");
                setInvoiceStatus("Past due");
                setSelectedInvoiceId(null);
              }}
            >
              {computed.overdueCount} overdue invoices ·{" "}
              <CurrencyAmount amount={computed.overdue} className="inline" />
            </button>
          </li>
          {computed.oldestDays != null && computed.oldestDays > 0 && (
            <li className="text-ink">
              Oldest unpaid invoice:{" "}
              <span className="font-semibold">{computed.oldestDays} days</span> past due
            </li>
          )}
          {computed.aging["90_plus"].count > 0 && (
            <li className="text-ink">
              {computed.aging["90_plus"].count} invoices 90+ days overdue (
              <CurrencyAmount amount={computed.aging["90_plus"].total} className="inline" />)
            </li>
          )}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-ink-muted sm:grid-cols-5">
          {(
            [
              ["Not due", "not_due"],
              ["1–30", "1_30"],
              ["31–60", "31_60"],
              ["61–90", "61_90"],
              ["90+", "90_plus"],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="rounded bg-white/70 px-1.5 py-1">
              <p className="font-semibold text-ink">{label}</p>
              <p>{computed.aging[key].count} · ${computed.aging[key].total.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    ),
    job_activity: (
      <OperationsJobsPanel
        compact={compact}
        theme={theme}
        rangeLabel={formatRangeForDisplay(computed.range)}
        jobStatus={jobStatus}
        setJobStatus={setJobStatus}
        jobCategory={jobCategory}
        setJobCategory={setJobCategory}
        jobCategories={computed.jobCategories}
        categories={computed.categories}
        jobs={computed.jobs}
        selectedJobId={selectedJobId}
        onSelectJob={(id) => {
          setSelectedJobId(id);
          setSelectedInvoiceId(null);
          setSelectedAppointmentId(null);
        }}
        embedded
      />
    ),
    appointments: (
      <OperationsSchedulePanel
        compact={compact}
        theme={theme}
        upcoming={computed.upcoming}
        upcomingList={computed.upcomingList}
        selectedAppointmentId={selectedAppointmentId}
        onSelectAppointment={(id) => {
          setSelectedAppointmentId(id);
          setSelectedInvoiceId(null);
          setSelectedJobId(null);
        }}
        formatDateTime={formatDateTime}
        scheduleHref={dashboardSectionHref(dashboardRoutes.schedule, workspaceId)}
        embedded
      />
    ),
    invoices: (
      <div className={compact ? "px-3 py-3" : "px-4 py-4 sm:px-5"}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Invoices</h3>
            <p className="text-xs text-ink-muted">
              {computed.invoices.length} shown · filtered balance{" "}
              <CurrencyAmount amount={computed.filteredBalance} className="inline" />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={invoiceSearch}
              onChange={(e) => {
                setInvoiceSearch(e.target.value);
                setInvoiceLimit(INVOICE_PAGE_SIZE);
              }}
              placeholder="Search customer, #, description"
              className="rounded-lg border border-purple-100 px-2 py-1 text-xs"
            />
            <select
              value={invoiceStatus}
              onChange={(e) => {
                setInvoiceStatus(e.target.value as typeof invoiceStatus);
                setInsightFocus("none");
              }}
              className="rounded-lg border border-purple-100 px-2 py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="Open">Open</option>
              <option value="Past due">Past due</option>
              <option value="Paid">Paid</option>
            </select>
            <select
              value={invoiceSort}
              onChange={(e) => setInvoiceSort(e.target.value as typeof invoiceSort)}
              className="rounded-lg border border-purple-100 px-2 py-1 text-xs"
            >
              <option value="dueDate">Sort: due date</option>
              <option value="balance">Sort: balance</option>
            </select>
            {(invoiceSearch || invoiceStatus !== "all" || insightFocus !== "none") && (
              <button
                type="button"
                className="text-xs font-semibold text-purple"
                onClick={() => {
                  setInvoiceSearch("");
                  setInvoiceStatus("all");
                  setInsightFocus("none");
                  setInvoiceLimit(INVOICE_PAGE_SIZE);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-purple-100/80 text-xs font-semibold uppercase text-ink-muted">
                <th className="py-2 pr-2">Invoice</th>
                <th className="py-2 pr-2">Customer</th>
                <th className="py-2 pr-2">Due</th>
                <th className="py-2 pr-2">Balance</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {computed.invoices.slice(0, invoiceLimit).map((inv) => (
                <tr
                  key={inv.id}
                  className={`cursor-pointer border-b border-purple-50/80 hover:bg-purple-50/30 ${selectedInvoiceId === inv.id ? "bg-purple-50/50" : ""}`}
                  onClick={() => {
                    setSelectedInvoiceId(inv.id);
                    setSelectedJobId(null);
                    setSelectedAppointmentId(null);
                  }}
                >
                  <td className="py-2 pr-2 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="py-2 pr-2 font-medium text-ink">{inv.customer}</td>
                  <td className="py-2 pr-2">{formatShortDate(inv.dueDate)}</td>
                  <td className="py-2 pr-2">
                    <CurrencyAmount amount={inv.balanceDue} />
                  </td>
                  <td className="py-2">
                    <StatusPill status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {computed.invoices.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-muted">No invoices match.</p>
          )}
          {computed.invoices.length > invoiceLimit && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-purple"
              onClick={() => setInvoiceLimit((n) => n + INVOICE_PAGE_SIZE)}
            >
              Show more
            </button>
          )}
        </div>
      </div>
    ),
  };

  return (
    <div
      key={`${workspaceId}-${workspaceSessionKey}`}
      className={`overflow-hidden rounded-2xl shadow-card ${theme.card}`}
    >
      <div className={`flex flex-col gap-2 px-4 py-3 sm:px-5 ${theme.header} ${theme.headerText}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {mode === "revenue"
              ? "Revenue & collections"
              : isHvac
                ? "Operations dashboard"
                : "Retail operations"}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}>
            Sample data
          </span>
        </div>
        <DashboardWorkspaceNav embedded />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Reporting period
            </p>
            <div
              role="group"
              aria-label="Reporting period"
              className="mt-1.5 flex flex-wrap gap-0.5 rounded-xl border border-white/25 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            >
              {REPORTING_PERIOD_OPTIONS.map(({ value, label }) => {
                const active = preset === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPreset(value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:py-2 sm:text-sm ${
                      active
                        ? "bg-white text-purple-dark shadow-md ring-1 ring-white/90"
                        : "text-white/95 hover:bg-white/15"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {computed.range && (
            <p className="shrink-0 text-xs font-medium text-white/90 sm:pb-2 sm:text-sm">
              {formatRangeForDisplay(computed.range)}
            </p>
          )}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Start
              <input
                type="date"
                max={DEMO_AS_OF_DATE}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={headerFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
              End
              <input
                type="date"
                max={DEMO_AS_OF_DATE}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={headerFieldClass}
              />
            </label>
          </div>
        )}
        {rangeError && (
          <p className="rounded bg-white/20 px-2 py-1 text-xs" role="alert">
            {rangeError}
          </p>
        )}
      </div>

      {changesRequestedNote && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-ink">
          {changesRequestedNote}
        </p>
      )}

      {renderWidgetRows(visibleWidgets, widgetBlocks)}

      {(selectedInvoice || selectedJob || selectedAppointment) && (
        <div className="border-t border-purple-100/80 bg-white/90 px-4 py-4 sm:px-5">
          {selectedInvoice && (
            <>
              <p className="text-xs font-semibold uppercase text-purple">Invoice detail</p>
              <p className="font-semibold text-ink">
                {selectedInvoice.invoiceNumber} — {selectedInvoice.customer}
              </p>
              <p className="text-sm text-ink-muted">{selectedInvoice.lineSummary}</p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Amount</dt>
                  <dd>
                    <CurrencyAmount amount={selectedInvoice.amount} />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Remaining balance</dt>
                  <dd>
                    <CurrencyAmount amount={selectedInvoice.balanceDue} />
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs font-semibold text-ink">Allocated payments</p>
              {invoicePayments.length === 0 ? (
                <p className="text-xs text-ink-muted">None recorded</p>
              ) : (
                <ul className="mt-1 text-xs">
                  {invoicePayments.map((p) => (
                    <li key={p.id}>
                      {formatShortDate(p.date)} · <CurrencyAmount amount={p.amount} className="inline" />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {selectedJob && (
            <>
              <p className="text-xs font-semibold uppercase text-purple">Job detail</p>
              <p className="font-semibold text-ink">
                {selectedJob.serviceType}
                {" · "}
                <CurrencyAmount amount={selectedJob.amount} className="inline" />
              </p>
              <p className="text-sm text-ink">
                {selectedJob.customer} · {selectedJob.status} · {selectedJob.assignee}
              </p>
            </>
          )}
          {selectedAppointment && (
            <>
              <p className="text-xs font-semibold uppercase text-purple">Appointment</p>
              <p className="font-semibold text-ink">{selectedAppointment.title}</p>
              <p className="text-sm text-ink-muted">{selectedAppointment.location}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  sub,
  compare,
  compareTone,
  value,
  className,
  compact,
}: {
  label: string;
  sub: string;
  compare?: string;
  compareTone?: "neutral" | "up" | "down";
  value: ReactNode;
  className: string;
  compact?: boolean;
}) {
  const compareClass =
    compareTone === "up"
      ? "text-emerald-700"
      : compareTone === "down"
        ? "text-amber-800"
        : "text-ink-muted";
  return (
    <div className={`rounded-lg ${compact ? "p-2.5" : "p-3"} ${className}`}>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-[10px] text-ink-muted">{sub}</p>
      <div className="mt-1">{value}</div>
      {compare && <p className={`mt-1 text-[10px] ${compareClass}`}>{compare}</p>}
    </div>
  );
}

const OPERATIONS_PAIR: DashboardWidgetId[] = ["job_activity", "appointments"];

function renderWidgetRows(
  visibleWidgets: DashboardWidgetId[],
  widgetBlocks: Record<DashboardWidgetId, ReactNode>
) {
  const rows: ReactNode[] = [];
  const skip = new Set<DashboardWidgetId>();
  const hasJobs = visibleWidgets.includes("job_activity");
  const hasAppts = visibleWidgets.includes("appointments");

  for (let i = 0; i < visibleWidgets.length; i++) {
    const id = visibleWidgets[i]!;
    if (skip.has(id)) continue;

    if (hasJobs && hasAppts && OPERATIONS_PAIR.includes(id)) {
      const ordered = OPERATIONS_PAIR.filter((w) => visibleWidgets.includes(w)).sort(
        (a, b) => visibleWidgets.indexOf(a) - visibleWidgets.indexOf(b)
      );
      if (id !== ordered[0]) continue;
      ordered.forEach((w) => skip.add(w));
      rows.push(
        <div
          key="operations-row"
          className="grid border-t border-purple-100/60 lg:grid-cols-2 lg:divide-x lg:divide-purple-100/60"
        >
          {ordered.map((w) => (
            <div key={w} className="min-w-0">
              {widgetBlocks[w]}
            </div>
          ))}
        </div>
      );
      continue;
    }

    rows.push(
      <div key={id} className="border-t border-purple-100/60">
        {widgetBlocks[id]}
      </div>
    );
  }

  return rows;
}

function OperationsJobsPanel({
  compact,
  theme,
  rangeLabel,
  jobStatus,
  setJobStatus,
  jobCategory,
  setJobCategory,
  jobCategories,
  categories,
  jobs,
  selectedJobId,
  onSelectJob,
  embedded = false,
}: {
  compact: boolean;
  theme: ReturnType<typeof useCustomerPortal>["theme"];
  rangeLabel: string;
  jobStatus: "all" | "completed" | "scheduled" | "canceled" | "in_progress";
  setJobStatus: (v: "all" | "completed" | "scheduled" | "canceled" | "in_progress") => void;
  jobCategory: string;
  setJobCategory: (v: string) => void;
  jobCategories: string[];
  categories: { category: string; completed: number }[];
  jobs: BusinessJob[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  embedded?: boolean;
}) {
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";
  const density = getOperationsListDensity(jobs.length);
  const visibleJobs = jobs.slice(0, density.maxVisible);
  const hiddenCount = jobs.length - visibleJobs.length;

  return (
    <div
      className={`${pad} ${embedded ? "" : `${theme.listPanel} rounded-lg`} ${embedded ? theme.listPanel : ""} h-full`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Job activity</h3>
          <p className="text-[11px] text-ink-muted">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <select
            value={jobStatus}
            onChange={(e) => setJobStatus(e.target.value as typeof jobStatus)}
            className="rounded border border-purple-100 px-1.5 py-0.5 text-[11px]"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="canceled">Canceled</option>
          </select>
          <select
            value={jobCategory}
            onChange={(e) => setJobCategory(e.target.value)}
            className="rounded border border-purple-100 px-1.5 py-0.5 text-[11px]"
          >
            <option value="all">All categories</option>
            {jobCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {categories.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {categories.map((c) => (
            <span
              key={c.category}
              className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-ink-muted"
            >
              {c.category} · {c.completed}
            </span>
          ))}
        </div>
      )}
      {visibleJobs.length === 0 ? (
        <p className={`mt-3 text-center ${density.meta} text-ink-muted`}>
          No jobs match these filters.
        </p>
      ) : (
        <ul
          className={`mt-2 divide-y divide-purple-100 overflow-hidden rounded-lg border border-purple-100/90 bg-white/50 ${density.text}`}
        >
          {visibleJobs.map((job) => {
            const whenIso =
              job.scheduledAt ??
              `${job.completedDate ?? job.scheduledDate}T09:00:00`;
            const { date, time } = formatDateTime(whenIso);
            return (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  className={`flex w-full flex-col gap-0.5 px-3 text-left text-ink transition-colors hover:bg-white/80 sm:flex-row sm:items-center sm:justify-between ${density.rowPy} ${
                    selectedJobId === job.id ? "bg-purple-50/90" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {job.serviceType}
                      {" · "}
                      <CurrencyAmount amount={job.amount} className="inline font-medium" />
                    </p>
                    <p className={`truncate ${density.meta}`}>
                      {job.customer} · {job.category}
                    </p>
                  </div>
                  <div
                    className={`flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${density.meta}`}
                  >
                    <span>
                      <span className={`font-semibold ${theme.listAccent}`}>{date}</span>
                      {" · "}
                      {time}
                    </span>
                    <span className="capitalize">{job.status.replace("_", " ")}</span>
                    <span className="hidden sm:inline">{job.assignee}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className={`mt-2 ${density.meta} text-ink-muted`}>
          + {hiddenCount} more in this period — narrow filters to see fewer rows.
        </p>
      )}
    </div>
  );
}

function OperationsSchedulePanel({
  compact,
  theme,
  upcoming,
  upcomingList,
  selectedAppointmentId,
  onSelectAppointment,
  formatDateTime,
  scheduleHref,
  embedded = false,
}: {
  compact: boolean;
  theme: ReturnType<typeof useCustomerPortal>["theme"];
  upcoming: number;
  upcomingList: ReturnType<typeof listUpcomingAppointments>;
  selectedAppointmentId: string | null;
  onSelectAppointment: (id: string) => void;
  formatDateTime: (iso: string) => { date: string; time: string };
  scheduleHref: string;
  embedded?: boolean;
}) {
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";
  const density = getOperationsListDensity(upcomingList.length);
  const visible = upcomingList.slice(0, density.maxVisible);
  const hiddenCount = upcomingList.length - visible.length;

  return (
    <div
      className={`${pad} ${embedded ? "" : `${theme.listPanel} rounded-lg`} ${embedded ? theme.listPanel : ""} h-full`}
    >
      <h3 className="text-sm font-semibold text-ink">Next 7 days</h3>
      <p className="text-[11px] text-ink-muted">
        From {formatShortDate(DEMO_AS_OF_DATE)} · {upcoming} scheduled
      </p>
      {visible.length === 0 ? (
        <p className={`mt-3 text-center ${density.meta} text-ink-muted`}>
          No upcoming appointments in this window.
        </p>
      ) : (
        <ul
          className={`mt-2 divide-y divide-purple-100 overflow-hidden rounded-lg border border-purple-100/90 bg-white/50 ${density.text}`}
        >
          {visible.map((appt) => {
            const { date, time } = formatDateTime(appt.startAt);
            return (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => onSelectAppointment(appt.id)}
                  className={`flex w-full flex-col gap-0.5 px-3 text-left transition-colors hover:bg-white/80 sm:flex-row sm:items-center sm:justify-between ${density.rowPy} ${
                    selectedAppointmentId === appt.id ? "bg-purple-50/90" : ""
                  }`}
                >
                  <p className="min-w-0 flex-1 truncate font-medium text-ink">{appt.title}</p>
                  <div className={`shrink-0 ${density.meta}`}>
                    <span className={`font-semibold ${theme.listAccent}`}>{date}</span>
                    <span className="text-ink-muted"> · {time}</span>
                    <span className="hidden sm:inline text-ink-muted"> · {appt.assignee}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className={`mt-2 ${density.meta} text-ink-muted`}>
          + {hiddenCount} more —{" "}
          <Link href={scheduleHref} className="font-semibold text-purple hover:text-purple-dark">
            open Schedule
          </Link>
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "Past due"
      ? "bg-amber-100 text-amber-900"
      : status === "Open"
        ? "bg-slate-100 text-slate-800"
        : "bg-emerald-50 text-emerald-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
