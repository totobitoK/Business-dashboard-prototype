import type { ConnectorReadState, DailyDashboardSnapshot, DailyInvoice } from "./types";
import { CONNECTOR_STATE_LABEL } from "./types";

const ATTENTION_STATES = new Set<ConnectorReadState>([
  "disconnected",
  "unavailable",
  "setup_incomplete",
  "stale",
  "reconnect_required",
  "load_error",
]);

export function classifyQuickBooks(input: {
  loadError: boolean;
  deploymentConfigured: boolean;
  connected: boolean;
  environmentMismatch: boolean;
  connectionStatus: string | null;
  hasSuccessfulSync: boolean;
  showBalances: boolean;
  stale: boolean;
  openBalance: number | null;
  visibleInvoiceCount: number;
}): ConnectorReadState {
  if (input.loadError) return "load_error";
  if (!input.deploymentConfigured || input.environmentMismatch) return "unavailable";
  if (!input.connected) return "disconnected";
  if (input.connectionStatus === "reconnect_required") return "reconnect_required";
  if (!input.hasSuccessfulSync) return "setup_incomplete";
  if (input.connectionStatus === "syncing") return "syncing";
  if (input.connectionStatus === "error" && !input.showBalances) return "load_error";
  if (input.stale && input.showBalances) return "stale";
  if (input.showBalances && (input.openBalance ?? 0) === 0 && input.visibleInvoiceCount === 0) {
    return "verified_empty";
  }
  if (input.showBalances) return "ready";
  return "load_error";
}

export function classifySquare(input: {
  loadError: boolean;
  deploymentConfigured: boolean;
  connected: boolean;
  environmentMismatch: boolean;
  locationsReady: boolean;
  connectionStatus: string | null;
  hasSuccessfulSync: boolean;
  showTotals: boolean;
  stale: boolean;
  zeroActivity: boolean;
  transactionCount: number;
}): ConnectorReadState {
  if (input.loadError) return "load_error";
  if (!input.deploymentConfigured || input.environmentMismatch) return "unavailable";
  if (!input.connected) return "disconnected";
  if (input.connectionStatus === "reconnect_required") return "reconnect_required";
  if (!input.locationsReady || !input.hasSuccessfulSync) return "setup_incomplete";
  if (input.connectionStatus === "syncing") return "syncing";
  if (input.connectionStatus === "error" && !input.showTotals) return "load_error";
  if (input.stale && input.showTotals) return "stale";
  if (input.showTotals && input.zeroActivity && input.transactionCount === 0) return "verified_empty";
  if (input.showTotals) return "ready";
  return "load_error";
}

export function classifyCalendar(input: {
  loadError: boolean;
  deploymentConfigured: boolean;
  connected: boolean;
  connectionStatus: string | null;
  selectedCalendarCount: number;
  appointmentCount: number;
}): ConnectorReadState {
  if (input.loadError) return "load_error";
  if (!input.deploymentConfigured) return "unavailable";
  if (!input.connected) return "disconnected";
  if (input.connectionStatus === "reconnect_required") return "reconnect_required";
  if (input.selectedCalendarCount === 0) return "setup_incomplete";
  if (input.connectionStatus === "syncing" && input.appointmentCount === 0) return "syncing";
  if (input.connectionStatus === "error" && input.appointmentCount === 0) return "load_error";
  if (input.connectionStatus === "error") return "stale";
  if (input.appointmentCount === 0) return "verified_empty";
  if (input.connectionStatus === "syncing") return "syncing";
  return "ready";
}

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  external: boolean;
};

export function buildAttentionItems(
  snapshot: DailyDashboardSnapshot,
  links: { receivables: string; connections: string }
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const overdue = snapshot.receivables.invoices.filter((invoice) => invoice.overdue);
  for (const invoice of overdue.slice(0, 4)) {
    items.push(invoiceAttention(invoice, links.receivables));
  }
  if (overdue.length > 4) {
    items.push({
      id: "more-overdue",
      title: `${overdue.length - 4} more past-due invoices`,
      detail: "Open receivables for the full list.",
      href: links.receivables,
      external: false,
    });
  }
  for (const connector of snapshot.connectors) {
    if (!ATTENTION_STATES.has(connector.state)) continue;
    items.push({
      id: `connector-${connector.id}`,
      title: connector.label,
      detail: connector.detail || CONNECTOR_STATE_LABEL[connector.state],
      href: links.connections,
      external: false,
    });
  }
  return items;
}

function invoiceAttention(invoice: DailyInvoice, receivablesHref: string): AttentionItem {
  const who = invoice.customer || "Customer";
  const doc = invoice.docNumber ? `${invoice.docNumber} · ` : "";
  return {
    id: `overdue-${invoice.id}`,
    title: `${doc}${who}`,
    detail: "Past due",
    href: invoice.href ?? `${receivablesHref}#inv-${invoice.id}`,
    external: Boolean(invoice.href),
  };
}
