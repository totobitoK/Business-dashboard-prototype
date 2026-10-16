import { createContext, useContext } from "react";
import type { LayoutCustomizeTheme } from "./layout-customize-themes";
import type { CustomerWorkspaceMeta } from "./customer-workspaces";
import type { Client } from "./types";
import type {
  DashboardWidgetId,
  OverviewKpiId,
  RevenueKpiId,
  WorkspaceAppearanceSettings,
} from "./workspace-widget-layout";

export interface CustomerPortalContextValue {
  workspaces: CustomerWorkspaceMeta[];
  workspaceId: string;
  workspace: CustomerWorkspaceMeta | null;
  workspaceInvalid: boolean;
  workspaceSessionKey: number;
  client: Client | undefined;
  setWorkspaceId: (id: string) => void;
  settings: WorkspaceAppearanceSettings;
  updateSettings: (patch: Partial<WorkspaceAppearanceSettings>) => void;
  resetLayoutToDefaults: () => void;
  moveWidget: (id: DashboardWidgetId, direction: "up" | "down") => void;
  toggleWidgetHidden: (id: DashboardWidgetId) => void;
  moveOverviewKpi: (id: OverviewKpiId, direction: "up" | "down") => void;
  toggleOverviewKpiHidden: (id: OverviewKpiId) => void;
  moveRevenueKpi: (id: RevenueKpiId, direction: "up" | "down") => void;
  toggleRevenueKpiHidden: (id: RevenueKpiId) => void;
  theme: LayoutCustomizeTheme;
  /** When set, dashboard section links stay on this path (live project preview). */
  navigationBase?: string;
  /** Live sample preview — no demo CRM client, no persisted settings. */
  liveSamplePreview?: boolean;
}

export const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(
  null
);

export function useCustomerPortal() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) {
    throw new Error("useCustomerPortal must be used within a portal provider");
  }
  return ctx;
}
