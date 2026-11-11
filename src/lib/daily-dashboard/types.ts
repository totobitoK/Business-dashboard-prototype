import type { SquareCurrencyTotal, SquareTransactionRow } from "@/lib/square/collections-presentation";

export type DataSource = "demo" | "live";

export type ConnectorReadState =
  | "loading"
  | "disconnected"
  | "unavailable"
  | "setup_incomplete"
  | "syncing"
  | "verified_empty"
  | "stale"
  | "reconnect_required"
  | "load_error"
  | "ready";

export const CONNECTOR_STATE_LABEL: Record<ConnectorReadState, string> = {
  loading: "Loading",
  disconnected: "Not connected",
  unavailable: "Unavailable in this environment",
  setup_incomplete: "Setup incomplete",
  syncing: "Syncing",
  verified_empty: "Nothing in this read",
  stale: "Stale",
  reconnect_required: "Reconnect required",
  load_error: "Could not load",
  ready: "Up to date",
};

export type DailyInvoice = {
  id: string;
  customer: string;
  docNumber: string | null;
  balance: number;
  dueDate: string | null;
  overdue: boolean;
  /** QuickBooks invoice URL when the live read has one. */
  href: string | null;
};

export type DailyAppointment = {
  id: string;
  title: string;
  whenLabel: string;
  isoDate: string;
  calendarName: string | null;
};

export type DailyConnector = {
  id: "quickbooks" | "square" | "google-calendar";
  label: string;
  state: ConnectorReadState;
  detail: string;
  lastSuccessfulSyncAt: string | null;
};

export type DailyDashboardSnapshot = {
  source: DataSource;
  /** Set only for demo records. Live snapshots leave this null. */
  sampleLabel: string | null;
  companyName: string;
  /** Company reporting date the collections period is anchored to. */
  asOfDate: string;
  timeZone: string;
  receivables: {
    state: ConnectorReadState;
    messages: string[];
    showBalances: boolean;
    asOfDate: string | null;
    openBalance: number | null;
    overdueBalance: number | null;
    overdueCount: number;
    invoices: DailyInvoice[];
    invoiceCount: number;
    listTruncated: boolean;
    lastSuccessfulSyncAt: string | null;
    environmentLabel: string | null;
    sourceCompanyName: string | null;
  };
  collections: {
    state: ConnectorReadState;
    messages: string[];
    showTotals: boolean;
    timeZone: string | null;
    lastSuccessfulSyncAt: string | null;
    environmentLabel: string | null;
    merchantName: string | null;
    /** Full reporting-date totals from the server read, when that read succeeded. */
    authoritativeDay: { date: string; currencies: SquareCurrencyTotal[] } | null;
    transactions: SquareTransactionRow[];
    /** Null when the transaction set is complete. Live reads are capped. */
    loadedCap: number | null;
  };
  schedule: {
    state: ConnectorReadState;
    messages: string[];
    windowLabel: string;
    lastSyncAt: string | null;
    appointments: DailyAppointment[];
  };
  connectors: DailyConnector[];
};

export function emptyLiveSnapshot(companyName: string, asOfDate: string): DailyDashboardSnapshot {
  const blocked = {
    state: "disconnected" as const,
    messages: ["No company is linked to this account."],
  };
  return {
    source: "live",
    sampleLabel: null,
    companyName,
    asOfDate,
    timeZone: "America/New_York",
    receivables: {
      ...blocked,
      showBalances: false,
      asOfDate: null,
      openBalance: null,
      overdueBalance: null,
      overdueCount: 0,
      invoices: [],
      invoiceCount: 0,
      listTruncated: false,
      lastSuccessfulSyncAt: null,
      environmentLabel: null,
      sourceCompanyName: null,
    },
    collections: {
      ...blocked,
      showTotals: false,
      timeZone: null,
      lastSuccessfulSyncAt: null,
      environmentLabel: null,
      merchantName: null,
      authoritativeDay: null,
      transactions: [],
      loadedCap: 40,
    },
    schedule: {
      ...blocked,
      windowLabel: "Today / Upcoming",
      lastSyncAt: null,
      appointments: [],
    },
    connectors: [],
  };
}
