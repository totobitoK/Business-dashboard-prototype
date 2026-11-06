import {
  getQuickBooksEnvironment,
  STALE_SUCCESSFUL_SYNC_MS,
  SYNC_STUCK_MS,
  type IntuitEnvironment,
} from "./config";
import { isInvoiceOverdue } from "./reporting-date";

export const RECEIVABLES_COPY = {
  title: "Receivables",
  intro:
    "Unpaid balances on open invoices from QuickBooks Online. These figures are not revenue and are not money collected.",
  openLabel: "Open balance",
  overdueLabel: "Overdue balance",
  listLabel: "Open invoices",
  overdueRule:
    "An invoice is overdue when its due date is before the company's reporting date. Invoices with no due date are not overdue.",
} as const;

export type QuickBooksStatusPayload = {
  connected?: boolean;
  status?: string;
  intuit_environment?: string | null;
  realm_id?: string | null;
  company_name?: string | null;
  reporting_date?: string | null;
  reporting_timezone?: string | null;
  reporting_timezone_source?: string | null;
  last_successful_sync_at?: string | null;
  last_sync_error_code?: string | null;
  syncing_started_at?: string | null;
  open_balance?: number | string | null;
  overdue_balance?: number | string | null;
  invoice_count?: number | null;
};

export type ReceivablesInvoiceRow = {
  id: string;
  docNumber: string | null;
  customerName: string | null;
  txnDate: string | null;
  dueDate: string | null;
  remainingBalance: number;
  overdue: boolean;
};

export type ReceivablesViewModel = {
  title: string;
  intro: string;
  openLabel: string;
  overdueLabel: string;
  listLabel: string;
  overdueRule: string;
  showBalances: boolean;
  openBalance: number | null;
  overdueBalance: number | null;
  reportingDate: string | null;
  reportingTimezone: string | null;
  utcDefaultWarning: boolean;
  stale: boolean;
  lastSuccessfulSyncAt: string | null;
  messages: string[];
  invoices: ReceivablesInvoiceRow[];
  invoiceCount: number;
  environmentLabel: string | null;
  companyName: string | null;
};

function money(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100) / 100;
}

function asDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function environmentLabel(environment: string | null | undefined): string | null {
  if (environment === "sandbox") return "Sandbox";
  if (environment === "production") return "Production";
  return null;
}

export function parseInvoiceRows(
  rows: unknown,
  reportingDate: string | null
): ReceivablesInvoiceRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const remaining = money(record.remaining_balance as number | string | null);
    if (!record.id || remaining === null || remaining <= 0) return [];
    const dueDate = asDate(typeof record.due_date === "string" ? record.due_date : null);
    return [
      {
        id: String(record.id),
        docNumber: typeof record.doc_number === "string" ? record.doc_number : null,
        customerName: typeof record.customer_name === "string" ? record.customer_name : null,
        txnDate: asDate(typeof record.txn_date === "string" ? record.txn_date : null),
        dueDate,
        remainingBalance: remaining,
        overdue: isInvoiceOverdue(dueDate, reportingDate),
      },
    ];
  });
}

export function buildReceivablesViewModel(input: {
  status: QuickBooksStatusPayload | null;
  invoices: unknown;
  loadError: boolean;
  now?: Date;
  deploymentEnvironment?: IntuitEnvironment | null;
}): ReceivablesViewModel {
  const now = input.now ?? new Date();
  const deployment = input.deploymentEnvironment ?? getQuickBooksEnvironment();
  const base = {
    title: RECEIVABLES_COPY.title,
    intro: RECEIVABLES_COPY.intro,
    openLabel: RECEIVABLES_COPY.openLabel,
    overdueLabel: RECEIVABLES_COPY.overdueLabel,
    listLabel: RECEIVABLES_COPY.listLabel,
    overdueRule: RECEIVABLES_COPY.overdueRule,
    showBalances: false,
    openBalance: null as number | null,
    overdueBalance: null as number | null,
    reportingDate: null as string | null,
    reportingTimezone: null as string | null,
    utcDefaultWarning: false,
    stale: false,
    lastSuccessfulSyncAt: null as string | null,
    messages: [] as string[],
    invoices: [] as ReceivablesInvoiceRow[],
    invoiceCount: 0,
    environmentLabel: environmentLabel(deployment),
    companyName: null as string | null,
  };

  if (input.loadError) {
    base.messages.push("Receivables could not be loaded. Refresh the page or contact RavenView if this continues.");
    return base;
  }
  if (!deployment) {
    base.messages.push("QuickBooks Online is not configured in this environment, so invoice balances are hidden.");
    return base;
  }

  const status = input.status;
  if (!status?.connected) {
    base.messages.push(
      "No QuickBooks Online company is connected. An owner can connect one company in settings."
    );
    return base;
  }

  base.companyName = status.company_name ?? null;
  base.environmentLabel = environmentLabel(status.intuit_environment) ?? base.environmentLabel;
  if (status.intuit_environment && status.intuit_environment !== deployment) {
    base.messages.push(
      `This company is connected to a ${status.intuit_environment} QuickBooks company, and this deployment is ${deployment}. Balances from the other environment are hidden.`
    );
    return base;
  }

  const reportingDate = asDate(status.reporting_date);
  const lastSync = status.last_successful_sync_at ?? null;
  base.reportingDate = reportingDate;
  base.reportingTimezone = status.reporting_timezone ?? null;
  base.lastSuccessfulSyncAt = lastSync;
  base.utcDefaultWarning = status.reporting_timezone_source === "utc_default";
  base.invoiceCount = status.invoice_count ?? 0;

  if (status.status === "reconnect_required") {
    base.messages.push("QuickBooks needs to be reconnected before balances can update.");
  }
  if (status.status === "syncing") {
    const started = status.syncing_started_at ? new Date(status.syncing_started_at).getTime() : now.getTime();
    if (now.getTime() - started > SYNC_STUCK_MS) {
      base.messages.push("A sync did not finish.");
    } else {
      base.messages.push("A sync is in progress.");
    }
  }
  if (status.status === "error") {
    base.messages.push("The last sync did not finish successfully.");
  }

  if (!lastSync) {
    base.messages.push("No successful sync yet. Open and overdue balances are unavailable.");
    return base;
  }

  const age = now.getTime() - new Date(lastSync).getTime();
  base.stale = age > STALE_SUCCESSFUL_SYNC_MS;
  base.showBalances = true;
  base.openBalance = money(status.open_balance);
  base.overdueBalance = reportingDate ? money(status.overdue_balance) : null;
  base.invoices = parseInvoiceRows(input.invoices, reportingDate);
  if (base.stale) {
    base.messages.push("The last successful sync is more than a day old, so these balances may be out of date.");
  }
  if (base.utcDefaultWarning) {
    base.messages.push(
      "Overdue uses UTC as the reporting date because this company's time zone is not set. Set QUICKBOOKS_REPORTING_TIMEZONE to the QuickBooks company time zone and sync again before relying on the overdue balance."
    );
  }
  if (base.overdueBalance === null) {
    base.messages.push("The overdue balance is unavailable because the reporting date is missing.");
  }
  return base;
}
