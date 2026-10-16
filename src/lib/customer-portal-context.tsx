"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LAYOUT_CUSTOMIZE_THEMES } from "./layout-customize-themes";
import {
  CUSTOMER_DEMO_WORKSPACES,
  getDefaultWorkspaceId,
  getWorkspaceById,
  isValidWorkspaceId,
} from "./customer-workspaces";
import { useClientStore } from "./client-store";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  normalizeLayoutSettings,
  type DashboardWidgetId,
  type OverviewKpiId,
  type RevenueKpiId,
  type WorkspaceAppearanceSettings,
} from "./workspace-widget-layout";
import { moveKpi, toggleKpiHidden } from "./workspace-kpi-layout";
import {
  CustomerPortalContext,
  type CustomerPortalContextValue,
  useCustomerPortal as useCustomerPortalShared,
} from "./customer-portal-context-shared";

const WORKSPACE_STORAGE_KEY = "customer-portal-demo-workspace";
const SETTINGS_STORAGE_KEY = "customer-portal-workspace-settings";

export type WorkspaceThemeId = (typeof LAYOUT_CUSTOMIZE_THEMES)[number]["id"];

export type { WorkspaceAppearanceSettings } from "./workspace-widget-layout";

const defaultSettings: WorkspaceAppearanceSettings = DEFAULT_WORKSPACE_LAYOUT;

type SettingsMap = Record<string, WorkspaceAppearanceSettings>;

function loadSettings(): SettingsMap {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SettingsMap;
    const out: SettingsMap = {};
    for (const [id, partial] of Object.entries(parsed)) {
      if (isValidWorkspaceId(id)) {
        out[id] = normalizeLayoutSettings(partial);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function resolveWorkspaceIdFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("workspace");
  if (!param) return null;
  return isValidWorkspaceId(param) ? param : "__invalid__";
}

/** Demo dashboard portal — persisted workspace selection and demo CRM client binding. */
export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const { clients } = useClientStore();
  const [workspaceId, setWorkspaceIdState] = useState(getDefaultWorkspaceId);
  const [workspaceInvalid, setWorkspaceInvalid] = useState(false);
  const [settingsMap, setSettingsMap] = useState<SettingsMap>({});
  const [portalSynced, setPortalSynced] = useState(false);
  const [workspaceSessionKey, setWorkspaceSessionKey] = useState(0);

  useEffect(() => {
    const fromQuery = resolveWorkspaceIdFromQuery();
    if (fromQuery === "__invalid__") {
      setWorkspaceInvalid(true);
      setWorkspaceIdState("");
    } else if (fromQuery) {
      setWorkspaceIdState(fromQuery);
      setWorkspaceInvalid(false);
    } else {
      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored && isValidWorkspaceId(stored)) {
        setWorkspaceIdState(stored);
        setWorkspaceInvalid(false);
      } else if (stored && !isValidWorkspaceId(stored)) {
        setWorkspaceInvalid(true);
        setWorkspaceIdState("");
      } else {
        setWorkspaceIdState(getDefaultWorkspaceId());
        setWorkspaceInvalid(false);
      }
    }
    setSettingsMap(loadSettings());
    setPortalSynced(true);
  }, []);

  useEffect(() => {
    if (!portalSynced || workspaceInvalid || !workspaceId) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }, [workspaceId, portalSynced, workspaceInvalid]);

  useEffect(() => {
    if (!portalSynced) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsMap));
  }, [settingsMap, portalSynced]);

  const workspace = workspaceInvalid
    ? null
    : getWorkspaceById(workspaceId) ?? null;

  const client = workspace
    ? clients.find((c) => c.id === workspace.clientId)
    : undefined;

  const settings = normalizeLayoutSettings(
    workspaceId && !workspaceInvalid
      ? settingsMap[workspaceId] ?? defaultSettings
      : defaultSettings
  );

  const theme =
    LAYOUT_CUSTOMIZE_THEMES.find((t) => t.id === settings.themeId) ??
    LAYOUT_CUSTOMIZE_THEMES[0];

  const setWorkspaceId = useCallback((id: string) => {
    if (!isValidWorkspaceId(id)) return;
    setWorkspaceInvalid(false);
    setWorkspaceIdState((prev) => {
      if (prev === id) return prev;
      setWorkspaceSessionKey((k) => k + 1);
      return id;
    });
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceAppearanceSettings>) => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => ({
        ...prev,
        [workspaceId]: normalizeLayoutSettings({
          ...(prev[workspaceId] ?? defaultSettings),
          ...patch,
        }),
      }));
    },
    [workspaceId, workspaceInvalid]
  );

  const resetLayoutToDefaults = useCallback(() => {
    if (workspaceInvalid || !workspaceId) return;
    setSettingsMap((prev) => ({
      ...prev,
      [workspaceId]: { ...DEFAULT_WORKSPACE_LAYOUT },
    }));
  }, [workspaceId, workspaceInvalid]);

  const moveWidget = useCallback(
    (id: DashboardWidgetId, direction: "up" | "down") => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        const order = [...current.widgetOrder];
        const idx = order.indexOf(id);
        if (idx < 0) return prev;
        const swap = direction === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= order.length) return prev;
        [order[idx], order[swap]] = [order[swap], order[idx]];
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({ ...current, widgetOrder: order }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const toggleWidgetHidden = useCallback(
    (id: DashboardWidgetId) => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        const hidden = new Set(current.hiddenWidgets);
        if (hidden.has(id)) hidden.delete(id);
        else hidden.add(id);
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({
            ...current,
            hiddenWidgets: [...hidden],
          }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const moveOverviewKpi = useCallback(
    (id: OverviewKpiId, direction: "up" | "down") => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({
            ...current,
            overviewKpiOrder: moveKpi(current.overviewKpiOrder, id, direction),
          }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const toggleOverviewKpiHidden = useCallback(
    (id: OverviewKpiId) => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({
            ...current,
            overviewHiddenKpis: toggleKpiHidden(
              current.overviewKpiOrder,
              current.overviewHiddenKpis,
              id
            ),
          }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const moveRevenueKpi = useCallback(
    (id: RevenueKpiId, direction: "up" | "down") => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({
            ...current,
            revenueKpiOrder: moveKpi(current.revenueKpiOrder, id, direction),
          }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const toggleRevenueKpiHidden = useCallback(
    (id: RevenueKpiId) => {
      if (workspaceInvalid || !workspaceId) return;
      setSettingsMap((prev) => {
        const current = normalizeLayoutSettings(prev[workspaceId] ?? defaultSettings);
        return {
          ...prev,
          [workspaceId]: normalizeLayoutSettings({
            ...current,
            revenueHiddenKpis: toggleKpiHidden(
              current.revenueKpiOrder,
              current.revenueHiddenKpis,
              id
            ),
          }),
        };
      });
    },
    [workspaceId, workspaceInvalid]
  );

  const value = useMemo<CustomerPortalContextValue>(
    () => ({
      workspaces: CUSTOMER_DEMO_WORKSPACES,
      workspaceId,
      workspace,
      workspaceInvalid,
      workspaceSessionKey,
      client,
      setWorkspaceId,
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
      liveSamplePreview: false,
    }),
    [
      workspaceId,
      workspace,
      workspaceInvalid,
      workspaceSessionKey,
      client,
      setWorkspaceId,
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
    ]
  );

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function CustomerPortalQuerySync() {
  const { setWorkspaceId, liveSamplePreview } = useCustomerPortalShared();

  useEffect(() => {
    if (liveSamplePreview) return;
    function applyFromUrl() {
      const param = new URLSearchParams(window.location.search).get("workspace");
      if (param && isValidWorkspaceId(param)) {
        setWorkspaceId(param);
      }
    }
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [setWorkspaceId, liveSamplePreview]);

  return null;
}

export function useCustomerPortal() {
  return useCustomerPortalShared();
}

export function buildCustomerPortalPreviewUrl(workspaceId: string): string {
  return `/demo/dashboard?workspace=${encodeURIComponent(workspaceId)}`;
}
