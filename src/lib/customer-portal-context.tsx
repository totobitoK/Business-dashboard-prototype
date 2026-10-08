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
  type CustomerWorkspaceMeta,
} from "./customer-workspaces";
import { useClientStore } from "./client-store";
import type { Client } from "./types";

const WORKSPACE_STORAGE_KEY = "customer-portal-demo-workspace";
const SETTINGS_STORAGE_KEY = "customer-portal-workspace-settings";

export type WorkspaceThemeId = (typeof LAYOUT_CUSTOMIZE_THEMES)[number]["id"];

export interface WorkspaceAppearanceSettings {
  themeId: WorkspaceThemeId;
  showCompactMetrics: boolean;
}

const defaultSettings: WorkspaceAppearanceSettings = {
  themeId: "purple",
  showCompactMetrics: false,
};

type SettingsMap = Record<string, WorkspaceAppearanceSettings>;

interface CustomerPortalContextValue {
  workspaces: CustomerWorkspaceMeta[];
  workspaceId: string;
  workspace: CustomerWorkspaceMeta;
  client: Client | undefined;
  setWorkspaceId: (id: string) => void;
  settings: WorkspaceAppearanceSettings;
  updateSettings: (patch: Partial<WorkspaceAppearanceSettings>) => void;
  theme: LayoutCustomizeTheme;
}

const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(
  null
);

function loadSettings(): SettingsMap {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SettingsMap;
  } catch {
    return {};
  }
}

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const { clients } = useClientStore();
  const [workspaceId, setWorkspaceIdState] = useState(getDefaultWorkspaceId);
  const [settingsMap, setSettingsMap] = useState<SettingsMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (stored && getWorkspaceById(stored)) {
      setWorkspaceIdState(stored);
    }
    setSettingsMap(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }, [workspaceId, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsMap));
  }, [settingsMap, ready]);

  const workspace = getWorkspaceById(workspaceId) ?? CUSTOMER_DEMO_WORKSPACES[0];
  const client = clients.find((c) => c.id === workspace.clientId);

  const settings = settingsMap[workspaceId] ?? defaultSettings;

  const theme =
    LAYOUT_CUSTOMIZE_THEMES.find((t) => t.id === settings.themeId) ??
    LAYOUT_CUSTOMIZE_THEMES[0];

  const setWorkspaceId = useCallback((id: string) => {
    if (!getWorkspaceById(id)) return;
    setWorkspaceIdState(id);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceAppearanceSettings>) => {
      setSettingsMap((prev) => ({
        ...prev,
        [workspaceId]: { ...(prev[workspaceId] ?? defaultSettings), ...patch },
      }));
    },
    [workspaceId]
  );

  const value = useMemo(
    () => ({
      workspaces: CUSTOMER_DEMO_WORKSPACES,
      workspaceId,
      workspace,
      client,
      setWorkspaceId,
      settings,
      updateSettings,
      theme,
    }),
    [workspaceId, workspace, client, setWorkspaceId, settings, updateSettings, theme]
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

export function useCustomerPortal() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) {
    throw new Error("useCustomerPortal must be used within CustomerPortalProvider");
  }
  return ctx;
}
