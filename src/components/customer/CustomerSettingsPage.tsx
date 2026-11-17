"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LAYOUT_CUSTOMIZE_THEMES } from "@/lib/layout-customize-themes";
import { dashboardRoutesForPathname } from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { WorkspaceThemeId } from "@/lib/customer-portal-context";
import { DashboardAppearancePreview } from "@/components/customer/DashboardAppearancePreview";
import { DashboardPageFrame } from "@/components/customer/DashboardWorkspaceNav";
import { useSignedInNav } from "@/components/customer/signed-in-nav-context";
import { DashboardKpiChipPicker } from "@/components/customer/DashboardKpiChipPicker";
import { useDashboardComposition } from "@/components/customer/use-dashboard-composition";
import { DashboardChipGroup } from "@/components/customer/dashboard-controls";
import {
  CONNECT_SOURCE_PROMPT,
  HUBSPOT_DEALS_PENDING,
  visibleAllowedIds,
} from "@/lib/dashboard-composition";
import {
  OVERVIEW_KPI_LABELS,
  REVENUE_KPI_LABELS,
  type OverviewKpiId,
  type RevenueKpiId,
} from "@/lib/workspace-kpi-layout";
import {
  WIDGET_LABELS,
  type DashboardWidgetId,
} from "@/lib/workspace-widget-layout";

export function CustomerSettingsPage() {
  const {
    workspace,
    businessName,
    settings,
    updateSettings,
    resetLayoutToDefaults,
    moveWidget,
    toggleWidgetHidden,
    toggleOverviewKpiHidden,
    toggleRevenueKpiHidden,
    theme,
  } = useCustomerPortal();
  const composition = useDashboardComposition();
  const routes = dashboardRoutesForPathname(usePathname());
  const signedInNav = useSignedInNav();
  const [confirmReset, setConfirmReset] = useState(false);
  const [kpiTab, setKpiTab] = useState<"overview" | "revenue">("overview");
  const revenueAvailable = !composition || composition.sections.includes("revenue");

  useEffect(() => {
    if (!revenueAvailable && kpiTab === "revenue") setKpiTab("overview");
  }, [kpiTab, revenueAvailable]);

  if (!workspace && !businessName) return null;

  const visibleOverviewKpis = visibleAllowedIds(
    settings.overviewKpiOrder,
    settings.overviewHiddenKpis,
    composition?.overviewKpis ?? null
  );
  const visibleRevenueKpis = visibleAllowedIds(
    settings.revenueKpiOrder,
    settings.revenueHiddenKpis,
    composition?.revenueKpis ?? null
  );
  const overviewOrder = composition
    ? settings.overviewKpiOrder.filter((id) => composition.overviewKpis.includes(id))
    : settings.overviewKpiOrder;
  const revenueOrder = composition
    ? settings.revenueKpiOrder.filter((id) => composition.revenueKpis.includes(id))
    : settings.revenueKpiOrder;
  const overviewHidden = overviewOrder.filter((id) => !visibleOverviewKpis.includes(id));
  const revenueHidden = revenueOrder.filter((id) => !visibleRevenueKpis.includes(id));
  const widgetOrder = composition
    ? settings.widgetOrder.filter((id) => composition.widgets.includes(id))
    : settings.widgetOrder;

  function toggleOverview(id: OverviewKpiId) {
    if (composition && visibleOverviewKpis.includes(id) && visibleOverviewKpis.length <= 1) return;
    toggleOverviewKpiHidden(id);
  }

  function toggleRevenue(id: RevenueKpiId) {
    if (composition && visibleRevenueKpis.includes(id) && visibleRevenueKpis.length <= 1) return;
    toggleRevenueKpiHidden(id);
  }

  function moveDisplayedWidget(id: DashboardWidgetId, direction: "up" | "down") {
    if (!composition) {
      moveWidget(id, direction);
      return;
    }
    const index = widgetOrder.indexOf(id);
    const neighbor = widgetOrder[direction === "up" ? index - 1 : index + 1];
    if (!neighbor) return;
    const order = [...settings.widgetOrder];
    const from = order.indexOf(id);
    const to = order.indexOf(neighbor);
    [order[from], order[to]] = [order[to]!, order[from]!];
    updateSettings({ widgetOrder: order });
  }

  return (
    <DashboardPageFrame>
      <div className="space-y-8">
      <div>
        <p className={`text-sm font-semibold uppercase tracking-wide ${theme.metricValueA}`}>
          {businessName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Appearance & layout</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Theme, compact layout, KPI cards, and widget order are saved in this browser. Saved
          purple, forest, and ocean preferences open as RavenView Indigo, Evergreen Slate, and
          Espresso. Harbor, Carbon, and Ash follow the same layout. They do not change
          connection permissions or financial records.
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
            {revenueAvailable
              ? "Pick a theme and preview the same dashboard on Overview and Revenue."
              : "Pick a theme and preview the dashboard for the connected sources."}
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
                    <span className={`block h-2 rounded-full ${t.pickerBar ?? t.header}`} />
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
              className={`mt-1 h-4 w-4 rounded border-black/20 ${theme.formAccent}`}
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
            kpiTab={revenueAvailable ? kpiTab : "overview"}
            visibleOverviewKpis={visibleOverviewKpis}
            visibleRevenueKpis={visibleRevenueKpis}
            compact={settings.showCompactMetrics}
            composition={composition}
          />

          <div id="kpi-cards" className="scroll-mt-24 rounded-xl border border-black/5 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">KPI cards</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {composition?.promptToConnect
                    ? CONNECT_SOURCE_PROMPT
                    : composition
                      ? "Tap to show or hide. Cards follow the sources that are connected."
                      : "Tap to show or hide. Order matches the default on each tab."}
                </p>
              </div>
              {revenueAvailable ? (
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
              ) : null}
            </div>
            <div className="mt-4">
              {composition?.promptToConnect ? null : kpiTab === "overview" || !revenueAvailable ? (
                overviewOrder.length > 0 ? (
                  <DashboardKpiChipPicker
                    order={overviewOrder}
                    hidden={overviewHidden}
                    labels={OVERVIEW_KPI_LABELS}
                    themeChipActive={theme.filterChipActive}
                    themeChipIdle={theme.filterChipIdle}
                    onToggleHidden={toggleOverview}
                  />
                ) : composition?.sales ? (
                  <p className="text-sm text-ink-muted">{HUBSPOT_DEALS_PENDING}</p>
                ) : (
                  <p className="text-sm text-ink-muted">No overview cards for the connected sources.</p>
                )
              ) : revenueOrder.length > 0 ? (
                <DashboardKpiChipPicker
                  order={revenueOrder}
                  hidden={revenueHidden}
                  labels={REVENUE_KPI_LABELS}
                  themeChipActive={theme.filterChipActive}
                  themeChipIdle={theme.filterChipIdle}
                  onToggleHidden={toggleRevenue}
                />
              ) : (
                <p className="text-sm text-ink-muted">{HUBSPOT_DEALS_PENDING}</p>
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
          {widgetOrder.map((id, index) => {
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
                    onClick={() => moveDisplayedWidget(id, "up")}
                    className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-40 ${theme.filterSecondaryButton}`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === widgetOrder.length - 1}
                    onClick={() => moveDisplayedWidget(id, "down")}
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
        {widgetOrder.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{CONNECT_SOURCE_PROMPT}</p>
        ) : null}
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
        href={routes.home}
        onClick={(event) => {
          if (!signedInNav?.canSwap || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          event.preventDefault();
          signedInNav.showDashboard("overview");
        }}
        className={`inline-block text-sm font-semibold hover:opacity-80 ${theme.metricValueA}`}
      >
        ← Back to home
      </Link>
      </div>
    </DashboardPageFrame>
  );
}
