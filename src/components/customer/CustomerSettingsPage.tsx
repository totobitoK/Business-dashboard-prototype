"use client";

import Link from "next/link";
import { useState } from "react";
import { LAYOUT_CUSTOMIZE_THEMES } from "@/lib/layout-customize-themes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { WorkspaceThemeId } from "@/lib/customer-portal-context";
import { demoDashboardRoutes as dashboardRoutes } from "@/lib/routes";
import { DashboardAppearancePreview } from "@/components/customer/DashboardAppearancePreview";
import { DashboardKpiChipPicker } from "@/components/customer/DashboardKpiChipPicker";
import { DashboardChipGroup } from "@/components/customer/dashboard-controls";
import {
  OVERVIEW_KPI_LABELS,
  REVENUE_KPI_LABELS,
  visibleKpiIds,
} from "@/lib/workspace-kpi-layout";
import {
  DASHBOARD_WIDGET_IDS,
  WIDGET_LABELS,
} from "@/lib/workspace-widget-layout";

export function CustomerSettingsPage() {
  const {
    workspace,
    settings,
    updateSettings,
    resetLayoutToDefaults,
    moveWidget,
    toggleWidgetHidden,
    toggleOverviewKpiHidden,
    toggleRevenueKpiHidden,
    theme,
  } = useCustomerPortal();
  const [confirmReset, setConfirmReset] = useState(false);
  const [kpiTab, setKpiTab] = useState<"overview" | "revenue">("overview");

  if (!workspace) return null;

  const visibleOverviewKpis = visibleKpiIds(
    settings.overviewKpiOrder,
    settings.overviewHiddenKpis
  );
  const visibleRevenueKpis = visibleKpiIds(
    settings.revenueKpiOrder,
    settings.revenueHiddenKpis
  );

  return (
    <div className="space-y-8">
      <div>
        <p className={`text-sm font-semibold uppercase tracking-wide ${theme.metricValueA}`}>
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Appearance & layout</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Saved per demo workspace in your browser only — does not change CRM records,
          connection permissions, or financial source data.
        </p>
      </div>

      <section
        className={`overflow-hidden rounded-2xl border shadow-soft ${theme.sectionPanel}`}
        aria-labelledby="appearance-preview-heading"
      >
        <div className={`border-b px-5 py-4 ${theme.sectionHeader}`}>
          <h2 id="appearance-preview-heading" className="text-sm font-semibold text-ink">
            Color theme & preview
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Pick a theme and see how the sample dashboard will look on Overview and Revenue.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Color theme
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {LAYOUT_CUSTOMIZE_THEMES.map((t) => {
                const selected = settings.themeId === t.id;
                return (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-xl border bg-white/80 p-4 transition-colors ${
                      selected ? `ring-2 ring-offset-1 ${t.swatchRing}` : "border-black/10 hover:border-black/15"
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      className="sr-only"
                      checked={selected}
                      onChange={() => updateSettings({ themeId: t.id as WorkspaceThemeId })}
                    />
                    <span className={`block h-2 rounded-full ${t.header}`} />
                    <span className="mt-2 block text-sm font-semibold text-ink">{t.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-xl border border-black/5 bg-white/70 p-4">
            <input
              type="checkbox"
              checked={settings.showCompactMetrics}
              onChange={(e) => updateSettings({ showCompactMetrics: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-purple-200 text-purple"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">Compact layout</span>
              <span className="mt-1 block text-sm text-ink-muted">
                Tighter spacing and smaller KPI type on the sample dashboard.
              </span>
            </span>
          </label>

          <DashboardAppearancePreview
            theme={theme}
            kpiTab={kpiTab}
            visibleOverviewKpis={visibleOverviewKpis}
            visibleRevenueKpis={visibleRevenueKpis}
            compact={settings.showCompactMetrics}
          />

          <div id="kpi-cards" className="scroll-mt-24 rounded-xl border border-black/5 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">KPI cards</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Tap to show or hide. Order matches the default on each tab.
                </p>
              </div>
              <DashboardChipGroup
                theme={theme}
                aria-label="KPI preview tab"
                value={kpiTab}
                onChange={setKpiTab}
                options={[
                  { value: "overview", label: "Overview" },
                  { value: "revenue", label: "Revenue" },
                ]}
              />
            </div>
            <div className="mt-4">
              {kpiTab === "overview" ? (
                <DashboardKpiChipPicker
                  order={settings.overviewKpiOrder}
                  hidden={settings.overviewHiddenKpis}
                  labels={OVERVIEW_KPI_LABELS}
                  themeChipActive={theme.filterChipActive}
                  themeChipIdle={theme.filterChipIdle}
                  onToggleHidden={toggleOverviewKpiHidden}
                />
              ) : (
                <DashboardKpiChipPicker
                  order={settings.revenueKpiOrder}
                  hidden={settings.revenueHiddenKpis}
                  labels={REVENUE_KPI_LABELS}
                  themeChipActive={theme.filterChipActive}
                  themeChipIdle={theme.filterChipIdle}
                  onToggleHidden={toggleRevenueKpiHidden}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <fieldset className={`rounded-2xl border p-5 shadow-soft ${theme.sectionPanel}`}>
        <legend className="px-1 text-sm font-semibold text-ink">Dashboard widgets</legend>
        <p className="mt-1 text-sm text-ink-muted">
          Reorder optional sections or hide them. Order applies on the home preview.
        </p>
        <ul className="mt-4 space-y-2">
          {settings.widgetOrder.map((id, index) => {
            const hidden = settings.hiddenWidgets.includes(id);
            return (
              <li
                key={id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${theme.listRow}`}
              >
                <span className={`text-sm font-medium ${hidden ? "text-ink-muted line-through" : "text-ink"}`}>
                  {WIDGET_LABELS[id]}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveWidget(id, "up")}
                    className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-40 ${theme.filterSecondaryButton}`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === settings.widgetOrder.length - 1}
                    onClick={() => moveWidget(id, "down")}
                    className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-40 ${theme.filterSecondaryButton}`}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWidgetHidden(id)}
                    className={`rounded border px-2 py-1 text-xs font-semibold ${theme.filterSecondaryButton}`}
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          All widgets: {DASHBOARD_WIDGET_IDS.join(", ")}
        </p>
      </fieldset>

      <div className={`rounded-2xl border p-5 shadow-soft ${theme.sectionPanel}`}>
        <p className="text-sm font-semibold text-ink">Restore default layout</p>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mt-3 rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
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
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${theme.filterSecondaryButton}`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <Link
        href={dashboardRoutes.home}
        className={`inline-block text-sm font-semibold hover:opacity-80 ${theme.metricValueA}`}
      >
        ← Back to home
      </Link>
    </div>
  );
}
