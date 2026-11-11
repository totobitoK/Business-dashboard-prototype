"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildDemoDailySnapshot } from "@/lib/daily-dashboard/demo-snapshot";
import {
  resolveDashboardPeriod,
  summarizeCollectionsPeriod,
  type DashboardPeriodChoice,
} from "@/lib/daily-dashboard/collections-period";
import { resolveDailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import {
  dashboardMoneyHref,
  dashboardRoutesForPathname,
  dashboardSectionHref,
  moneyViewFromSearchParams,
  resolveDashboardSection,
} from "@/lib/dashboard-section-routes";
import { companyTimeZoneLabel } from "@/lib/company-time-zone";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { formatRangeForDisplay } from "@/lib/workspace-reporting-period";
import { DailyDashboardFrame } from "./DailyDashboardFrame";
import { DailyMoney } from "./DailyMoney";
import { DailyOverview } from "./DailyOverview";
import { DailySchedule } from "./DailySchedule";

const PERIODS: { id: DashboardPeriodChoice; label: string }[] = [
  { id: "day", label: "Reporting date" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "mtd", label: "Month to date" },
];

export function DailyDashboard({
  liveSnapshot = null,
  changesRequestedNote,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, businessName, settings } = useCustomerPortal();
  const theme = resolveDailyTheme(settings.themeId);
  const routes = dashboardRoutesForPathname(pathname);
  const section = resolveDashboardSection(pathname, searchParams);
  const moneyView = moneyViewFromSearchParams(searchParams);
  const [periodChoice, setPeriodChoice] = useState<DashboardPeriodChoice>("last7");

  const snapshot = useMemo(() => {
    if (liveSnapshot) return liveSnapshot;
    return buildDemoDailySnapshot({
      workspaceId: workspaceId || "",
      companyName: businessName,
    });
  }, [liveSnapshot, workspaceId, businessName]);

  const period = useMemo(
    () => resolveDashboardPeriod(snapshot.asOfDate, periodChoice),
    [snapshot.asOfDate, periodChoice]
  );
  const summary = useMemo(
    () =>
      summarizeCollectionsPeriod({
        transactions: snapshot.collections.transactions,
        range: period,
        authoritativeDay: snapshot.collections.authoritativeDay,
        loadedCap: snapshot.collections.loadedCap,
      }),
    [snapshot, period]
  );

  const workspace = workspaceId || "";
  const links = {
    receivables: dashboardMoneyHref(workspace, "receivables", routes.home),
    collections: dashboardMoneyHref(workspace, "collections", routes.home),
    schedule: dashboardSectionHref(workspace, "schedule", routes.home),
    connections: workspace
      ? `${routes.connections}?workspace=${encodeURIComponent(workspace)}`
      : routes.connections,
  };
  const showChart = !settings.hiddenWidgets.includes("collections_chart");
  const showActivity = !settings.hiddenWidgets.includes("job_activity");
  const chartFirst =
    settings.widgetOrder.find((id) => id === "collections_chart" || id === "job_activity") !==
    "job_activity";
  const rangeLabel = `${period.label} · ${formatRangeForDisplay(period)}`;

  return (
    <DailyDashboardFrame
      companyName={snapshot.companyName}
      sampleLabel={snapshot.sampleLabel}
      periodControl={
        <label className="flex flex-col items-end gap-1 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Reporting period
          </span>
          <select
            value={periodChoice}
            onChange={(event) => setPeriodChoice(event.target.value as DashboardPeriodChoice)}
            className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${theme.input} ${theme.focus}`}
            aria-label="Reporting period"
          >
            {PERIODS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs tabular-nums opacity-80">
            {formatRangeForDisplay(period)} · {companyTimeZoneLabel(snapshot.timeZone)}
          </span>
        </label>
      }
    >
      {section === "schedule" ? (
        <DailySchedule snapshot={snapshot} theme={theme} compact={settings.showCompactMetrics} />
      ) : section === "revenue" ? (
        <DailyMoney
          view={moneyView}
          snapshot={snapshot}
          summary={summary}
          rangeLabel={rangeLabel}
          theme={theme}
          links={links}
          showChart={showChart}
          showActivity={showActivity}
          chartFirst={chartFirst}
          compact={settings.showCompactMetrics}
        />
      ) : (
        <DailyOverview
          snapshot={snapshot}
          summary={summary}
          rangeLabel={rangeLabel}
          theme={theme}
          links={links}
          showChart={showChart}
          showActivity={showActivity}
          chartFirst={chartFirst}
          compact={settings.showCompactMetrics}
          note={changesRequestedNote}
        />
      )}
    </DailyDashboardFrame>
  );
}
