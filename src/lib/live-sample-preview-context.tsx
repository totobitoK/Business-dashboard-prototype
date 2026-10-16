"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { LAYOUT_CUSTOMIZE_THEMES } from "./layout-customize-themes";
import {
  CUSTOMER_DEMO_WORKSPACES,
  getWorkspaceById,
  isValidWorkspaceId,
} from "./customer-workspaces";
import {
  CustomerPortalContext,
  type CustomerPortalContextValue,
} from "./customer-portal-context-shared";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  normalizeLayoutSettings,
  type DashboardWidgetId,
  type OverviewKpiId,
  type RevenueKpiId,
} from "./workspace-widget-layout";
import { moveKpi, toggleKpiHidden } from "./workspace-kpi-layout";

/**
 * Live authorized project preview — no demo ClientStore, no localStorage workspace/settings.
 */
export function LiveSamplePreviewProvider({
  workspaceId,
  navigationBase,
  children,
}: {
  workspaceId: string;
  navigationBase: string;
  children: ReactNode;
}) {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error("LiveSamplePreviewProvider requires a valid mapped workspace id.");
  }

  const [settings, setSettings] = useState(() =>
    normalizeLayoutSettings(DEFAULT_WORKSPACE_LAYOUT)
  );
  const workspace = getWorkspaceById(workspaceId) ?? null;

  const noopSetWorkspace = useCallback(() => {
    /* locked */
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<typeof settings>) => {
      setSettings((prev) => normalizeLayoutSettings({ ...prev, ...patch }));
    },
    []
  );

  const resetLayoutToDefaults = useCallback(() => {
    setSettings({ ...DEFAULT_WORKSPACE_LAYOUT });
  }, []);

  const moveWidget = useCallback(
    (id: DashboardWidgetId, direction: "up" | "down") => {
      setSettings((current) => {
        const order = [...current.widgetOrder];
        const idx = order.indexOf(id);
        if (idx < 0) return current;
        const swap = direction === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= order.length) return current;
        [order[idx], order[swap]] = [order[swap], order[idx]];
        return normalizeLayoutSettings({ ...current, widgetOrder: order });
      });
    },
    []
  );

  const toggleWidgetHidden = useCallback((id: DashboardWidgetId) => {
    setSettings((current) => {
      const hidden = new Set(current.hiddenWidgets);
      if (hidden.has(id)) hidden.delete(id);
      else hidden.add(id);
      return normalizeLayoutSettings({ ...current, hiddenWidgets: [...hidden] });
    });
  }, []);

  const moveOverviewKpi = useCallback((id: OverviewKpiId, direction: "up" | "down") => {
    setSettings((current) =>
      normalizeLayoutSettings({
        ...current,
        overviewKpiOrder: moveKpi(current.overviewKpiOrder, id, direction),
      })
    );
  }, []);

  const toggleOverviewKpiHidden = useCallback((id: OverviewKpiId) => {
    setSettings((current) =>
      normalizeLayoutSettings({
        ...current,
        overviewHiddenKpis: toggleKpiHidden(
          current.overviewKpiOrder,
          current.overviewHiddenKpis,
          id
        ),
      })
    );
  }, []);

  const moveRevenueKpi = useCallback((id: RevenueKpiId, direction: "up" | "down") => {
    setSettings((current) =>
      normalizeLayoutSettings({
        ...current,
        revenueKpiOrder: moveKpi(current.revenueKpiOrder, id, direction),
      })
    );
  }, []);

  const toggleRevenueKpiHidden = useCallback((id: RevenueKpiId) => {
    setSettings((current) =>
      normalizeLayoutSettings({
        ...current,
        revenueHiddenKpis: toggleKpiHidden(
          current.revenueKpiOrder,
          current.revenueHiddenKpis,
          id
        ),
      })
    );
  }, []);

  const theme =
    LAYOUT_CUSTOMIZE_THEMES.find((t) => t.id === settings.themeId) ??
    LAYOUT_CUSTOMIZE_THEMES[0];

  const value = useMemo<CustomerPortalContextValue>(
    () => ({
      workspaces: CUSTOMER_DEMO_WORKSPACES,
      workspaceId,
      workspace,
      workspaceInvalid: false,
      workspaceSessionKey: 0,
      client: undefined,
      setWorkspaceId: noopSetWorkspace,
      settings,
      updateSettings,
      resetLayoutToDefaults,
      moveWidget,
      toggleWidgetHidden,
      moveOverviewKpi,
      toggleOverviewKpiHidden,
      moveRevenueKpi,
      toggleRevenueKpiHidden,
      theme,
      navigationBase,
      liveSamplePreview: true,
    }),
    [
      workspaceId,
      workspace,
      noopSetWorkspace,
      settings,
      updateSettings,
      resetLayoutToDefaults,
      moveWidget,
      toggleWidgetHidden,
      moveOverviewKpi,
      toggleOverviewKpiHidden,
      moveRevenueKpi,
      toggleRevenueKpiHidden,
      theme,
      navigationBase,
    ]
  );

  return (
    <CustomerPortalContext.Provider value={value}>{children}</CustomerPortalContext.Provider>
  );
}
