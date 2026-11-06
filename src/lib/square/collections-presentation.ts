import { getSquareEnvironment, STALE_SUCCESSFUL_SYNC_MS, SYNC_STUCK_MS, type SquareEnvironment } from "./config";

const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export const SQUARE_COLLECTIONS_COPY = {
  title: "Square Collections",
  intro:
    "Completed Square payments and refunds for the locations this company includes. Totals are money collected before processing fees. They are not QuickBooks receivables and they are not QuickBooks collections.",
  paymentsLabel: "Payments received",
  refundsLabel: "Refunds",
  netLabel: "Net collected",
  listLabel: "Recent activity",
} as const;

export type SquareStatusPayload = {
  connected?: boolean;
  status?: string;
  square_environment?: string | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  reporting_date?: string | null;
  reporting_timezone?: string | null;
  last_successful_sync_at?: string | null;
  last_sync_error_code?: string | null;
  syncing_started_at?: string | null;
  locations_confirmed?: boolean;
  selected_location_count?: number;
  currency_totals?: Array<{
    currency?: string;
    payments_minor?: number | string;
    refunds_minor?: number | string;
  }> | null;
};

export type SquareTransactionRow = {
  id: string;
  kind: "payment" | "refund";
  locationName: string | null;
  createdAt: string;
  reportingDate: string;
  currency: string;
  amountMinor: number;
  sourceType: string | null;
};

export type SquareCurrencyTotal = {
  currency: string;
  paymentsMinor: number;
  refundsMinor: number;
  netMinor: number;
};

export type SquareCollectionsViewModel = {
  title: string;
  intro: string;
  paymentsLabel: string;
  refundsLabel: string;
  netLabel: string;
  listLabel: string;
  showTotals: boolean;
  zeroActivity: boolean;
  stale: boolean;
  reportingDate: string | null;
  reportingTimezone: string | null;
  lastSuccessfulSyncAt: string | null;
  merchantName: string | null;
  environmentLabel: string | null;
  messages: string[];
  currencies: SquareCurrencyTotal[];
  transactions: SquareTransactionRow[];
};

function environmentLabel(value: string | null | undefined): string | null {
  if (value === "sandbox") return "Sandbox";
  if (value === "production") return "Production";
  return null;
}

function minor(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function currencyExponent(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

export function formatMinorAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 10 ** currencyExponent(currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currencyExponent(currency),
      maximumFractionDigits: currencyExponent(currency),
    }).format(major);
  } catch {
    return `${major.toFixed(currencyExponent(currency))} ${currency}`;
  }
}

export function parseSquareTransactions(rows: unknown): SquareTransactionRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const kind = record.kind === "payment" || record.kind === "refund" ? record.kind : null;
    const amount = minor(record.amount_minor as number | string | null);
    const currency = typeof record.currency === "string" ? record.currency : "";
    const reportingDate = typeof record.reporting_date === "string" ? record.reporting_date : "";
    const createdAt = typeof record.created_at === "string" ? record.created_at : "";
    if (!record.id || !kind || amount === null || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportingDate) || !createdAt) return [];
    return [
      {
        id: String(record.id),
        kind,
        locationName: typeof record.location_name === "string" ? record.location_name : null,
        createdAt,
        reportingDate,
        currency,
        amountMinor: amount,
        sourceType: typeof record.source_type === "string" ? record.source_type : null,
      },
    ];
  });
}

function parseTotals(rows: SquareStatusPayload["currency_totals"]): SquareCurrencyTotal[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const currency = row.currency ?? "";
    const paymentsMinor = minor(row.payments_minor);
    const refundsMinor = minor(row.refunds_minor);
    if (!/^[A-Z]{3}$/.test(currency) || paymentsMinor === null || refundsMinor === null) return [];
    if (paymentsMinor === 0 && refundsMinor === 0) return [];
    return [{ currency, paymentsMinor, refundsMinor, netMinor: paymentsMinor - refundsMinor }];
  });
}

export function buildSquareCollectionsViewModel(input: {
  deploymentEnvironment?: SquareEnvironment | null;
  status: SquareStatusPayload | null;
  transactions: unknown;
  loadError: boolean;
  now?: Date;
}): SquareCollectionsViewModel {
  const now = input.now ?? new Date();
  const deployment = input.deploymentEnvironment === undefined ? getSquareEnvironment() : input.deploymentEnvironment;
  const base: SquareCollectionsViewModel = {
    title: SQUARE_COLLECTIONS_COPY.title,
    intro: SQUARE_COLLECTIONS_COPY.intro,
    paymentsLabel: SQUARE_COLLECTIONS_COPY.paymentsLabel,
    refundsLabel: SQUARE_COLLECTIONS_COPY.refundsLabel,
    netLabel: SQUARE_COLLECTIONS_COPY.netLabel,
    listLabel: SQUARE_COLLECTIONS_COPY.listLabel,
    showTotals: false,
    zeroActivity: false,
    stale: false,
    reportingDate: null,
    reportingTimezone: null,
    lastSuccessfulSyncAt: null,
    merchantName: null,
    environmentLabel: environmentLabel(deployment),
    messages: [],
    currencies: [],
    transactions: [],
  };

  if (input.loadError) {
    base.messages.push("Square collections could not be loaded. Refresh the page or contact RavenView if this continues.");
    return base;
  }
  if (!deployment) {
    base.messages.push("Square is not configured in this environment, so collections are hidden.");
    return base;
  }

  const status = input.status;
  if (!status?.connected) {
    base.messages.push("No Square seller is connected. An owner can connect one seller in settings.");
    return base;
  }

  base.merchantName = status.merchant_name ?? null;
  base.environmentLabel = environmentLabel(status.square_environment) ?? base.environmentLabel;
  if (status.square_environment && status.square_environment !== deployment) {
    base.messages.push(
      `This company is connected to a ${status.square_environment} Square seller, and this deployment is ${deployment}. Collections from the other environment are hidden.`
    );
    return base;
  }

  if (!status.locations_confirmed || (status.selected_location_count ?? 0) === 0) {
    base.messages.push("Choose at least one Square location before collections can be shown.");
    return base;
  }

  if (status.status === "reconnect_required") {
    base.messages.push("Square needs to be reconnected before collections can update.");
  }
  if (status.status === "syncing") {
    const started = status.syncing_started_at ? new Date(status.syncing_started_at).getTime() : now.getTime();
    base.messages.push(now.getTime() - started > SYNC_STUCK_MS ? "A sync did not finish." : "A sync is in progress.");
  }
  if (status.status === "error") {
    base.messages.push("The last sync did not finish successfully.");
  }

  const lastSync = status.last_successful_sync_at ?? null;
  if (!lastSync) {
    base.messages.push("No successful sync yet. Payments and refunds are unavailable.");
    return base;
  }

  base.lastSuccessfulSyncAt = lastSync;
  base.reportingDate = status.reporting_date ?? null;
  base.reportingTimezone = status.reporting_timezone ?? null;
  base.stale = now.getTime() - new Date(lastSync).getTime() > STALE_SUCCESSFUL_SYNC_MS;
  base.currencies = parseTotals(status.currency_totals);
  base.transactions = parseSquareTransactions(input.transactions);
  base.showTotals = true;
  base.zeroActivity = base.currencies.length === 0;
  if (base.stale) {
    base.messages.push("The last successful sync is more than a day old, so these collections may be out of date.");
  }
  if (!base.reportingDate) {
    base.showTotals = false;
    base.zeroActivity = false;
    base.messages.push("The reporting date is missing, so payments and refunds are unavailable.");
  }
  return base;
}
