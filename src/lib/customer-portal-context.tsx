"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LayoutCustomizeTheme } from "./layout-customize-themes";
import { LAYOUT_CUSTOMIZE_THEMES } from "./layout-customize-themes";
import {
  CUSTOMER_DEMO_WORKSPACES,
  getDefaultWorkspaceId,
  getWorkspaceById,
  isValidWorkspaceId,
  type CustomerWorkspaceMeta,
} from "./customer-workspaces";
import { useClientStore } from "./client-store";
import type { Client } from "./types";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  normalizeLayoutSettings,
  type DashboardWidgetId,
  type WorkspaceLayoutSettings,
} from "./workspace-widget-layout";

const WORKSPACE_STORAGE_KEY = "customer-portal-demo-workspace";
const SETTINGS_STORAGE_KEY = "customer-portal-workspace-settings";

export type WorkspaceThemeId = (typeof LAYOUT_CUSTOMIZE_THEMES)[number]["id"];

export type WorkspaceAppearanceSettings = WorkspaceLayoutSettings;

const defaultSettings: WorkspaceAppearanceSettings = DEFAULT_WORKSPACE_LAYOUT;

type SettingsMap = Record<string, WorkspaceAppearanceSettings>;

interface CustomerPortalContextValue {
  workspaces: CustomerWorkspaceMeta[];
  workspaceId: string;
  workspace: CustomerWorkspaceMeta | null;
  workspaceInvalid: boolean;
  /** Increments on workspace change — key transient UI state to workspace. */
  workspaceSessionKey: number;
  client: Client | undefined;
  setWorkspaceId: (id: string) => void;
  settings: WorkspaceAppearanceSettings;
  updateSettings: (patch: Partial<WorkspaceAppearanceSettings>) => void;
  resetLayoutToDefaults: () => void;
  moveWidget: (id: DashboardWidgetId, direction: "up" | "down") => void;
  toggleWidgetHidden: (id: DashboardWidgetId) => void;
  theme: LayoutCustomizeTheme;
}

const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(
  null
);

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

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const { clients } = useClientStore();
  const [workspaceId, setWorkspaceIdState] = useState(getDefaultWorkspaceId);
  const [workspaceInvalid, setWorkspaceInvalid] = useState(false);
  const [settingsMap, setSettingsMap] = useState<SettingsMap>({});
  const [ready, setReady] = useState(false);
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
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || workspaceInvalid || !workspaceId) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }, [workspaceId, ready, workspaceInvalid]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsMap));
  }, [settingsMap, ready]);

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

  const value = useMemo(
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
      theme,
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
      theme,
    ]
  );

  if (!ready) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-ink-muted">Loading workspace…</p>
      </div>
    );
  }

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

/** Applies ?workspace= on navigation (overrides stored demo selection). */
export function CustomerPortalQuerySync() {
  const { setWorkspaceId } = useCustomerPortal();

  useEffect(() => {
    function applyFromUrl() {
      const param = new URLSearchParams(window.location.search).get("workspace");
      if (param && isValidWorkspaceId(param)) {
        setWorkspaceId(param);
      }
    }
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [setWorkspaceId]);

  return null;
}

export function useCustomerPortal() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) {
    throw new Error("useCustomerPortal must be used within CustomerPortalProvider");
  }
  return ctx;
}

export function buildCustomerPortalPreviewUrl(workspaceId: string): string {
  return `/dashboard?workspace=${encodeURIComponent(workspaceId)}`;
}
