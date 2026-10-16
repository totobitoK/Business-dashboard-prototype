"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  formatCalendarDateDisplay,
  formatNaiveBusinessDateTime,
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
  computeRevenueOverviewMetrics,
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
  appointmentAssigneeBreakdown,
  serviceCategoryBreakdown,
  sortInvoices,
  sumOverdueInvoices,
  sumOutstandingInvoices,
  sumPaymentsInRange,
} from "@/lib/workspace-analytics";
import { DashboardWorkspaceNav } from "@/components/customer/DashboardWorkspaceNav";
import { dashboardSectionHref } from "@/lib/dashboard-section-routes";
import { CollectionsTrendChart } from "@/components/customer/CollectionsTrendChart";
import { DashboardSection } from "@/components/customer/DashboardSection";
import {
  DashboardChipGroup,
  DashboardControlBar,
  DashboardSearchInput,
  DashboardSecondaryButton,
  DashboardSelect,
} from "@/components/customer/dashboard-controls";
import { ReportingPeriodCustomRange } from "@/components/customer/ReportingPeriodCustomRange";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";
import { getOperationsListDensity } from "@/lib/operations-list-density";
import { demoDashboardRoutes as dashboardRoutes } from "@/lib/routes";
import {
  OVERVIEW_KPI_LABELS,
  REVENUE_KPI_LABELS,
  visibleKpiIds,
  type OverviewKpiId,
  type RevenueKpiId,
} from "@/lib/workspace-kpi-layout";
import type { DashboardWidgetId } from "@/lib/workspace-widget-layout";

const INVOICE_PAGE_SIZE = 8;

const JOB_STATUS_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "completed" as const, label: "Done" },
  { value: "scheduled" as const, label: "Scheduled" },
  { value: "in_progress" as const, label: "Active" },
  { value: "canceled" as const, label: "Canceled" },
];

const INVOICE_STATUS_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "Open" as const, label: "Open" },
  { value: "Past due" as const, label: "Past due" },
  { value: "Paid" as const, label: "Paid" },
];

const INVOICE_SORT_OPTIONS = [
  { value: "dueDate" as const, label: "Due date" },
  { value: "balance" as const, label: "Balance" },
];

const widgetListRowClass = "transition-all hover:bg-white/90";

/** Job activity + Next 7 days lists — subtle hover only (no left accent). */
const operationsListRowBase = "transition-colors bg-white/70";

const operationsSummaryStripClass = "mt-2 flex flex-wrap gap-1";

/** Minimum time the dim state stays on (mostly for search deferral). */
const FILTER_PANEL_MIN_PENDING_MS = 240;
/** Invoice status chips — brief beat before rows swap (latest chip always wins). */
const INVOICE_STATUS_CHIP_TRANSITION_MS = 280;

function filterPanelContentClass(pending: boolean) {
  return `transition-[opacity,filter] duration-[400ms] ease-out ${
    pending ? "opacity-[0.45] saturate-[0.75] blur-[0.35px]" : "opacity-100 saturate-100 blur-0"
  }`;
}

function filterPanelVeilClass(pending: boolean) {
  return `pointer-events-none absolute inset-0 z-[1] rounded-xl transition-opacity duration-[400ms] ease-out ${
    pending ? "bg-white/45 opacity-100" : "opacity-0"
  }`;
}

type InvoiceStatusFilter = "all" | "Open" | "Past due" | "Paid";
type JobStatusFilter = "all" | "completed" | "scheduled" | "canceled" | "in_progress";

function invoiceStatusFilterKey(
  status: InvoiceStatusFilter,
  insightFocus: "none" | "overdue"
): InvoiceStatusFilter {
  return insightFocus === "overdue" ? "Past due" : status;
}

function parseJobFilterSignature(signature: string) {
  const [status = "all", category = "all"] = signature.split("|");
  return {
    status: status as JobStatusFilter,
    category,
  };
}

/** Keeps the dimmed state long enough for the CSS opacity transition to read. */
function useMinFilterPending(pending: boolean, minMs = FILTER_PANEL_MIN_PENDING_MS) {
  const [visible, setVisible] = useState(false);
  const pendingSince = useRef<number | null>(null);

  useEffect(() => {
    if (pending) {
      if (pendingSince.current === null) pendingSince.current = Date.now();
      setVisible(true);
      return;
    }
    if (!visible) {
      pendingSince.current = null;
      return;
    }
    const since = pendingSince.current ?? Date.now();
    const wait = Math.max(0, minMs - (Date.now() - since));
    const timer = window.setTimeout(() => {
      pendingSince.current = null;
      setVisible(false);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [pending, visible, minMs]);

  return visible;
}

const REPORTING_PERIOD_OPTIONS: { value: ReportingPeriodPreset; label: string }[] = [
  { value: "last7", label: "7 days" },
  { value: "last30", label: "30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "prev_month", label: "Previous month" },
  { value: "custom", label: "Custom" },
];

function formatShortDate(iso: string): string {
  return formatCalendarDateDisplay(iso);
}

function formatJobRowWhen(job: BusinessJob): { date: string; time: string | null } {
  const dateIso =
    job.status === "completed" && job.completedDate
      ? job.completedDate
      : job.scheduledDate;
  const date = formatCalendarDateDisplay(dateIso, "withWeekday");
  if (job.status === "completed") {
    return { date, time: null };
  }
  const { time } = formatNaiveBusinessDateTime(job.scheduledAt);
  return { date, time: time || null };
}

function formatAppointmentDateTime(iso: string): { date: string; time: string } {
  return formatNaiveBusinessDateTime(iso);
}

const REVENUE_WIDGETS: DashboardWidgetId[] = [
  "metrics",
  "collections_chart",
  "invoices",
  "needs_attention",
];

export function WorkspaceSampleDashboard({
  changesRequestedNote,
  mode = "overview",
}: {
  changesRequestedNote?: string;
  mode?: "overview" | "revenue";
}) {
  const {
    workspaceId,
    theme,
    settings,
    workspaceSessionKey,
    navigationBase,
    liveSamplePreview,
  } = useCustomerPortal();
  const sectionLinkBase = navigationBase ?? dashboardRoutes.home;
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
  const [appliedInvoiceStatusKey, setAppliedInvoiceStatusKey] =
    useState<InvoiceStatusFilter>("all");
  const appliedInvoiceStatusRef = useRef<InvoiceStatusFilter>("all");

  const [jobStatus, setJobStatus] = useState<"all" | "completed" | "scheduled" | "canceled" | "in_progress">("all");
  const [jobCategory, setJobCategory] = useState("all");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    setInvoiceSearch("");
    setInvoiceStatus("all");
    setInsightFocus("none");
    setAppliedInvoiceStatusKey("all");
    appliedInvoiceStatusRef.current = "all";
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

  const deferredInvoiceSearch = useDeferredValue(invoiceSearch);
  const requestedInvoiceStatusKey = invoiceStatusFilterKey(invoiceStatus, insightFocus);

  useEffect(() => {
    appliedInvoiceStatusRef.current = appliedInvoiceStatusKey;
  }, [appliedInvoiceStatusKey]);

  useEffect(() => {
    const next = requestedInvoiceStatusKey;
    if (appliedInvoiceStatusRef.current === next) return;

    const timer = window.setTimeout(() => {
      appliedInvoiceStatusRef.current = next;
      setAppliedInvoiceStatusKey(next);
    }, INVOICE_STATUS_CHIP_TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [requestedInvoiceStatusKey]);

  const invoiceStatusChipPending = appliedInvoiceStatusKey !== requestedInvoiceStatusKey;
  const invoiceSearchPending = invoiceSearch !== deferredInvoiceSearch;
  const invoiceTablePending = useMinFilterPending(
    invoiceStatusChipPending || invoiceSearchPending
  );

  const jobFilterSignature = `${jobStatus}|${jobCategory}`;
  const deferredJobFilterSignature = useDeferredValue(jobFilterSignature);
  const jobFilterPendingRaw = jobFilterSignature !== deferredJobFilterSignature;
  const jobFilterPending = useMinFilterPending(jobFilterPendingRaw);

  const analyticsCore = useMemo(() => {
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
    const jobCategories = [...new Set(data.jobs.map((j) => j.category))].sort();

    const revenueOverview = computeRevenueOverviewMetrics(
      data.payments,
      data.invoices,
      range
    );

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
      invoiceTotal: data.invoices.length,
      jobCategories,
      upcoming: countUpcomingAppointments(data.appointments),
      upcomingList: listUpcomingAppointments(data.appointments),
      ...revenueOverview,
    };
  }, [data, rangeResult.range]);

  const invoiceList = useMemo(() => {
    if (!data || !analyticsCore) return null;

    let invoices = filterInvoices({
      invoices: data.invoices,
      search: deferredInvoiceSearch,
      status: appliedInvoiceStatusKey,
    });
    invoices = sortInvoices(
      invoices,
      invoiceSort,
      invoiceSort === "balance" ? "desc" : "asc"
    );
    const filteredBalance = invoices.reduce((s, i) => s + i.balanceDue, 0);
    return { invoices, filteredBalance };
  }, [
    data,
    analyticsCore,
    deferredInvoiceSearch,
    appliedInvoiceStatusKey,
    invoiceSort,
  ]);

  const jobsInRange = useMemo(() => {
    if (!data || !analyticsCore) return [];
    const { status, category } = parseJobFilterSignature(deferredJobFilterSignature);
    return filterJobsInRange({
      jobs: data.jobs,
      range: analyticsCore.range,
      status,
      category,
    });
  }, [data, analyticsCore, deferredJobFilterSignature]);

  const computed =
    analyticsCore && invoiceList
      ? {
          ...analyticsCore,
          invoices: invoiceList.invoices,
          filteredBalance: invoiceList.filteredBalance,
          jobs: jobsInRange,
        }
      : null;

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

  const visibleInvoices = computed.invoices.slice(0, invoiceLimit);
  const invoicePadRowCount = Math.max(0, invoiceLimit - visibleInvoices.length);

  const visibleOverviewKpis = visibleKpiIds(
    settings.overviewKpiOrder,
    settings.overviewHiddenKpis
  );
  const visibleRevenueKpis = visibleKpiIds(
    settings.revenueKpiOrder,
    settings.revenueHiddenKpis
  );

  const invoiceToolbar = (
    <DashboardControlBar theme={theme} compact singleRow fitContent>
      <DashboardSearchInput
        theme={theme}
        className="w-[11rem] shrink-0 flex-none sm:w-[12rem]"
        value={invoiceSearch}
        onChange={(e) => {
          const value = e.target.value;
          startTransition(() => {
            setInvoiceSearch(value);
            setInvoiceLimit(INVOICE_PAGE_SIZE);
          });
        }}
        placeholder="Search customer, #, description"
        aria-busy={invoiceTablePending}
      />
      <DashboardChipGroup
        theme={theme}
        nowrap
        aria-label="Invoice status"
        value={requestedInvoiceStatusKey}
        options={INVOICE_STATUS_OPTIONS}
        onChange={(v) => {
          setInvoiceStatus(v);
          setInsightFocus("none");
          setInvoiceLimit(INVOICE_PAGE_SIZE);
        }}
      />
      <DashboardSelect
        theme={theme}
        className="shrink-0"
        aria-label="Sort invoices by"
        value={invoiceSort}
        options={INVOICE_SORT_OPTIONS}
        onChange={(v) => startTransition(() => setInvoiceSort(v))}
        align="right"
      />
    </DashboardControlBar>
  );

  const jobActivityToolbar = (
    <DashboardControlBar theme={theme} compact fitContent>
      <DashboardChipGroup
        theme={theme}
        compact
        aria-label="Job status"
        value={jobStatus}
        options={JOB_STATUS_OPTIONS}
        onChange={(v) => startTransition(() => setJobStatus(v))}
      />
      <DashboardSelect
        theme={theme}
        size="compact"
        aria-label="Filter by category"
        value={jobCategory}
        options={[
          { value: "all", label: "All categories" },
          ...computed.jobCategories.map((c) => ({ value: c, label: c })),
        ]}
        onChange={(v) => startTransition(() => setJobCategory(v))}
        align="right"
      />
    </DashboardControlBar>
  );

  const widgetBlocks: Record<DashboardWidgetId, ReactNode> = {
    metrics: (
      <MetricsKpiGrid
        mode={mode}
        compact={compact}
        theme={theme}
        computed={computed}
        overviewKpiIds={visibleOverviewKpis}
        revenueKpiIds={visibleRevenueKpis}
        liveSamplePreview={liveSamplePreview}
      />
    ),
    collections_chart: <CollectionsTrendChart trend={computed.trend} theme={theme} />,
    needs_attention: (
      <NeedsAttentionPanel
        theme={theme}
        overdueCount={computed.overdueCount}
        overdueTotal={computed.overdue}
        oldestDays={computed.oldestDays}
        aging={computed.aging}
        onViewOverdueInvoices={() => {
          setInsightFocus("overdue");
          setInvoiceStatus("Past due");
          setSelectedInvoiceId(null);
        }}
      />
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
        bare
        filterPending={jobFilterPending}
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
        formatDateTime={formatAppointmentDateTime}
        scheduleHref={dashboardSectionHref(workspaceId, "schedule", sectionLinkBase)}
        embedded
        bare
      />
    ),
    invoices: (
      <div key="invoices">
        <div
          aria-busy={invoiceTablePending}
          aria-label="Filtered invoices"
          className={`relative overflow-x-auto [scrollbar-gutter:stable] ${theme.widgetListShell}`}
        >
          <div aria-hidden className={filterPanelVeilClass(invoiceTablePending)} />
          <div className={filterPanelContentClass(invoiceTablePending)}>
          <table className="w-full min-w-[32rem] table-fixed text-center text-sm">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[31%]" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className={`${theme.widgetListHeader} text-[10px] font-bold uppercase tracking-wide text-ink-muted`}>
                <th className="px-3 py-2.5">Invoice</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5">Balance</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.widgetListDivideLight}`}>
              {visibleInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="h-[21rem] align-middle text-center text-sm text-ink-muted"
                  >
                    No invoices match.
                  </td>
                </tr>
              ) : (
                <>
                  {visibleInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className={`h-10 cursor-pointer ${widgetListRowClass} ${
                        selectedInvoiceId === inv.id
                          ? `${theme.tableRowSelected} ${theme.tableRowSelectedInset}`
                          : idx % 2 === 1
                            ? "bg-white/60"
                            : "bg-white"
                      }`}
                      onClick={() => {
                        setSelectedInvoiceId(inv.id);
                        setSelectedJobId(null);
                        setSelectedAppointmentId(null);
                      }}
                    >
                      <td className={`truncate px-3 py-2.5 font-mono text-xs font-semibold ${theme.metricValueA}`}>
                        {inv.invoiceNumber}
                      </td>
                      <td className="truncate px-3 py-2.5 font-medium text-ink">{inv.customer}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{formatShortDate(inv.dueDate)}</td>
                      <td className={`px-3 py-2.5 font-semibold ${theme.metricValueA}`}>
                        <CurrencyAmount amount={inv.balanceDue} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={inv.status} />
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: invoicePadRowCount }, (_, i) => (
                    <tr key={`invoice-pad-${i}`} className="h-10 pointer-events-none" aria-hidden>
                      <td
                        colSpan={5}
                        className={`${i % 2 === 1 ? "bg-white/60" : "bg-white"} border-transparent`}
                      />
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          </div>
        </div>
        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2">
          {computed.invoices.length > invoiceLimit && (
            <DashboardSecondaryButton
              theme={theme}
              onClick={() => setInvoiceLimit((n) => n + INVOICE_PAGE_SIZE)}
            >
              Show more
            </DashboardSecondaryButton>
          )}
          {invoiceLimit > INVOICE_PAGE_SIZE && (
            <DashboardSecondaryButton
              theme={theme}
              onClick={() => setInvoiceLimit(INVOICE_PAGE_SIZE)}
            >
              Collapse
            </DashboardSecondaryButton>
          )}
        </div>
      </div>
    ),
  };

  return (
    <div
      key={`${workspaceId}-${workspaceSessionKey}`}
      className={`rounded-2xl shadow-card ${theme.card}`}
    >
      <div
        className={`relative z-10 flex flex-col gap-2 overflow-visible rounded-t-2xl px-4 py-3 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
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
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
            Reporting period
          </p>
          <div className="relative z-20 mt-1.5 rounded-xl border border-white/25 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div
                role="group"
                aria-label="Reporting period"
                className="flex min-w-0 flex-1 flex-wrap gap-0.5 p-0.5"
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
                          ? theme.embeddedPeriodActive
                          : "text-white/95 hover:bg-white/15"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {computed.range && (
                <p className="shrink-0 px-1 text-xs font-medium leading-none text-white/90 sm:pr-2 sm:text-sm">
                  {formatRangeForDisplay(computed.range)}
                </p>
              )}
            </div>
            {preset === "custom" && (
              <>
                <div className="mx-1 border-t border-white/20" aria-hidden />
                <ReportingPeriodCustomRange
                  embedded
                  customStart={customStart}
                  customEnd={customEnd}
                  maxDate={DEMO_AS_OF_DATE}
                  onStartChange={setCustomStart}
                  onEndChange={setCustomEnd}
                />
              </>
            )}
          </div>
        </div>
        {rangeError && (
          <p className="rounded bg-white/20 px-2 py-1 text-xs" role="alert">
            {rangeError}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-b-2xl">
        {changesRequestedNote && (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-ink">
            {changesRequestedNote}
          </p>
        )}

        {renderWidgetRows(visibleWidgets, widgetBlocks, theme, compact, (id) => {
          const rangeLabel = formatRangeForDisplay(computed.range);
          switch (id) {
            case "metrics":
              return {
                title: mode === "revenue" ? "Revenue Overview" : "General Overview",
                subtitle: rangeLabel,
                subtitleAlign: "center" as const,
              };
            case "collections_chart":
              return {
                title: "Collections trend",
                subtitle: (
                  <>
                    {rangeLabel} · Total{" "}
                    <CurrencyAmount
                      amount={computed.trendTotal}
                      className={`inline font-semibold ${theme.metricValueA}`}
                    />
                  </>
                ),
                subtitleAlign: "center" as const,
                tightToolbar: true,
              };
            case "job_activity":
              return {
                title: "Job activity",
                subtitle: rangeLabel,
                subtitleAlign: "center" as const,
                headerAside: jobActivityToolbar,
                tightToolbar: true,
              };
            case "appointments":
              return {
                title: "Next 7 days",
                subtitle: `${computed.upcoming} upcoming · from ${formatShortDate(DEMO_AS_OF_DATE)}`,
                subtitleAlign: "center" as const,
                headerAside: (
                  <Link
                    href={dashboardSectionHref(workspaceId, "schedule", sectionLinkBase)}
                    className={`inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold shadow-sm transition ${theme.filterSecondaryButton}`}
                  >
                    Open schedule
                  </Link>
                ),
              };
            case "invoices":
              return {
                title: "Invoices",
                subtitle: (
                  <>
                    {computed.invoices.length} shown · filtered balance{" "}
                    <CurrencyAmount
                      amount={computed.filteredBalance}
                      className={`inline font-semibold ${theme.metricValueA}`}
                    />
                  </>
                ),
                headerAside: invoiceToolbar,
                tightToolbar: true,
              };
            case "needs_attention":
              return {
                title: "Needs attention",
                subtitle: "Open receivables & aging",
                subtitleAlign: "center" as const,
              };
            default:
              return { title: id };
          }
        })}

      {(selectedInvoice || selectedJob || selectedAppointment) && (
        <div className={`border-t ${theme.detailPanelBorder} bg-white/90 px-4 py-4 sm:px-5`}>
          {selectedInvoice && (
            <>
              <p className={`text-xs font-semibold uppercase ${theme.detailSectionLabel}`}>Invoice detail</p>
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
              <p className={`text-xs font-semibold uppercase ${theme.detailSectionLabel}`}>Job detail</p>
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
              <p className={`text-xs font-semibold uppercase ${theme.detailSectionLabel}`}>Appointment</p>
              <p className="font-semibold text-ink">{selectedAppointment.title}</p>
              <p className="text-sm text-ink-muted">{selectedAppointment.location}</p>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

type MetricsKpiComputed = {
  range: { start: string; end: string; preset: ReportingPeriodPreset };
  paymentsCollected: number;
  paymentsCompare: { text: string; tone: "neutral" | "up" | "down" };
  jobsCompleted: number;
  jobsCompare: { text: string; tone: "neutral" | "up" | "down" };
  outstanding: number;
  overdue: number;
  weeklyRevenue: number;
  weeklyRevenueCompare: { text: string; tone: "neutral" | "up" | "down" };
  weeklyRangeLabel: string;
  monthlyRevenue: number;
  monthlyRevenueCompare: { text: string; tone: "neutral" | "up" | "down" };
  monthlyRangeLabel: string;
  monthPipeline: number;
  monthPipelineLabel: string;
};

function MetricsKpiGrid({
  mode,
  compact,
  theme,
  computed,
  overviewKpiIds,
  revenueKpiIds,
  liveSamplePreview,
}: {
  mode: "overview" | "revenue";
  compact: boolean;
  theme: LayoutCustomizeTheme;
  computed: MetricsKpiComputed;
  overviewKpiIds: OverviewKpiId[];
  revenueKpiIds: RevenueKpiId[];
  liveSamplePreview?: boolean;
}) {
  const ids = mode === "revenue" ? revenueKpiIds : overviewKpiIds;

  if (ids.length === 0) {
    return (
      <p
        className={`rounded-lg border border-dashed px-4 py-6 text-center text-sm text-ink-muted ${theme.kpiEmptyState}`}
      >
        No KPI cards selected.
        {liveSamplePreview ? (
          " Layout customization is not available on the live sample preview."
        ) : (
          <>
            {" "}
            <Link
              href={dashboardRoutes.settings}
              className={`font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
            >
              Choose KPIs in Appearance & layout
            </Link>
            .
          </>
        )}
      </p>
    );
  }

  const lgCols =
    ids.length <= 1
      ? "lg:grid-cols-1"
      : ids.length === 2
        ? "lg:grid-cols-2"
        : ids.length === 3
          ? "lg:grid-cols-3"
          : "lg:grid-cols-4";

  return (
    <div key="metrics" className={`grid gap-2 sm:grid-cols-2 ${lgCols}`}>
      {mode === "revenue"
        ? revenueKpiIds.map((id, index) => (
            <KpiCard
              key={id}
              compact={compact}
              label={REVENUE_KPI_LABELS[id]}
              {...revenueKpiCardProps(id, computed, theme, index)}
            />
          ))
        : overviewKpiIds.map((id, index) => (
            <KpiCard
              key={id}
              compact={compact}
              label={OVERVIEW_KPI_LABELS[id]}
              {...overviewKpiCardProps(id, computed, theme, index)}
            />
          ))}
    </div>
  );
}

function revenueKpiCardProps(
  id: RevenueKpiId,
  computed: MetricsKpiComputed,
  theme: LayoutCustomizeTheme,
  index: number
) {
  const className = index % 2 === 0 ? theme.metricA : theme.metricB;
  switch (id) {
    case "weekly_revenue":
      return {
        sub: computed.weeklyRangeLabel,
        compare: computed.weeklyRevenueCompare.text,
        compareTone: computed.weeklyRevenueCompare.tone,
        value: (
          <CurrencyAmount amount={computed.weeklyRevenue} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "monthly_revenue":
      return {
        sub: computed.monthlyRangeLabel,
        compare: computed.monthlyRevenueCompare.text,
        compareTone: computed.monthlyRevenueCompare.tone,
        value: (
          <CurrencyAmount amount={computed.monthlyRevenue} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "month_pipeline":
      return {
        sub: computed.monthPipelineLabel,
        value: (
          <CurrencyAmount amount={computed.monthPipeline} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "overdue_ar":
      return {
        sub: `As of ${formatShortDate(DEMO_AS_OF_DATE)}`,
        value: (
          <CurrencyAmount amount={computed.overdue} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
  }
}

function overviewKpiCardProps(
  id: OverviewKpiId,
  computed: MetricsKpiComputed,
  theme: LayoutCustomizeTheme,
  index: number
) {
  const className = index % 2 === 0 ? theme.metricA : theme.metricB;
  switch (id) {
    case "payments_collected":
      return {
        sub: formatRangeForDisplay(computed.range),
        compare: computed.paymentsCompare.text,
        compareTone: computed.paymentsCompare.tone,
        value: (
          <CurrencyAmount
            amount={computed.paymentsCollected}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "jobs_completed":
      return {
        sub: formatRangeForDisplay(computed.range),
        compare: computed.jobsCompare.text,
        compareTone: computed.jobsCompare.tone,
        value: (
          <span className={`text-xl font-bold sm:text-2xl ${theme.metricValueA}`}>
            {computed.jobsCompleted}
          </span>
        ),
        className,
      };
    case "outstanding_balance":
      return {
        sub: `As of ${formatShortDate(DEMO_AS_OF_DATE)}`,
        value: (
          <CurrencyAmount amount={computed.outstanding} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "overdue_balance":
      return {
        sub: `As of ${formatShortDate(DEMO_AS_OF_DATE)}`,
        value: (
          <CurrencyAmount amount={computed.overdue} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
  }
}

const AGING_BUCKET_KEYS = [
  ["Not due", "not_due"],
  ["1–30", "1_30"],
  ["31–60", "31_60"],
  ["61–90", "61_90"],
  ["90+", "90_plus"],
] as const;

type AgingBuckets = ReturnType<typeof invoiceAgingBuckets>;

function NeedsAttentionPanel({
  theme,
  overdueCount,
  overdueTotal,
  oldestDays,
  aging,
  onViewOverdueInvoices,
}: {
  theme: LayoutCustomizeTheme;
  overdueCount: number;
  overdueTotal: number;
  oldestDays: number | null;
  aging: AgingBuckets;
  onViewOverdueInvoices: () => void;
}) {
  const critical = aging["90_plus"];

  return (
    <div key="needs_attention" className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onViewOverdueInvoices}
          className={`rounded-lg border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md ${overdueCount > 0 ? "ring-1 ring-amber-200/60" : ""}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
            Past due
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">
            {overdueCount}{" "}
            <span className="text-sm font-semibold text-ink-muted">invoices</span>
          </p>
          <p className={`mt-0.5 text-sm font-semibold ${theme.metricValueA}`}>
            <CurrencyAmount amount={overdueTotal} />
          </p>
          <p className={`mt-1 text-[10px] font-semibold ${theme.linkAccent}`}>
            View in invoice list →
          </p>
        </button>

        <div className={`rounded-lg border p-3 shadow-sm ${theme.attentionMetricTile}`}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            Oldest overdue
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">
            {oldestDays != null && oldestDays > 0 ? (
              <>
                {oldestDays}{" "}
                <span className="text-sm font-semibold text-ink-muted">days</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-ink-muted">None</span>
            )}
          </p>
          <p className="mt-2 text-[10px] leading-snug text-ink-muted">
            Longest-running unpaid balance past due date
          </p>
        </div>

        <div
          className={`rounded-lg border p-3 shadow-sm ${
            critical.count > 0
              ? "border-amber-200/90 bg-gradient-to-br from-amber-50/70 to-white ring-1 ring-amber-200/50"
              : theme.attentionMetricTileIdle
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            90+ days overdue
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{critical.count}</p>
          <p className={`mt-0.5 text-sm font-semibold ${theme.metricValueA}`}>
            <CurrencyAmount amount={critical.total} />
          </p>
        </div>
      </div>

      <div className={`overflow-hidden ${theme.widgetListShell}`}>
        <p
          className={`px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted ${theme.widgetListHeader}`}
        >
          Open balance by aging bucket
        </p>
        <table className="w-full table-fixed text-center text-xs">
          <thead>
            <tr
              className={`${theme.widgetListHeader} text-[10px] font-bold uppercase tracking-wide text-ink-muted`}
            >
              {AGING_BUCKET_KEYS.map(([label]) => (
                <th key={label} className="px-2 py-2.5 font-bold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={`divide-x bg-white/80 text-ink ${theme.widgetListColDivide}`}>
              {AGING_BUCKET_KEYS.map(([label, key]) => (
                <td key={key} className="px-2 py-2.5 tabular-nums">
                  <span className="block font-semibold text-ink">{aging[key].count}</span>
                  <span className={`mt-0.5 block text-[11px] font-medium ${theme.metricValueA}`}>
                    <CurrencyAmount amount={aging[key].total} className="inline" />
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
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

type WidgetSectionMeta = {
  title: string;
  subtitle?: ReactNode;
  headerAside?: ReactNode;
  accent?: "default" | "alert";
  tightToolbar?: boolean;
  subtitleAlign?: "left" | "center" | "right";
};

function renderWidgetRows(
  visibleWidgets: DashboardWidgetId[],
  widgetBlocks: Record<DashboardWidgetId, ReactNode>,
  theme: LayoutCustomizeTheme,
  compact: boolean,
  sectionFor: (id: DashboardWidgetId) => WidgetSectionMeta
) {
  const rows: ReactNode[] = [];
  const skip = new Set<DashboardWidgetId>();
  const hasJobs = visibleWidgets.includes("job_activity");
  const hasAppts = visibleWidgets.includes("appointments");

  const wrapSection = (id: DashboardWidgetId) => {
    const meta = sectionFor(id);
    return (
      <DashboardSection
        key={id}
        theme={theme}
        compact={compact}
        title={meta.title}
        subtitle={meta.subtitle}
        headerAside={meta.headerAside}
        accent={meta.accent}
        tightToolbar={meta.tightToolbar}
        subtitleAlign={meta.subtitleAlign}
      >
        {widgetBlocks[id]}
      </DashboardSection>
    );
  };

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
        <div key="operations-row" className="grid gap-4 lg:grid-cols-2">
          {ordered.map((w) => wrapSection(w))}
        </div>
      );
      continue;
    }

    rows.push(wrapSection(id));
  }

  return (
    <div className={`flex flex-col gap-4 p-4 sm:p-5 ${theme.dashboardCanvas}`}>{rows}</div>
  );
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
  bare = false,
  filterPending = false,
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
  bare?: boolean;
  filterPending?: boolean;
}) {
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";
  const density = getOperationsListDensity(jobs.length);
  const visibleJobs = jobs.slice(0, density.maxVisible);
  const hiddenCount = jobs.length - visibleJobs.length;

  const shellClass = bare
    ? "min-w-0"
    : `${pad} h-full ${embedded ? "" : `${theme.listPanel} rounded-xl`}`;

  return (
    <div className={shellClass}>
      {!bare && (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 ${theme.toolbarDivider}`}>
          <div>
            <h3 className="text-sm font-semibold text-ink">Job activity</h3>
            <p className="text-[11px] text-ink-muted">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DashboardSelect
              theme={theme}
              aria-label="Job status"
              value={jobStatus}
              options={[
                { value: "all", label: "All statuses" },
                { value: "completed", label: "Completed" },
                { value: "scheduled", label: "Scheduled" },
                { value: "in_progress", label: "In progress" },
                { value: "canceled", label: "Canceled" },
              ]}
              onChange={setJobStatus}
            />
            <DashboardSelect
              theme={theme}
              aria-label="Job category"
              value={jobCategory}
              options={[
                { value: "all", label: "All categories" },
                ...jobCategories.map((c) => ({ value: c, label: c })),
              ]}
              onChange={setJobCategory}
            />
          </div>
        </div>
      )}
      {categories.length > 0 && (
        <div className={operationsSummaryStripClass}>
          {categories.map((c) => (
            <span key={c.category} className={theme.operationsSummaryChip}>
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
        <div
          aria-busy={filterPending}
          className={`relative mt-3 ${theme.widgetListShell} ${density.text}`}
        >
          <div aria-hidden className={filterPanelVeilClass(filterPending)} />
          <ul className={`divide-y ${theme.widgetListDivide} ${filterPanelContentClass(filterPending)}`}>
          {visibleJobs.map((job) => {
            const { date, time } = formatJobRowWhen(job);
            return (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  className={`flex w-full flex-col gap-0.5 px-3 text-left text-ink sm:flex-row sm:items-center sm:justify-between ${density.rowPy} ${
                    selectedJobId === job.id
                      ? theme.operationsListSelected
                      : `${operationsListRowBase} ${theme.operationsListHover}`
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
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
                      {time ? (
                        <>
                          {" · "}
                          {time}
                        </>
                      ) : null}
                    </span>
                    <span className="capitalize">{job.status.replace("_", " ")}</span>
                    <span className="hidden sm:inline">{job.assignee}</span>
                  </div>
                </button>
              </li>
            );
          })}
          </ul>
        </div>
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
  bare = false,
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
  bare?: boolean;
}) {
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";
  const density = getOperationsListDensity(upcomingList.length);
  const visible = upcomingList.slice(0, density.maxVisible);
  const hiddenCount = upcomingList.length - visible.length;
  const assigneeBreakdown = appointmentAssigneeBreakdown(upcomingList);

  const shellClass = bare
    ? "min-w-0"
    : `${pad} h-full ${embedded ? "" : `${theme.listPanel} rounded-xl`}`;

  return (
    <div className={shellClass}>
      {!bare && (
        <div className={`border-b pb-2 ${theme.toolbarDivider}`}>
          <h3 className="text-sm font-semibold text-ink">Next 7 days</h3>
          <p className="text-[11px] text-ink-muted">
            From {formatShortDate(DEMO_AS_OF_DATE)} · {upcoming} scheduled
          </p>
        </div>
      )}
      {assigneeBreakdown.length > 0 && (
        <div className={operationsSummaryStripClass}>
          {assigneeBreakdown.map(({ assignee, count }) => (
            <span key={assignee} className={theme.operationsSummaryChip}>
              {assignee} · {count}
            </span>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className={`mt-3 text-center ${density.meta} text-ink-muted`}>
          No upcoming appointments in this window.
        </p>
      ) : (
        <ul className={`mt-3 divide-y ${theme.widgetListDivide} ${theme.widgetListShell} ${density.text}`}>
          {visible.map((appt) => {
            const { date, time } = formatDateTime(appt.startAt);
            return (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => onSelectAppointment(appt.id)}
                  className={`flex w-full flex-col gap-0.5 px-3 text-left sm:flex-row sm:items-center sm:justify-between ${density.rowPy} ${
                    selectedAppointmentId === appt.id
                      ? theme.operationsListSelected
                      : `${operationsListRowBase} ${theme.operationsListHover}`
                  }`}
                >
                  <p className="min-w-0 flex-1 truncate font-semibold text-ink">{appt.title}</p>
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
          <Link
            href={scheduleHref}
            className={`font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
          >
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
      ? "border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-100/90 text-amber-950 ring-1 ring-amber-200/50"
      : status === "Open"
        ? "border-slate-200 bg-gradient-to-b from-slate-50 to-white text-slate-800 ring-1 ring-slate-200/60"
        : "border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-emerald-100/70 text-emerald-900 ring-1 ring-emerald-200/50";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${cls}`}>
      {status}
    </span>
  );
}
