import { CONNECTOR_TOOL_LABELS } from "./connector-catalog";
import type { DashboardSectionId } from "./dashboard-section-routes";
import type { DailyDashboardSnapshot } from "./daily-dashboard/types";
import type { Client, ConnectionDemoStatus, DataSourceTool } from "./types";
import type { DashboardWidgetId } from "./workspace-widget-layout";
import {
  OVERVIEW_KPI_IDS,
  REVENUE_KPI_IDS,
  type OverviewKpiId,
  type RevenueKpiId,
} from "./workspace-kpi-layout";

/**
 * HubSpot deal figures. Kept off the saved revenue KPI list so a missing
 * HubSpot connection cannot append empty cards to every layout.
 */
export const SALES_BLOCK_IDS = [
  "month_pipeline",
  "open_pipeline",
  "deals_won_this_month",
  "weighted_pipeline",
] as const;

export type SalesBlockId = (typeof SALES_BLOCK_IDS)[number];

export const SALES_BLOCK_LABELS: Record<SalesBlockId, string> = {
  month_pipeline: "Month pipeline",
  open_pipeline: "Open pipeline",
  deals_won_this_month: "Deals won this month",
  weighted_pipeline: "Weighted pipeline",
};

export const CONNECT_SOURCE_PROMPT = "Connect a source to see this dashboard.";

export const HUBSPOT_DEALS_PENDING =
  "HubSpot is connected. Open pipeline, deals won this month, and weighted pipeline appear after sync.";

export const JOBBER_JOBS_PENDING =
  "Jobber is connected. Completed jobs appear after sync.";

const CONNECTED_DEMO_STATUSES = new Set<ConnectionDemoStatus>([
  "authorized",
  "syncing",
  "data-validated",
  "needs-attention",
]);

const SNAPSHOT_DISCONNECTED = new Set(["disconnected", "unavailable"]);

const LABEL_TO_TOOL = new Map<string, DataSourceTool>();
for (const [id, label] of Object.entries(CONNECTOR_TOOL_LABELS) as [DataSourceTool, string][]) {
  LABEL_TO_TOOL.set(id, id);
  LABEL_TO_TOOL.set(label.trim().toLowerCase(), id);
}
LABEL_TO_TOOL.set("stripe", "stripe");

export type CustomerDashboardComposition = {
  connected: DataSourceTool[];
  /** HubSpot is connected. Pipeline blocks are sales, not invoices. */
  sales: boolean;
  /** Jobber is connected. Calendar appointments do not set this. */
  service: boolean;
  /** No connected source defines a block. Overview asks them to connect one. */
  promptToConnect: boolean;
  overviewKpis: OverviewKpiId[];
  revenueKpis: RevenueKpiId[];
  salesBlocks: SalesBlockId[];
  widgets: DashboardWidgetId[];
  sections: DashboardSectionId[];
};

export function composeCustomerDashboard(input: {
  connected: readonly DataSourceTool[];
  /**
   * Weekly and monthly revenue stay off unless paid invoices are counted as
   * revenue. The live QuickBooks import drops fully paid invoices, so this
   * stays false until a source actually defines that figure.
   */
  quickBooksCountsPaidInvoicesAsRevenue?: boolean;
}): CustomerDashboardComposition {
  const connected = [...new Set(input.connected)];
  const has = (...ids: DataSourceTool[]) => ids.some((id) => connected.includes(id));
  const payments = has("square", "stripe");
  const books = has("quickbooks");
  const revenueFromInvoices = books && input.quickBooksCountsPaidInvoicesAsRevenue === true;
  const jobs = has("jobber");
  const schedule = has("jobber", "google-calendar");
  const sales = has("hubspot");

  const overviewKpis = OVERVIEW_KPI_IDS.filter((id) => {
    if (id === "payments_collected") return payments;
    if (id === "jobs_completed") return jobs;
    if (id === "outstanding_balance" || id === "overdue_balance") return books;
    return false;
  });

  const revenueKpis = REVENUE_KPI_IDS.filter((id) => {
    if (id === "weekly_revenue" || id === "monthly_revenue") return revenueFromInvoices;
    if (id === "overdue_ar") return books;
    // Month pipeline on this list is invoice balance, not a HubSpot deal total.
    if (id === "month_pipeline") return false;
    return false;
  });

  const salesBlocks = sales ? [...SALES_BLOCK_IDS] : [];

  const widgets: DashboardWidgetId[] = [];
  if (overviewKpis.length > 0 || revenueKpis.length > 0) widgets.push("metrics");
  if (payments) widgets.push("collections_chart");
  if (jobs) widgets.push("job_activity");
  if (schedule) widgets.push("appointments");
  if (books) widgets.push("invoices");

  const showRevenue = revenueFromInvoices || salesBlocks.length > 0;
  const sections: DashboardSectionId[] = ["overview"];
  if (showRevenue) sections.push("revenue");
  if (schedule) sections.push("schedule");

  const promptToConnect =
    overviewKpis.length === 0 &&
    revenueKpis.length === 0 &&
    salesBlocks.length === 0 &&
    widgets.length === 0;

  return {
    connected,
    sales,
    service: jobs,
    promptToConnect,
    overviewKpis,
    revenueKpis,
    salesBlocks,
    widgets,
    sections,
  };
}

export function visibleDashboardSection(
  requested: DashboardSectionId,
  composition: CustomerDashboardComposition | null
): DashboardSectionId {
  if (!composition) return requested;
  if (composition.promptToConnect) return "overview";
  if (composition.sections.includes(requested)) return requested;
  return "overview";
}

/** Saved layout order, limited to blocks the connected sources unlock. */
export function visibleAllowedIds<T extends string>(
  order: readonly T[],
  hidden: readonly T[],
  allowed: readonly T[] | null
): T[] {
  const hiddenSet = new Set(hidden);
  const visible = order.filter((id) => !hiddenSet.has(id));
  if (!allowed) return visible;
  const allowedSet = new Set(allowed);
  const next = visible.filter((id) => allowedSet.has(id));
  if (next.length > 0) return next;
  return order.filter((id) => allowedSet.has(id));
}

export function toolFromConnectorLabel(label: string | null | undefined): DataSourceTool | null {
  if (!label) return null;
  return LABEL_TO_TOOL.get(label.trim().toLowerCase()) ?? null;
}

/**
 * Connected demo sources. `null` means this screen has no client, so the
 * caller keeps the unconstrained sample layout.
 */
export function connectedToolsFromClient(client: Client | null | undefined): DataSourceTool[] | null {
  if (!client) return null;
  const tools: DataSourceTool[] = [];
  for (const connection of client.guidedConnections ?? []) {
    if (!CONNECTED_DEMO_STATUSES.has(connection.demoStatus)) continue;
    const tool =
      toolFromConnectorLabel(connection.label) ?? toolFromConnectorLabel(connection.provider);
    if (tool && !tools.includes(tool)) tools.push(tool);
  }
  return tools;
}

export function connectedToolsFromSnapshot(snapshot: DailyDashboardSnapshot): DataSourceTool[] {
  const tools: DataSourceTool[] = [];
  for (const connector of snapshot.connectors) {
    if (SNAPSHOT_DISCONNECTED.has(connector.state)) continue;
    const tool = toolFromConnectorLabel(connector.id);
    if (tool && !tools.includes(tool)) tools.push(tool);
  }
  return tools;
}
