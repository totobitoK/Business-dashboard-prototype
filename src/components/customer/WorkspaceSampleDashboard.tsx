"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  isDateInRange,
  isDateOnOrBeforeDemo,
  type ReportingPeriodPreset,
} from "@/lib/workspace-reporting-period";
import {
  DEMO_AS_OF_DATE,
  getWorkspaceBusinessData,
  type BusinessInvoice,
  type BusinessJob,
} from "@/lib/workspace-business-data";
import {
  defaultLiveRangeStart,
  describeLiveFigures,
  liveBusinessData,
  type LiveFigures,
} from "@/lib/daily-dashboard/live-figures";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
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
import { DashboardRangeCalendar } from "@/components/customer/DashboardDatePicker";
import { DashboardShell } from "@/components/customer/DashboardWorkspaceNav";
import {
  keepDashboardSectionClick,
  useDashboardSection,
} from "@/components/customer/dashboard-section-context";
import {
  dashboardRoutesForPathname,
  dashboardSectionHref,
} from "@/lib/dashboard-section-routes";
import { CollectionsTrendChart } from "@/components/customer/CollectionsTrendChart";
import { DashboardSection } from "@/components/customer/DashboardSection";
import { KpiStatCard } from "@/components/customer/KpiStatCard";
import {
  DashboardChipGroup,
  DashboardControlBar,
  DashboardSearchInput,
  DashboardSecondaryButton,
  DashboardSelect,
} from "@/components/customer/dashboard-controls";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";
import { getOperationsListDensity } from "@/lib/operations-list-density";
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

const widgetListRowClass = "transition-colors";

/** Job activity + Next 7 days lists — subtle hover only (no left accent). */
const operationsListRowBase = "transition-colors";

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
];

const OVERVIEW_CHART_HEIGHT = 220;

function openInvoiceGroups(invoices: BusinessInvoice[]): { currency: string; amount: number; count: number }[] {
  const groups = new Map<string, { amount: number; count: number }>();
  for (const invoice of invoices) {
    if (invoice.balanceDue <= 0 || invoice.status === "Paid") continue;
    const currency = invoice.currency?.trim() || "USD";
    const current = groups.get(currency) ?? { amount: 0, count: 0 };
    current.amount += invoice.balanceDue;
    current.count += 1;
    groups.set(currency, current);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)))
    .map(([currency, value]) => ({ currency, ...value }));
}

function formatGroupedAmount(amount: number, currency: string, colorClass: string) {
  if (currency === "USD") {
    return (
      <CurrencyAmount
        amount={amount}
        colorClass={colorClass}
        className="text-2xl font-semibold tabular-nums leading-none"
      />
    );
  }
  return (
    <span className={`text-2xl font-semibold tabular-nums leading-none ${colorClass}`}>
      {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)}
    </span>
  );
}

function completedJobAmount(
  jobs: BusinessJob[],
  range: { start: string; end: string; preset: ReportingPeriodPreset }
): number {
  return jobs.reduce((sum, job) => {
    if (job.status !== "completed" || !job.completedDate) return sum;
    if (!isDateOnOrBeforeDemo(job.completedDate) || !isDateInRange(job.completedDate, range)) return sum;
    return sum + job.amount;
  }, 0);
}

export function WorkspaceSampleDashboard({
  changesRequestedNote,
  mode = "overview",
  liveSnapshot = null,
}: {
  changesRequestedNote?: string;
  mode?: "overview" | "revenue";
  /** Signed-in company read. Demo routes leave this null and use sample records. */
  liveSnapshot?: DailyDashboardSnapshot | null;
}) {
  const {
    workspaceId,
    theme,
    settings,
    workspaceSessionKey,
    navigationBase,
    liveSamplePreview,
  } = useCustomerPortal();
  const pathname = usePathname();
  const selectSection = useDashboardSection()?.selectSection;
  const portalRoutes = dashboardRoutesForPathname(pathname);
  const sectionLinkBase = navigationBase ?? portalRoutes.home;
  const [preset, setPreset] = useState<ReportingPeriodPreset>("custom");
  const [customStart, setCustomStart] = useState(
    liveSnapshot ? defaultLiveRangeStart(liveSnapshot.asOfDate) : "2026-03-01"
  );
  const [customEnd, setCustomEnd] = useState(liveSnapshot?.asOfDate ?? DEMO_AS_OF_DATE);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"all" | "Open" | "Past due" | "Paid">("all");
  const [invoiceSort, setInvoiceSort] = useState<"dueDate" | "balance">("dueDate");
  const [invoiceLimit, setInvoiceLimit] = useState(INVOICE_PAGE_SIZE);
  const [insightFocus, setInsightFocus] = useState<"none" | "overdue">("none");
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const [showJobList, setShowJobList] = useState(false);
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

  const data = useMemo(
    () => (liveSnapshot ? liveBusinessData(liveSnapshot) : getWorkspaceBusinessData(workspaceId)),
    [liveSnapshot, workspaceId]
  );

  const analyticsCore = useMemo(() => {
    if (!data || !rangeResult.range) return null;
    const range = rangeResult.range;
    const compareRange = getComparisonRange(range);
    const live = liveSnapshot ? describeLiveFigures(liveSnapshot, range) : null;

    const paymentsCollected =
      live?.paymentsAmount ?? sumPaymentsInRange(data.payments, range);
    const paymentsPrior = sumPaymentsInRange(data.payments, compareRange);
    const jobsCompleted = countCompletedJobsInRange(data.jobs, range);
    const jobsPrior = countCompletedJobsInRange(data.jobs, compareRange);
    const outstanding = liveSnapshot?.receivables.showBalances
      ? (liveSnapshot.receivables.openBalance ?? 0)
      : sumOutstandingInvoices(data.invoices);
    const overdue = liveSnapshot?.receivables.showBalances
      ? (liveSnapshot.receivables.overdueBalance ?? 0)
      : sumOverdueInvoices(data.invoices, data.demoAsOf);
    const overdueCount = liveSnapshot?.receivables.showBalances
      ? liveSnapshot.receivables.overdueCount
      : countOverdueInvoices(data.invoices, data.demoAsOf);
    const oldestDays = oldestUnpaidInvoiceDaysOverdue(data.invoices, data.demoAsOf);
    const trend = live?.trend ?? buildCollectionsTrend(data.payments, range);
    const trendTotal = trend.reduce((s, b) => s + b.amount, 0);
    const aging = invoiceAgingBuckets(data.invoices, data.demoAsOf);
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
      upcoming: countUpcomingAppointments(data.appointments, 7, data.demoAsOf),
      upcomingList: listUpcomingAppointments(data.appointments, 7, data.demoAsOf),
      asOfDate: data.demoAsOf,
      live,
      ...revenueOverview,
    };
  }, [data, liveSnapshot, rangeResult.range]);

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

  const invoiceGroups = liveSnapshot?.receivables.showBalances
    ? [
        {
          currency: "USD",
          amount: liveSnapshot.receivables.openBalance ?? 0,
          count: liveSnapshot.receivables.invoiceCount,
        },
      ]
    : openInvoiceGroups(data.invoices);
  const openInvoiceCount = invoiceGroups.reduce((sum, group) => sum + group.count, 0);
  const summaryActionClass = `text-xs font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`;

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
        settingsHref={portalRoutes.settings}
      />
    ),
    collections_chart:
      computed.live?.chartMessage && !computed.live.trend ? (
        <p className={`px-1 text-sm text-ink-muted ${mode === "overview" ? "py-4 text-left" : "py-8 text-center"}`}>
          {computed.live.chartMessage}
        </p>
      ) : (
        <CollectionsTrendChart
          trend={computed.trend}
          theme={theme}
          height={mode === "overview" ? OVERVIEW_CHART_HEIGHT : undefined}
        />
      ),
    job_activity: computed.live ? (
      <p className={`px-1 text-sm text-ink-muted ${mode === "overview" ? "py-1 text-left" : "py-8 text-center"}`}>
        {computed.live.jobsMessage}
      </p>
    ) : mode === "overview" && !showJobList ? (
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <SummaryFigure
          label="Completed"
          value={
            <span className={`text-2xl font-semibold tabular-nums leading-none ${theme.metricValueA}`}>
              {computed.jobsCompleted}
            </span>
          }
        />
        <SummaryFigure
          label="Completed value"
          value={formatGroupedAmount(
            completedJobAmount(data.jobs, computed.range),
            "USD",
            theme.metricValueA
          )}
        />
      </div>
    ) : (
      <>
        {mode === "overview" ? <div className="mb-3">{jobActivityToolbar}</div> : null}
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
      </>
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
        asOf={computed.asOfDate}
        scheduleHref={dashboardSectionHref(workspaceId, "schedule", sectionLinkBase)}
        embedded
        bare
        summary={mode === "overview"}
      />
    ),
    invoices: computed.live?.receivablesMessage ? (
      <p
        className={`text-sm text-ink-muted ${
          mode === "overview" ? "px-1 py-1 text-left" : `px-4 py-8 text-center ${theme.widgetListShell}`
        }`}
      >
        {computed.live.receivablesMessage}
      </p>
    ) : (
      <div key="invoices">
        {mode === "overview" ? (
          <div className={`flex flex-wrap gap-x-8 gap-y-3 ${showInvoiceList ? "mb-4" : ""}`}>
            <SummaryFigure
              label="Open invoices"
              value={
                <span className={`text-2xl font-semibold tabular-nums leading-none ${theme.metricValueA}`}>
                  {openInvoiceCount}
                </span>
              }
            />
            {invoiceGroups.map((group) => (
              <SummaryFigure
                key={group.currency}
                label={
                  invoiceGroups.length > 1 ? `Outstanding · ${group.currency}` : "Outstanding"
                }
                value={formatGroupedAmount(group.amount, group.currency, theme.metricValueA)}
              />
            ))}
          </div>
        ) : null}
        {mode === "overview" && !showInvoiceList ? null : (
        <>
        {mode === "overview" ? <div className="mb-3">{invoiceToolbar}</div> : null}
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
                      className={`cursor-pointer ${widgetListRowClass} ${
                        selectedInvoiceId === inv.id
                          ? `h-12 text-base ${theme.tableRowSelected} ${theme.tableRowSelectedInset} ${theme.metricValueA}`
                          : `h-10 text-sm ${idx % 2 === 1 ? theme.widgetListRowAlt : theme.widgetListRow} ${theme.operationsListHover}`
                      }`}
                      onClick={() => {
                        setSelectedInvoiceId(inv.id);
                        setSelectedJobId(null);
                        setSelectedAppointmentId(null);
                      }}
                    >
                      <td className={`truncate px-3 py-2.5 font-mono font-semibold ${selectedInvoiceId === inv.id ? "text-sm" : "text-xs"} ${theme.metricValueA}`}>
                        {inv.href ? (
                          <a
                            href={inv.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="underline decoration-current/40 underline-offset-2"
                          >
                            {inv.invoiceNumber}
                          </a>
                        ) : (
                          inv.invoiceNumber
                        )}
                      </td>
                      <td className="truncate px-3 py-2.5 font-medium text-ink">{inv.customer}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{formatShortDate(inv.dueDate)}</td>
                      <td className={`px-3 py-2.5 font-semibold ${theme.metricValueA}`}>
                        <CurrencyAmount amount={inv.balanceDue} colorClass={theme.metricValueA} />
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
                        className={`${i % 2 === 1 ? theme.widgetListRowAlt : theme.widgetListRow} border-transparent`}
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
        </>
        )}
      </div>
    ),
  };

  return (
    <DashboardShell
      key={`${workspaceId}-${workspaceSessionKey}`}
      title={mode === "revenue" ? "Revenue" : "Overview"}
      trailing={
        <>
          {liveSnapshot ? null : (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}>
              Sample data
            </span>
          )}
          <DashboardRangeCalendar
            start={customStart}
            end={customEnd}
            theme={theme}
            onChange={(start, end) => {
              setPreset("custom");
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />
        </>
      }
    >
      {rangeError && (
        <p className="bg-amber-100 px-4 py-2 text-xs text-amber-950" role="alert">
          {rangeError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {changesRequestedNote && (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-ink">
            {changesRequestedNote}
          </p>
        )}

        {(mode === "overview" ? renderOverviewRows : renderWidgetRows)(
          visibleWidgets,
          widgetBlocks,
          theme,
          compact,
          (id) => {
          const rangeLabel = formatRangeForDisplay(computed.range);
          const summaryAlign = mode === "overview" ? ("left" as const) : ("center" as const);
          switch (id) {
            case "metrics":
              return {
                title: "Revenue Overview",
                subtitle: rangeLabel,
                subtitleAlign: "center" as const,
              };
            case "collections_chart":
              return {
                title: "Collections trend",
                subtitle:
                  computed.live?.chartMessage && !computed.live.trend
                    ? computed.live.chartMessage
                    : computed.live?.trend
                      ? `${rangeLabel} · Square net before fees`
                      : (
                        <>
                          {rangeLabel} · Total{" "}
                          <CurrencyAmount
                            amount={computed.trendTotal}
                            colorClass={theme.metricValueA}
                            className="inline font-semibold tabular-nums"
                          />
                        </>
                      ),
                subtitleAlign: summaryAlign,
                titleAlign: summaryAlign,
                tightToolbar: true,
              };
            case "job_activity":
              return {
                title: "Job activity",
                subtitle: rangeLabel,
                subtitleAlign: summaryAlign,
                titleAlign: summaryAlign,
                headerAside:
                  mode === "overview" && !computed.live ? (
                    <button
                      type="button"
                      className={summaryActionClass}
                      onClick={() => setShowJobList((open) => !open)}
                    >
                      {showJobList ? "Hide jobs" : "View jobs"}
                    </button>
                  ) : computed.live
                    ? undefined
                    : jobActivityToolbar,
                tightToolbar: true,
              };
            case "appointments":
              return {
                title: "Next 7 days",
                subtitle: computed.live?.scheduleBlocked
                  ? computed.live.scheduleBlocked
                  : `${computed.upcoming} upcoming · from ${formatShortDate(computed.asOfDate)}${
                      computed.live?.scheduleNote ? ` · ${computed.live.scheduleNote}` : ""
                    }`,
                subtitleAlign: summaryAlign,
                titleAlign: summaryAlign,
                headerAside: (
                  <Link
                    href={dashboardSectionHref(workspaceId, "schedule", sectionLinkBase)}
                    onClick={(event) => keepDashboardSectionClick(event, selectSection, "schedule")}
                    className={
                      mode === "overview"
                        ? summaryActionClass
                        : `inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold shadow-sm transition ${theme.filterSecondaryButton}`
                    }
                  >
                    Schedule
                  </Link>
                ),
              };
            case "invoices":
              return {
                title: "Invoices",
                subtitle:
                  mode === "overview" ? (
                    computed.live?.receivablesMessage ? (
                      computed.live.receivablesMessage
                    ) : (
                      `As of ${formatShortDate(computed.asOfDate)}`
                    )
                  ) : computed.live?.receivablesMessage ? (
                    computed.live.receivablesMessage
                  ) : (
                    <>
                      {computed.invoices.length} shown · filtered balance{" "}
                      <CurrencyAmount
                        amount={computed.filteredBalance}
                        colorClass={theme.metricValueA}
                        className="inline font-semibold tabular-nums"
                      />
                    </>
                  ),
                subtitleAlign: summaryAlign,
                titleAlign: summaryAlign,
                headerAside:
                  mode === "overview" ? (
                    computed.live?.receivablesMessage ? undefined : (
                      <button
                        type="button"
                        className={summaryActionClass}
                        onClick={() => setShowInvoiceList((open) => !open)}
                      >
                        {showInvoiceList ? "Hide invoices" : "View invoices"}
                      </button>
                    )
                  ) : computed.live?.receivablesMessage ? undefined : (
                    invoiceToolbar
                  ),
                tightToolbar: true,
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
              {selectedInvoice.href ? (
                <a
                  href={selectedInvoice.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-1 inline-flex text-xs font-semibold ${theme.linkAccent} ${theme.linkAccentHover}`}
                >
                  Open in QuickBooks
                </a>
              ) : null}
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Amount</dt>
                  <dd>
                    <CurrencyAmount amount={selectedInvoice.amount} colorClass={theme.metricValueA} />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Remaining balance</dt>
                  <dd>
                    <CurrencyAmount amount={selectedInvoice.balanceDue} colorClass={theme.metricValueA} />
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
                      {formatShortDate(p.date)} ·{" "}
                      <CurrencyAmount amount={p.amount} colorClass={theme.metricValueA} className="inline" />
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
                <CurrencyAmount amount={selectedJob.amount} colorClass={theme.metricValueA} className="inline" />
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
    </DashboardShell>
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
  asOfDate: string;
  live: LiveFigures | null;
};

function MetricsKpiGrid({
  mode,
  compact,
  theme,
  computed,
  overviewKpiIds,
  revenueKpiIds,
  liveSamplePreview,
  settingsHref,
}: {
  mode: "overview" | "revenue";
  compact: boolean;
  theme: LayoutCustomizeTheme;
  computed: MetricsKpiComputed;
  overviewKpiIds: OverviewKpiId[];
  revenueKpiIds: RevenueKpiId[];
  liveSamplePreview?: boolean;
  settingsHref: string;
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
              href={settingsHref}
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
      ? "xl:grid-cols-1"
      : ids.length === 2
        ? "xl:grid-cols-2"
        : ids.length === 3
          ? "xl:grid-cols-3"
          : "xl:grid-cols-4";
  const columns =
    mode === "overview" ? `grid-cols-1 ${lgCols}` : `grid-cols-1 sm:grid-cols-2 ${lgCols.replaceAll("xl:", "lg:")}`;

  return (
    <div key="metrics" className={`grid gap-3 ${columns}`}>
      {mode === "revenue"
        ? revenueKpiIds.map((id, index) => (
            <KpiStatCard
              key={id}
              compact={compact}
              label={REVENUE_KPI_LABELS[id]}
              accentClass={theme.metricValueA}
              {...revenueKpiCardProps(id, computed, theme, index)}
            />
          ))
        : overviewKpiIds.map((id, index) => (
            <KpiStatCard
              key={id}
              compact={compact}
              label={OVERVIEW_KPI_LABELS[id]}
              accentClass={theme.metricValueA}
              {...overviewKpiCardProps(id, computed, theme, index)}
            />
          ))}
    </div>
  );
}

function unavailableCard(message: string, className: string) {
  return {
    sub: "No figure is shown for this metric.",
    value: <span className="block text-sm font-semibold leading-snug">{message}</span>,
    className,
  };
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
      if (computed.live) return unavailableCard(computed.live.revenueMessage, className);
      return {
        higherIsBetter: true,
        sub: computed.weeklyRangeLabel,
        compare: computed.weeklyRevenueCompare.text,
        compareTone: computed.weeklyRevenueCompare.tone,
        value: (
          <CurrencyAmount
            amount={computed.weeklyRevenue}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
    case "monthly_revenue":
      if (computed.live) return unavailableCard(computed.live.revenueMessage, className);
      return {
        higherIsBetter: true,
        sub: computed.monthlyRangeLabel,
        compare: computed.monthlyRevenueCompare.text,
        compareTone: computed.monthlyRevenueCompare.tone,
        value: (
          <CurrencyAmount
            amount={computed.monthlyRevenue}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
    case "month_pipeline":
      if (computed.live) return unavailableCard(computed.live.pipelineMessage, className);
      return {
        sub: computed.monthPipelineLabel,
        value: (
          <CurrencyAmount
            amount={computed.monthPipeline}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
    case "overdue_ar":
      if (computed.live?.receivablesMessage) {
        return unavailableCard(computed.live.receivablesMessage, className);
      }
      return {
        higherIsBetter: false,
        sub: `As of ${formatShortDate(computed.asOfDate)}`,
        value: (
          <CurrencyAmount
            amount={computed.overdue}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
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
      if (computed.live?.paymentsMessage) {
        return unavailableCard(computed.live.paymentsMessage, className);
      }
      if (computed.live) {
        return {
          higherIsBetter: true,
          sub: `${formatRangeForDisplay(computed.range)}${
            computed.live.paymentsCurrency ? ` · ${computed.live.paymentsCurrency}` : ""
          }`,
          value:
            computed.live.paymentsCurrency && computed.live.paymentsCurrency !== "USD" ? (
              <span className={`text-xl font-bold tabular-nums sm:text-2xl ${theme.metricValueA}`}>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: computed.live.paymentsCurrency,
                }).format(computed.live.paymentsAmount ?? 0)}
              </span>
            ) : (
              <CurrencyAmount
                amount={computed.live.paymentsAmount ?? 0}
                colorClass={theme.metricValueA}
                className="text-xl font-bold tabular-nums sm:text-2xl"
              />
            ),
          className,
        };
      }
      return {
        higherIsBetter: true,
        sub: formatRangeForDisplay(computed.range),
        compare: computed.paymentsCompare.text,
        compareTone: computed.paymentsCompare.tone,
        value: (
          <CurrencyAmount
            amount={computed.paymentsCollected}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
    case "jobs_completed":
      if (computed.live) return unavailableCard(computed.live.jobsMessage, className);
      return {
        higherIsBetter: true,
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
      if (computed.live?.receivablesMessage) {
        return unavailableCard(computed.live.receivablesMessage, className);
      }
      return {
        higherIsBetter: false,
        sub: `As of ${formatShortDate(computed.asOfDate)}`,
        value: (
          <CurrencyAmount
            amount={computed.outstanding}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
    case "overdue_balance":
      if (computed.live?.receivablesMessage) {
        return unavailableCard(computed.live.receivablesMessage, className);
      }
      return {
        higherIsBetter: false,
        sub: `As of ${formatShortDate(computed.asOfDate)}`,
        value: (
          <CurrencyAmount
            amount={computed.overdue}
            colorClass={theme.metricValueA}
            className="text-xl font-bold tabular-nums sm:text-2xl"
          />
        ),
        className,
      };
  }
}
const OPERATIONS_PAIR: DashboardWidgetId[] = ["job_activity", "appointments"];

type WidgetSectionMeta = {
  title: string;
  subtitle?: ReactNode;
  headerAside?: ReactNode;
  accent?: "default" | "alert";
  tightToolbar?: boolean;
  subtitleAlign?: "left" | "center" | "right";
  titleAlign?: "left" | "center";
  fill?: boolean;
};

function SummaryFigure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-2xl font-semibold leading-none tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function renderOverviewRows(
  visibleWidgets: DashboardWidgetId[],
  widgetBlocks: Record<DashboardWidgetId, ReactNode>,
  theme: LayoutCustomizeTheme,
  compact: boolean,
  sectionFor: (id: DashboardWidgetId) => WidgetSectionMeta
) {
  const rows: ReactNode[] = [];
  const skip = new Set<DashboardWidgetId>();
  const visible = (id: DashboardWidgetId) => visibleWidgets.includes(id);

  const wrapSection = (id: DashboardWidgetId, fill = false) => {
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
        subtitleAlign={meta.subtitleAlign ?? "left"}
        titleAlign={meta.titleAlign ?? "left"}
        fill={fill || meta.fill}
      >
        {widgetBlocks[id]}
      </DashboardSection>
    );
  };

  for (const id of visibleWidgets) {
    if (skip.has(id)) continue;

    if (id === "metrics") {
      rows.push(
        <div key="metrics">{widgetBlocks.metrics}</div>
      );
      continue;
    }

    if (id === "collections_chart" || id === "appointments") {
      const showChart = visible("collections_chart");
      const showAppointments = visible("appointments");
      if (showChart) skip.add("collections_chart");
      if (showAppointments) skip.add("appointments");
      rows.push(
        <div key="focus-row" className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
          {showChart ? (
            <div className={showAppointments ? "min-w-0 xl:col-span-2" : "min-w-0 xl:col-span-3"}>
              {wrapSection("collections_chart")}
            </div>
          ) : null}
          {showAppointments ? (
            <div className={showChart ? "flex min-w-0 xl:col-span-1" : "min-w-0 xl:col-span-3"}>
              {wrapSection("appointments", true)}
            </div>
          ) : null}
        </div>
      );
      continue;
    }

    if (id === "invoices" || id === "job_activity") {
      const ordered = (["invoices", "job_activity"] as const).filter((widget) => visible(widget));
      ordered.forEach((widget) => skip.add(widget));
      rows.push(
        <div
          key="summary-row"
          className={`grid grid-cols-1 gap-3 ${ordered.length > 1 ? "xl:grid-cols-2" : ""}`}
        >
          {ordered.map((widget) => wrapSection(widget))}
        </div>
      );
    }
  }

  return <div className="flex flex-col gap-3 p-3 sm:p-4">{rows}</div>;
}

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
        titleAlign={meta.titleAlign}
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
                  className={`flex w-full flex-col gap-0.5 px-3 text-left sm:flex-row sm:items-center sm:justify-between ${density.rowPy} ${
                    selectedJobId === job.id
                      ? `text-sm font-medium ${theme.operationsListSelected} ${theme.metricValueA}`
                      : `text-ink ${density.text} ${operationsListRowBase} ${theme.widgetListRow} ${theme.operationsListHover}`
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {job.serviceType}
                      {" · "}
                      <CurrencyAmount
                        amount={job.amount}
                        colorClass={theme.metricValueA}
                        className="inline font-medium"
                      />
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
  asOf = DEMO_AS_OF_DATE,
  scheduleHref,
  embedded = false,
  bare = false,
  summary = false,
}: {
  compact: boolean;
  theme: ReturnType<typeof useCustomerPortal>["theme"];
  upcoming: number;
  upcomingList: ReturnType<typeof listUpcomingAppointments>;
  selectedAppointmentId: string | null;
  onSelectAppointment: (id: string) => void;
  formatDateTime: (iso: string) => { date: string; time: string };
  asOf?: string;
  scheduleHref: string;
  embedded?: boolean;
  bare?: boolean;
  summary?: boolean;
}) {
  const selectSection = useDashboardSection()?.selectSection;
  const pad = compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4";
  const density = getOperationsListDensity(upcomingList.length);
  const visible = upcomingList.slice(0, summary ? 3 : density.maxVisible);
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
            From {formatShortDate(asOf)} · {upcoming} scheduled
          </p>
        </div>
      )}
      {!summary && assigneeBreakdown.length > 0 && (
        <div className={operationsSummaryStripClass}>
          {assigneeBreakdown.map(({ assignee, count }) => (
            <span key={assignee} className={theme.operationsSummaryChip}>
              {assignee} · {count}
            </span>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className={`${summary ? "text-left" : "mt-3 text-center"} ${density.meta} text-ink-muted`}>
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
                      ? `text-sm font-medium ${theme.operationsListSelected} ${theme.metricValueA}`
                      : `${density.text} ${operationsListRowBase} ${theme.widgetListRow} ${theme.operationsListHover}`
                  }`}
                >
                  <p className={`min-w-0 flex-1 truncate font-semibold ${selectedAppointmentId === appt.id ? "" : "text-ink"}`}>
                    {appt.title}
                  </p>
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
            onClick={(event) => keepDashboardSectionClick(event, selectSection, "schedule")}
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
