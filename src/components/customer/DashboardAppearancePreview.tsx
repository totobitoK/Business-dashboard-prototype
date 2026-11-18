"use client";

import { CollectionsTrendChart } from "@/components/customer/CollectionsTrendChart";
import { SalesInsightCards } from "@/components/customer/SalesInsightCards";
import { SalesPipelineCard, WonPeriodCard } from "@/components/customer/PipelinePanel";
import { buildPipelineView } from "@/lib/hubspot-pipeline";
import { SAMPLE_PIPELINE_READ } from "@/lib/hubspot-pipeline-sample";
import type { SalesInsight } from "@/lib/sales-insight";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  CONNECT_SOURCE_PROMPT,
  type CustomerDashboardComposition,
} from "@/lib/dashboard-composition";
import { DashboardSection } from "@/components/customer/DashboardSection";
import { KpiStatCard } from "@/components/customer/KpiStatCard";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { isLightDashboardTheme, type LayoutCustomizeTheme } from "@/lib/layout-customize-themes";
import { DEMO_AS_OF_DATE } from "@/lib/workspace-demo-date";
import {
  OVERVIEW_KPI_LABELS,
  REVENUE_KPI_LABELS,
  type OverviewKpiId,
  type RevenueKpiId,
} from "@/lib/workspace-kpi-layout";
import {
  BUSINESS_TIMEZONE,
  addCalendarDays,
  formatCalendarDateDisplay,
  formatRangeForDisplay,
  resolveReportingRange,
} from "@/lib/workspace-reporting-period";
import type { TrendBucket } from "@/lib/workspace-analytics";

const PREVIEW_APPOINTMENTS = [
  { title: "Estimate — Plaza HVAC", when: "Mar 31 · 10:00 AM", assignee: "Tech team B" },
  { title: "Filter delivery — Oak St", when: "Apr 1 · 8:30 AM", assignee: "Maria Santos" },
] as const;

const PREVIEW_INVOICES = [
  { id: "INV-1042", customer: "Oak Street Residence", due: "Apr 5", balance: 420 },
  { id: "INV-1038", customer: "Plaza Office Park", due: "Mar 30", balance: 1280 },
] as const;

function buildPreviewTrend(): TrendBucket[] {
  const resolved = resolveReportingRange("last7");
  if (!resolved.ok) return [];
  const amounts = [4200, 5100, 3800, 6200, 5500, 7100, 4800];
  const buckets: TrendBucket[] = [];
  let day = resolved.range.start;
  for (let i = 0; i < 7; i++) {
    buckets.push({
      label: "",
      start: day,
      end: day,
      amount: amounts[i] ?? 4000,
    });
    day = addCalendarDays(day, 1);
  }
  return buckets;
}

const PREVIEW_TREND = buildPreviewTrend();
const PREVIEW_TREND_TOTAL = PREVIEW_TREND.reduce((sum, b) => sum + b.amount, 0);
const previewPlaza = Math.round(PREVIEW_TREND_TOTAL * 0.28);
const previewOak = Math.round(PREVIEW_TREND_TOTAL * 0.19);
const previewHarbor = Math.round(PREVIEW_TREND_TOTAL * 0.11);
const previewOtherAccounts = PREVIEW_TREND_TOTAL - previewPlaza - previewOak - previewHarbor;
const previewWholesale = Math.round(PREVIEW_TREND_TOTAL * 0.45);
const previewInstore = Math.round(PREVIEW_TREND_TOTAL * 0.33);
const previewEvents = PREVIEW_TREND_TOTAL - previewWholesale - previewInstore;
const PREVIEW_PIPELINE = buildPipelineView({
  read: SAMPLE_PIPELINE_READ,
  range: { start: "2026-03-01", end: "2026-03-12", preset: "mtd" },
  timeZone: BUSINESS_TIMEZONE,
});
const previewLargest = Math.round(PREVIEW_TREND_TOTAL * 0.12);
const PREVIEW_SALES: SalesInsight = {
  total: PREVIEW_TREND_TOTAL,
  count: 18,
  average: Math.round(PREVIEW_TREND_TOTAL / 18),
  median: 1800,
  largest: {
    label: "Plaza Office Park",
    amount: previewLargest,
    count: 1,
    share: PREVIEW_TREND_TOTAL > 0 ? previewLargest / PREVIEW_TREND_TOTAL : 0,
  },
  compare: { text: "+12% vs comparison window", tone: "up" },
  accountCount: 11,
  repeatAccountCount: 4,
  topAccountShare: previewPlaza / PREVIEW_TREND_TOTAL,
  topAccounts: [
    { label: "Plaza Office Park", amount: previewPlaza, count: 4, share: previewPlaza / PREVIEW_TREND_TOTAL },
    { label: "Oak Street Residence", amount: previewOak, count: 3, share: previewOak / PREVIEW_TREND_TOTAL },
    { label: "Harbor Market", amount: previewHarbor, count: 2, share: previewHarbor / PREVIEW_TREND_TOTAL },
    { label: "Other", amount: previewOtherAccounts, count: 9, share: previewOtherAccounts / PREVIEW_TREND_TOTAL },
  ],
  mixLabel: "Invoice lines",
  mixTotal: PREVIEW_TREND_TOTAL,
  mix: [
    { label: "Wholesale restock", amount: previewWholesale, count: 6, share: previewWholesale / PREVIEW_TREND_TOTAL },
    { label: "In-store POS", amount: previewInstore, count: 8, share: previewInstore / PREVIEW_TREND_TOTAL },
    { label: "Pop-up market", amount: previewEvents, count: 4, share: previewEvents / PREVIEW_TREND_TOTAL },
  ],
};

function overviewPreviewProps(
  id: OverviewKpiId,
  rangeLabel: string,
  theme: LayoutCustomizeTheme,
  _index: number
) {
  const className = theme.kpiCard;
  const asOf = formatCalendarDateDisplay(DEMO_AS_OF_DATE);
  switch (id) {
    case "payments_collected":
      return {
        higherIsBetter: true,
        sub: rangeLabel,
        compare: "+8.2% vs prior period",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount
            amount={18400}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "jobs_completed":
      return {
        higherIsBetter: true,
        sub: rangeLabel,
        compare: "+3 vs prior period",
        compareTone: "up" as const,
        value: (
          <span className={`text-xl font-medium tabular-nums sm:text-2xl ${theme.metricValueA}`}>24</span>
        ),
        className,
      };
    case "outstanding_balance":
      return {
        higherIsBetter: false,
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount
            amount={12800}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "overdue_balance":
      return {
        higherIsBetter: false,
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount
            amount={3100}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
  }
}

function revenuePreviewProps(
  id: RevenueKpiId,
  rangeLabel: string,
  theme: LayoutCustomizeTheme,
  _index: number
) {
  const className = theme.kpiCard;
  const asOf = formatCalendarDateDisplay(DEMO_AS_OF_DATE);
  switch (id) {
    case "weekly_revenue":
      return {
        higherIsBetter: true,
        sub: rangeLabel,
        compare: "+5.1% vs prior 7 days",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount
            amount={11200}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "monthly_revenue":
      return {
        higherIsBetter: true,
        sub: "Month to date",
        compare: "+4.0% vs same days last month",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount
            amount={48200}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "month_pipeline":
      return {
        sub: "Scheduled + in progress",
        value: (
          <CurrencyAmount
            amount={62000}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
    case "overdue_ar":
      return {
        higherIsBetter: false,
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount
            amount={3100}
            colorClass={theme.metricValueA}
            className="text-xl font-bold sm:text-2xl"
          />
        ),
        className,
      };
  }
}

function PreviewMetricsGrid({
  kpiTab,
  visibleOverviewKpis,
  visibleRevenueKpis,
  theme,
  compact,
  rangeLabel,
}: {
  kpiTab: "overview" | "revenue";
  visibleOverviewKpis: OverviewKpiId[];
  visibleRevenueKpis: RevenueKpiId[];
  theme: LayoutCustomizeTheme;
  compact?: boolean;
  rangeLabel: string;
}) {
  const ids =
    kpiTab === "revenue"
      ? visibleRevenueKpis
      : (visibleOverviewKpis as (OverviewKpiId | RevenueKpiId)[]);

  if (ids.length === 0) {
    return (
      <p
        className={`rounded-lg px-4 py-6 text-center text-sm text-ink ${theme.sectionPanel}`}
      >
        Turn on at least one KPI below.
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

  const columns =
    kpiTab === "overview"
      ? `grid-cols-1 ${lgCols.replaceAll("lg:", "xl:")}`
      : `grid-cols-1 sm:grid-cols-2 ${lgCols}`;

  return (
    <div className={`grid gap-3 ${columns}`}>
      {kpiTab === "revenue"
        ? visibleRevenueKpis.map((id, index) => (
            <KpiStatCard
              key={id}
              compact={compact}
              label={REVENUE_KPI_LABELS[id]}
              accentClass={theme.metricValueA}
              {...revenuePreviewProps(id, rangeLabel, theme, index)}
            />
          ))
        : visibleOverviewKpis.map((id, index) => (
            <KpiStatCard
              key={id}
              compact={compact}
              label={OVERVIEW_KPI_LABELS[id]}
              accentClass={theme.metricValueA}
              {...overviewPreviewProps(id, rangeLabel, theme, index)}
            />
          ))}
    </div>
  );
}

function PreviewAction({ theme, label }: { theme: LayoutCustomizeTheme; label: string }) {
  return <span className={`text-xs font-semibold ${theme.linkAccent}`}>{label}</span>;
}

function PreviewInvoiceSummary({ theme }: { theme: LayoutCustomizeTheme }) {
  const outstanding = PREVIEW_INVOICES.reduce((sum, invoice) => sum + invoice.balance, 0);
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="min-w-0">
          <div className={`text-2xl font-semibold tabular-nums leading-none ${theme.metricValueA}`}>
            {PREVIEW_INVOICES.length}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Open invoices</p>
        </div>
        <div className="min-w-0">
          <CurrencyAmount
            amount={outstanding}
            colorClass={theme.metricValueA}
            className="text-2xl font-semibold tabular-nums"
          />
          <p className="mt-1 text-xs text-ink-muted">Outstanding</p>
        </div>
      </div>
      <ol className={`flex flex-col gap-1.5 border-t pt-2 ${isLightDashboardTheme(theme.id) ? theme.detailPanelBorder : "border-white/10"}`}>
        {PREVIEW_INVOICES.map((invoice) => (
          <li key={invoice.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{invoice.customer}</span>
            <CurrencyAmount
              amount={invoice.balance}
              colorClass={theme.metricValueA}
              className="text-sm font-semibold tabular-nums"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function PreviewJobSummary({ theme }: { theme: LayoutCustomizeTheme }) {
  const categories = [
    { category: "Maintenance", completed: 6 },
    { category: "Service", completed: 4 },
  ];
  const max = categories[0]?.completed || 1;
  const track = isLightDashboardTheme(theme.id) ? "bg-stone-200" : "bg-white/10";
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="min-w-0">
          <div className={`text-2xl font-semibold tabular-nums leading-none ${theme.metricValueA}`}>10</div>
          <p className="mt-1 text-xs text-ink-muted">Completed</p>
        </div>
        <div className="min-w-0">
          <CurrencyAmount
            amount={705}
            colorClass={theme.metricValueA}
            className="text-2xl font-semibold tabular-nums"
          />
          <p className="mt-1 text-xs text-ink-muted">Completed value</p>
        </div>
      </div>
      <ul className={`flex flex-col gap-1.5 border-t pt-2 ${isLightDashboardTheme(theme.id) ? theme.detailPanelBorder : "border-white/10"}`}>
        {categories.map((item) => (
          <li key={item.category} className="grid grid-cols-[6.75rem_1fr_1.5rem] items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{item.category}</span>
            <div className={`h-1 overflow-hidden rounded-full ${track}`}>
              <div
                className={`h-full rounded-full ${theme.chartBar}`}
                style={{ width: `${Math.max(8, Math.round((item.completed / max) * 100))}%` }}
              />
            </div>
            <span className="text-right text-sm tabular-nums text-ink">{item.completed}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewScheduleList({ theme, compact }: { theme: LayoutCustomizeTheme; compact?: boolean }) {
  const rowPy = compact ? "py-2" : "py-2.5";
  const meta = compact ? "text-[10px]" : "text-xs";
  return (
    <div className={`${theme.widgetListShell} ${compact ? "text-xs" : "text-sm"}`}>
      <ul className={`divide-y ${theme.widgetListDivide}`}>
        {PREVIEW_APPOINTMENTS.map((appt) => (
          <li key={appt.title}>
            <div className={`flex w-full flex-col items-start gap-0.5 px-3 text-left ${rowPy} ${theme.widgetListRow}`}>
              <p className="font-semibold text-ink">{appt.title}</p>
              <p className={meta}>
                <span className={`font-semibold ${theme.listAccent}`}>{appt.when}</span>
                <span className="text-ink-muted"> · {appt.assignee}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewInvoiceTable({
  theme,
  compact,
}: {
  theme: LayoutCustomizeTheme;
  compact?: boolean;
}) {
  const cell = compact ? "px-2 py-2 text-xs" : "px-3 py-2.5 text-sm";
  return (
    <div className={`overflow-x-auto ${theme.widgetListShell}`}>
      <table className="w-full min-w-[20rem] table-fixed text-center">
        <thead>
          <tr
            className={`${theme.widgetListHeader} text-[10px] font-bold uppercase tracking-wide text-ink-muted`}
          >
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Balance</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${theme.widgetListDivideLight}`}>
          {PREVIEW_INVOICES.map((inv, idx) => (
            <tr key={inv.id} className={idx % 2 === 0 ? theme.widgetListRowAlt : theme.widgetListRow}>
              <td className={`font-mono font-semibold ${theme.metricValueA} ${cell}`}>{inv.id}</td>
              <td className={`truncate font-medium text-ink ${cell}`}>{inv.customer}</td>
              <td className={`text-ink-muted ${cell}`}>{inv.due}</td>
              <td className={`font-semibold ${theme.metricValueA} ${cell}`}>
                <CurrencyAmount amount={inv.balance} colorClass={theme.metricValueA} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardAppearancePreview({
  theme,
  kpiTab,
  visibleOverviewKpis,
  visibleRevenueKpis,
  compact,
  composition = null,
}: {
  theme: LayoutCustomizeTheme;
  kpiTab: "overview" | "revenue";
  visibleOverviewKpis: OverviewKpiId[];
  visibleRevenueKpis: RevenueKpiId[];
  compact?: boolean;
  composition?: CustomerDashboardComposition | null;
}) {
  const { businessName } = useCustomerPortal();
  const resolved = resolveReportingRange("last7");
  const rangeLabel = resolved.ok ? formatRangeForDisplay(resolved.range) : "Last 7 days";
  const sections = composition
    ? DASHBOARD_SECTIONS.filter((section) => composition.sections.includes(section.id))
    : DASHBOARD_SECTIONS;
  const showChart = !composition || composition.widgets.includes("collections_chart");
  const showJobs = !composition || composition.widgets.includes("job_activity");
  const showSchedule = !composition || composition.widgets.includes("appointments");
  const showInvoices = !composition || composition.widgets.includes("invoices");
  const showPipeline = kpiTab === "overview" && (!composition || composition.sales);
  const visibleKpis = kpiTab === "revenue" ? visibleRevenueKpis : visibleOverviewKpis;
  const sectionAlign = kpiTab === "overview" ? "left" : "center";
  const chartSection = (
    <DashboardSection
      theme={theme}
      compact={compact}
      title="Collections trend"
      subtitle={
        <>
          {rangeLabel} · Total{" "}
          <CurrencyAmount
            amount={PREVIEW_TREND_TOTAL}
            colorClass={theme.metricValueA}
            className="inline font-semibold"
          />
        </>
      }
      subtitleAlign={sectionAlign}
      titleAlign={sectionAlign}
      tightToolbar
    >
      <CollectionsTrendChart trend={PREVIEW_TREND} theme={theme} />
    </DashboardSection>
  );

  return (
    <div className={`rounded-2xl shadow-card ${theme.card}`} aria-label="Sample dashboard preview">
      <div
        className={`relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 overflow-visible rounded-t-2xl px-4 py-3 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
        <p className="min-w-0 truncate text-lg font-semibold leading-none sm:text-xl">{businessName}</p>
        <div className="flex flex-wrap items-center gap-1" aria-hidden>
          {sections.map((section) => {
            const active =
              (section.id === "revenue" && kpiTab === "revenue") ||
              (section.id === "overview" && kpiTab === "overview");
            return (
              <span
                key={section.id}
                className={`rounded-md px-2.5 py-1 text-sm font-medium leading-none ${
                  active ? theme.embeddedNavActive : theme.headerLink
                }`}
              >
                {section.label}
              </span>
            );
          })}
          <span className={`rounded-md px-2.5 py-1 text-sm font-medium leading-none ${theme.headerLink}`}>
            Connections
          </span>
          <span className={`rounded-md px-2.5 py-1 text-sm font-medium leading-none ${theme.headerLink}`}>
            Settings
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center rounded-lg border border-white/30 bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
            {rangeLabel}
          </span>
        </div>
      </div>

      <div className={`overflow-hidden rounded-b-2xl ${theme.dashboardAtmosphere}`}>
        <div className={`flex flex-col gap-3 p-3 sm:p-4 ${theme.dashboardCanvas}`}>
          {composition?.promptToConnect ? (
            <p className={`px-4 py-10 text-center text-sm text-ink ${theme.sectionPanel}`}>
              {CONNECT_SOURCE_PROMPT}
            </p>
          ) : (
            <>
              {visibleKpis.length > 0 || !showPipeline ? (
                <PreviewMetricsGrid
                  kpiTab={kpiTab}
                  visibleOverviewKpis={visibleOverviewKpis}
                  visibleRevenueKpis={visibleRevenueKpis}
                  theme={theme}
                  compact={compact}
                  rangeLabel={rangeLabel}
                />
              ) : null}

              {kpiTab === "overview" && (showChart || showSchedule) ? (
                <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
                  {showChart ? (
                    <div className={showSchedule ? "min-w-0 xl:col-span-2" : "min-w-0 xl:col-span-3"}>
                      {chartSection}
                    </div>
                  ) : null}
                  {showSchedule ? (
                    <div className={showChart ? "flex min-w-0 xl:col-span-1" : "min-w-0 xl:col-span-3"}>
                      <DashboardSection
                        theme={theme}
                        compact={compact}
                        title="Next 7 days"
                        subtitle={`2 upcoming · from ${formatCalendarDateDisplay(DEMO_AS_OF_DATE)}`}
                        subtitleAlign="left"
                        titleAlign="left"
                        headerAside={<PreviewAction theme={theme} label="Schedule" />}
                        tightToolbar
                        fill
                      >
                        <PreviewScheduleList theme={theme} compact={compact} />
                      </DashboardSection>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showPipeline ? (
                <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
                  <SalesPipelineCard
                    view={PREVIEW_PIPELINE}
                    theme={theme}
                    action={<PreviewAction theme={theme} label="View pipeline" />}
                  />
                  <WonPeriodCard
                    view={PREVIEW_PIPELINE}
                    theme={theme}
                    rangeLabel={formatRangeForDisplay({
                      start: "2026-03-01",
                      end: "2026-03-12",
                      preset: "mtd",
                    })}
                  />
                </div>
              ) : null}

              {kpiTab === "revenue" && showChart ? chartSection : null}
              {kpiTab === "revenue" && showChart ? (
                <SalesInsightCards insight={PREVIEW_SALES} theme={theme} />
              ) : null}

              {kpiTab === "overview" && (showInvoices || showJobs) ? (
                <div
                  className={`grid grid-cols-1 items-stretch gap-3 ${
                    showInvoices && showJobs ? "xl:grid-cols-2" : ""
                  }`}
                >
                  {showInvoices ? (
                    <DashboardSection
                      theme={theme}
                      compact={compact}
                      title="Invoices"
                      subtitle={`As of ${formatCalendarDateDisplay(DEMO_AS_OF_DATE)}`}
                      subtitleAlign="left"
                      titleAlign="left"
                      headerAside={<PreviewAction theme={theme} label="View invoices" />}
                      tightToolbar
                      fill
                    >
                      <PreviewInvoiceSummary theme={theme} />
                    </DashboardSection>
                  ) : null}
                  {showJobs ? (
                    <DashboardSection
                      theme={theme}
                      compact={compact}
                      title="Job activity"
                      subtitle={rangeLabel}
                      subtitleAlign="left"
                      titleAlign="left"
                      headerAside={<PreviewAction theme={theme} label="View jobs" />}
                      tightToolbar
                      fill
                    >
                      <PreviewJobSummary theme={theme} />
                    </DashboardSection>
                  ) : null}
                </div>
              ) : null}

              {kpiTab === "revenue" && showInvoices ? (
                <DashboardSection
                  theme={theme}
                  compact={compact}
                  title="Invoices"
                  subtitleAlign="center"
                  titleAlign="center"
                  tightToolbar
                >
                  <PreviewInvoiceTable theme={theme} compact={compact} />
                </DashboardSection>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
