"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DailyDashboardFrame } from "@/components/customer/daily/DailyDashboardFrame";
import { DailyOverview } from "@/components/customer/daily/DailyOverview";
import {
  resolveDashboardPeriod,
  summarizeCollectionsPeriod,
} from "@/lib/daily-dashboard/collections-period";
import { buildDemoDailySnapshot } from "@/lib/daily-dashboard/demo-snapshot";
import { DAILY_THEMES, resolveDailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import { dashboardRoutesForPathname } from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { WorkspaceThemeId } from "@/lib/customer-portal-context";
import { formatRangeForDisplay } from "@/lib/workspace-reporting-period";

const SECONDARY = [
  { id: "collections_chart" as const, label: "Collections trend" },
  { id: "job_activity" as const, label: "Square activity" },
];

export function CustomerSettingsPage({
  liveSnapshot = null,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
}) {
  const {
    workspace,
    businessName,
    workspaceId,
    settings,
    updateSettings,
    resetLayoutToDefaults,
    toggleWidgetHidden,
  } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(usePathname());
  const [confirmReset, setConfirmReset] = useState(false);
  const theme = resolveDailyTheme(settings.themeId);

  const previewSnapshot = useMemo(() => {
    if (liveSnapshot) return liveSnapshot;
    return buildDemoDailySnapshot({
      workspaceId: workspaceId || "",
      companyName: businessName,
    });
  }, [liveSnapshot, workspaceId, businessName]);

  const period = resolveDashboardPeriod(previewSnapshot.asOfDate, "last7");
  const summary = summarizeCollectionsPeriod({
    transactions: previewSnapshot.collections.transactions,
    range: period,
    authoritativeDay: previewSnapshot.collections.authoritativeDay,
    loadedCap: previewSnapshot.collections.loadedCap,
  });
  const chartFirst =
    settings.widgetOrder.find((id) => id === "collections_chart" || id === "job_activity") !==
    "job_activity";

  if (!workspace && !liveSnapshot) return null;

  function swapSecondary() {
    const order = [...settings.widgetOrder];
    const chart = order.indexOf("collections_chart");
    const activity = order.indexOf("job_activity");
    if (chart < 0 || activity < 0) return;
    const chartId = order[chart]!;
    order[chart] = order[activity]!;
    order[activity] = chartId;
    updateSettings({ widgetOrder: order });
  }

  return (
    <DailyDashboardFrame companyName={liveSnapshot?.companyName}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${theme.text}`}>Appearance</h1>
          <p className={`mt-2 max-w-2xl text-sm ${theme.muted}`}>
            Theme, compact spacing, and secondary widgets are saved in this browser. They do not
            change connection permissions or financial records.
          </p>
        </div>

        <section className={theme.card}>
          <div className={`border-b px-5 py-4 ${theme.divider}`}>
            <h2 className={`text-sm font-semibold ${theme.text}`}>Color theme</h2>
            <p className={`mt-1 text-sm ${theme.muted}`}>
              Preview uses the same dashboard. Saved RavenView purple, Forest & slate, and Ocean &
              ink preferences open as Indigo, Evergreen Slate, and Porcelain.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {DAILY_THEMES.map((choice) => {
                const selected = settings.themeId === choice.id;
                return (
                  <label
                    key={choice.id}
                    className={`cursor-pointer rounded-xl border p-4 ${theme.focus} ${
                      selected ? `ring-2 ring-offset-2 ${choice.swatchRing}` : theme.divider
                    } ${theme.nested}`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      className="sr-only"
                      checked={selected}
                      onChange={() => updateSettings({ themeId: choice.id as WorkspaceThemeId })}
                    />
                    <span className="flex gap-1">
                      {choice.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                    <span className={`mt-2 block text-sm font-semibold ${theme.text}`}>{choice.name}</span>
                    <span className={`mt-1 block text-xs ${theme.muted}`}>{choice.description}</span>
                  </label>
                );
              })}
            </div>

            <label className={`flex items-start gap-3 rounded-xl p-4 ${theme.nested}`}>
              <input
                type="checkbox"
                checked={settings.showCompactMetrics}
                onChange={(event) => updateSettings({ showCompactMetrics: event.target.checked })}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className={`block text-sm font-semibold ${theme.text}`}>Compact layout</span>
                <span className={`mt-1 block text-sm ${theme.muted}`}>
                  Tighter spacing on the dashboard.
                </span>
              </span>
            </label>

            <div className={`max-h-[36rem] overflow-auto rounded-xl border ${theme.divider}`}>
              <DailyOverview
                snapshot={previewSnapshot}
                summary={summary}
                rangeLabel={`${period.label} · ${formatRangeForDisplay(period)}`}
                theme={theme}
                links={{ receivables: "#", schedule: "#", connections: routes.connections }}
                showChart={!settings.hiddenWidgets.includes("collections_chart")}
                showActivity={!settings.hiddenWidgets.includes("job_activity")}
                chartFirst={chartFirst}
                compact={settings.showCompactMetrics}
                preview
              />
            </div>
          </div>
        </section>

        <section className={`${theme.card} p-5`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>Secondary widgets</h2>
          <p className={`mt-1 text-sm ${theme.muted}`}>
            Needs attention, receivables, next up, and collection totals stay in place. Reorder or
            hide the trend and the Square activity list.
          </p>
          <ul className="mt-4 space-y-2">
            {SECONDARY.map((widget) => {
              const hidden = settings.hiddenWidgets.includes(widget.id);
              return (
                <li
                  key={widget.id}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${theme.row}`}
                >
                  <span className={`text-sm font-medium ${hidden ? theme.muted : theme.text}`}>
                    {widget.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWidgetHidden(widget.id)}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${theme.input} ${theme.focus}`}
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={swapSecondary}
            className={`mt-3 rounded-md border px-3 py-1.5 text-sm font-semibold ${theme.input} ${theme.focus}`}
          >
            Swap trend and activity
          </button>
        </section>

        <section className={`${theme.card} p-5`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>Restore default layout</h2>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={`mt-3 rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold ${theme.focus} ${theme.warning}`}
            >
              Reset this workspace…
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  resetLayoutToDefaults();
                  setConfirmReset(false);
                }}
                className={`rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white ${theme.focus}`}
              >
                Confirm reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${theme.input} ${theme.focus}`}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </DailyDashboardFrame>
  );
}
