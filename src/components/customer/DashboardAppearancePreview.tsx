"use client";

import type { ReactNode } from "react";
import { CollectionsTrendChart } from "@/components/customer/CollectionsTrendChart";
import { DashboardSection } from "@/components/customer/DashboardSection";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-section-routes";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";
import { DEMO_AS_OF_DATE } from "@/lib/workspace-demo-date";
import {
  OVERVIEW_KPI_LABELS,
  REVENUE_KPI_LABELS,
  type OverviewKpiId,
  type RevenueKpiId,
} from "@/lib/workspace-kpi-layout";
import {
  addCalendarDays,
  formatCalendarDateDisplay,
  formatRangeForDisplay,
  resolveReportingRange,
} from "@/lib/workspace-reporting-period";
import type { TrendBucket } from "@/lib/workspace-analytics";

const REPORTING_CHIPS = [
  { id: "last7", label: "7 days" },
  { id: "last30", label: "30 days" },
  { id: "mtd", label: "Month to date" },
] as const;

const PREVIEW_JOBS = [
  {
    title: "Seasonal tune-up · $285",
    meta: "Oak Street Residence · Maintenance",
    when: "Mar 28 · 9:00 AM",
    status: "Completed",
  },
  {
    title: "No-cool diagnostic · $420",
    meta: "Plaza Office Park · Service",
    when: "Mar 27 · 1:30 PM",
    status: "In progress",
  },
] as const;

const PREVIEW_APPOINTMENTS = [
  { title: "Estimate — Plaza HVAC", when: "Mar 31 · 10:00 AM" },
  { title: "Filter delivery — Oak St", when: "Apr 1 · 8:30 AM" },
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

function PreviewKpiCard({
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
      {compare ? <p className={`mt-1 text-[10px] ${compareClass}`}>{compare}</p> : null}
    </div>
  );
}

function overviewPreviewProps(
  id: OverviewKpiId,
  rangeLabel: string,
  theme: LayoutCustomizeTheme,
  index: number
) {
  const className = index % 2 === 0 ? theme.metricA : theme.metricB;
  const asOf = formatCalendarDateDisplay(DEMO_AS_OF_DATE);
  switch (id) {
    case "payments_collected":
      return {
        sub: rangeLabel,
        compare: "+8.2% vs prior period",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount amount={18400} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "jobs_completed":
      return {
        sub: rangeLabel,
        compare: "+3 vs prior period",
        compareTone: "up" as const,
        value: (
          <span className={`text-xl font-bold sm:text-2xl ${theme.metricValueA}`}>24</span>
        ),
        className,
      };
    case "outstanding_balance":
      return {
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount amount={12800} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "overdue_balance":
      return {
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount amount={3100} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
  }
}

function revenuePreviewProps(
  id: RevenueKpiId,
  rangeLabel: string,
  theme: LayoutCustomizeTheme,
  index: number
) {
  const className = index % 2 === 0 ? theme.metricA : theme.metricB;
  const asOf = formatCalendarDateDisplay(DEMO_AS_OF_DATE);
  switch (id) {
    case "weekly_revenue":
      return {
        sub: rangeLabel,
        compare: "+5.1% vs prior 7 days",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount amount={11200} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "monthly_revenue":
      return {
        sub: "Month to date",
        compare: "+4.0% vs same days last month",
        compareTone: "up" as const,
        value: (
          <CurrencyAmount amount={48200} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "month_pipeline":
      return {
        sub: "Scheduled + in progress",
        value: (
          <CurrencyAmount amount={62000} className="text-xl font-bold sm:text-2xl" />
        ),
        className,
      };
    case "overdue_ar":
      return {
        sub: `As of ${asOf}`,
        value: (
          <CurrencyAmount amount={3100} className="text-xl font-bold sm:text-2xl" />
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
        className={`rounded-lg border border-dashed px-4 py-6 text-center text-sm text-ink-muted ${theme.kpiEmptyState}`}
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

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${lgCols}`}>
      {kpiTab === "revenue"
        ? visibleRevenueKpis.map((id, index) => (
            <PreviewKpiCard
              key={id}
              compact={compact}
              label={REVENUE_KPI_LABELS[id]}
              {...revenuePreviewProps(id, rangeLabel, theme, index)}
            />
          ))
        : visibleOverviewKpis.map((id, index) => (
            <PreviewKpiCard
              key={id}
              compact={compact}
              label={OVERVIEW_KPI_LABELS[id]}
              {...overviewPreviewProps(id, rangeLabel, theme, index)}
            />
          ))}
    </div>
  );
}

function PreviewJobList({ theme, compact }: { theme: LayoutCustomizeTheme; compact?: boolean }) {
  const rowPy = compact ? "py-2" : "py-2.5";
  const meta = compact ? "text-[10px]" : "text-xs";
  return (
    <div className={`${theme.widgetListShell} ${compact ? "text-xs" : "text-sm"}`}>
      <ul className={`divide-y ${theme.widgetListDivide}`}>
        {PREVIEW_JOBS.map((job, i) => (
          <li key={job.title}>
            <div
              className={`flex w-full flex-col gap-0.5 px-3 text-left text-ink sm:flex-row sm:items-center sm:justify-between ${rowPy} ${
                i === 0 ? theme.operationsListSelected : "bg-white/70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{job.title}</p>
                <p className={`truncate ${meta} text-ink-muted`}>{job.meta}</p>
              </div>
              <div className={`flex shrink-0 flex-wrap items-center gap-x-2 ${meta}`}>
                <span className={`font-semibold ${theme.listAccent}`}>{job.when}</span>
                <span>{job.status}</span>
              </div>
            </div>
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
            <div
              className={`flex w-full flex-col gap-0.5 px-3 text-left sm:flex-row sm:items-center sm:justify-between ${rowPy} bg-white/70`}
            >
              <p className="truncate font-semibold text-ink">{appt.title}</p>
              <span className={`shrink-0 font-semibold ${theme.listAccent} ${meta}`}>
                {appt.when}
              </span>
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
            <tr key={inv.id} className={idx % 2 === 1 ? "bg-white/60" : "bg-white"}>
              <td className={`font-mono font-semibold ${theme.metricValueA} ${cell}`}>{inv.id}</td>
              <td className={`truncate font-medium text-ink ${cell}`}>{inv.customer}</td>
              <td className={`text-ink-muted ${cell}`}>{inv.due}</td>
              <td className={`font-semibold ${theme.metricValueA} ${cell}`}>
                <CurrencyAmount amount={inv.balance} />
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
}: {
  theme: LayoutCustomizeTheme;
  kpiTab: "overview" | "revenue";
  visibleOverviewKpis: OverviewKpiId[];
  visibleRevenueKpis: RevenueKpiId[];
  compact?: boolean;
}) {
  const resolved = resolveReportingRange("last7");
  const rangeLabel = resolved.ok ? formatRangeForDisplay(resolved.range) : "Last 7 days";
  const sectionId = kpiTab === "revenue" ? "revenue" : "overview";
  const headerTitle =
    kpiTab === "revenue" ? "Revenue & collections" : "Operations dashboard";
  const metricsTitle = kpiTab === "revenue" ? "Revenue Overview" : "General Overview";

  return (
    <div className={`rounded-2xl shadow-card ${theme.card}`} aria-label="Sample dashboard preview">
      <div
        className={`relative z-10 flex flex-col gap-2 overflow-visible rounded-t-2xl px-4 py-3 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{headerTitle}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badge}`}
          >
            Sample data
          </span>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="mt-2 flex flex-wrap gap-1 rounded-lg border border-white/20 bg-white/10 p-1"
        >
          {DASHBOARD_SECTIONS.map((section) => {
            const isActive = section.id === sectionId;
            return (
              <span
                key={section.id}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                  isActive ? theme.embeddedNavActive : "text-white/90"
                }`}
              >
                {section.label}
              </span>
            );
          })}
        </nav>

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
                {REPORTING_CHIPS.map(({ id, label }) => {
                  const active = id === "last7";
                  return (
                    <span
                      key={id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2 sm:text-sm ${
                        active ? theme.embeddedPeriodActive : "text-white/95"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
              <p className="shrink-0 px-1 text-xs font-medium leading-none text-white/90 sm:pr-2 sm:text-sm">
                {rangeLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-b-2xl">
        <div className={`flex flex-col gap-4 p-4 sm:p-5 ${theme.dashboardCanvas}`}>
          <DashboardSection
            theme={theme}
            compact={compact}
            title={metricsTitle}
            subtitle={rangeLabel}
            subtitleAlign="center"
          >
            <PreviewMetricsGrid
              kpiTab={kpiTab}
              visibleOverviewKpis={visibleOverviewKpis}
              visibleRevenueKpis={visibleRevenueKpis}
              theme={theme}
              compact={compact}
              rangeLabel={rangeLabel}
            />
          </DashboardSection>

          <DashboardSection
            theme={theme}
            compact={compact}
            title="Collections trend"
            subtitle={
              <>
                {rangeLabel} · Total{" "}
                <CurrencyAmount
                  amount={PREVIEW_TREND_TOTAL}
                  className={`inline font-semibold ${theme.metricValueA}`}
                />
              </>
            }
            subtitleAlign="center"
            tightToolbar
          >
            <CollectionsTrendChart trend={PREVIEW_TREND} theme={theme} />
          </DashboardSection>

          {kpiTab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardSection
                theme={theme}
                compact={compact}
                title="Job activity"
                subtitle={rangeLabel}
                subtitleAlign="center"
                tightToolbar
              >
                <PreviewJobList theme={theme} compact={compact} />
              </DashboardSection>
              <DashboardSection
                theme={theme}
                compact={compact}
                title="Next 7 days"
                subtitle={`2 upcoming · from ${formatCalendarDateDisplay(DEMO_AS_OF_DATE)}`}
                subtitleAlign="center"
                tightToolbar
              >
                <PreviewScheduleList theme={theme} compact={compact} />
              </DashboardSection>
            </div>
          ) : (
            <DashboardSection
              theme={theme}
              compact={compact}
              title="Open invoices"
              subtitle={rangeLabel}
              subtitleAlign="center"
              tightToolbar
            >
              <PreviewInvoiceTable theme={theme} compact={compact} />
            </DashboardSection>
          )}
        </div>
      </div>
    </div>
  );
}
