import { QBO_INVOICE_PAGE_SIZE, QBO_MAX_INVOICE_PAGES } from "./config";
import { isInvoiceOverdue } from "./reporting-date";

export type QboInvoiceRecord = {
  Id?: string | number;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number | string;
  Balance?: number | string;
  CustomerRef?: { name?: string; value?: string };
  PrivateNote?: string;
  voided?: boolean;
  Voided?: boolean;
  status?: string;
  TxnStatus?: string;
  MetaData?: { LastUpdatedTime?: string };
};

export type OpenInvoiceDraft = {
  qboInvoiceId: string;
  docNumber: string | null;
  customerName: string | null;
  txnDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  remainingBalance: number;
  overdue: boolean;
  qboUpdatedAt: string | null;
};

export function moneyAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Math.round(Number(value) * 100) / 100;
  }
  return null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function isVoidedInvoice(raw: QboInvoiceRecord): boolean {
  if (raw.voided === true || raw.Voided === true) return true;
  const status = String(raw.status ?? raw.TxnStatus ?? "").trim().toLowerCase();
  if (status === "void" || status === "voided") return true;
  return (raw.PrivateNote ?? "").trim().toLowerCase() === "voided";
}

/** Open invoices keep QuickBooks Balance (amount still owed), not the original total. */
export function openInvoiceFromQbo(
  raw: QboInvoiceRecord,
  reportingDate: string
): OpenInvoiceDraft | null {
  if (isVoidedInvoice(raw)) return null;
  if (raw.Id === undefined || raw.Id === null || String(raw.Id).trim() === "") return null;
  const remaining = moneyAmount(raw.Balance);
  if (remaining === null || remaining <= 0) return null;
  const dueDate = isoDate(raw.DueDate);
  const customer = raw.CustomerRef?.name?.trim();
  return {
    qboInvoiceId: String(raw.Id).trim(),
    docNumber: raw.DocNumber?.trim() ? raw.DocNumber.trim().slice(0, 50) : null,
    customerName: customer ? customer.slice(0, 500) : null,
    txnDate: isoDate(raw.TxnDate),
    dueDate,
    totalAmount: moneyAmount(raw.TotalAmt),
    remainingBalance: remaining,
    overdue: isInvoiceOverdue(dueDate, reportingDate),
    qboUpdatedAt: raw.MetaData?.LastUpdatedTime ?? null,
  };
}

export function invoicesFromQueryResponse(body: unknown): QboInvoiceRecord[] {
  if (!body || typeof body !== "object") return [];
  const queryResponse = (body as { QueryResponse?: { Invoice?: unknown } }).QueryResponse;
  const invoice = queryResponse?.Invoice;
  if (!invoice) return [];
  if (Array.isArray(invoice)) return invoice as QboInvoiceRecord[];
  return [invoice as QboInvoiceRecord];
}

export function buildOpenInvoiceQuery(startPosition: number): string {
  if (!Number.isInteger(startPosition) || startPosition < 1) {
    throw new Error("BAD_START_POSITION");
  }
  return `select Id, DocNumber, TxnDate, DueDate, TotalAmt, Balance, CustomerRef, PrivateNote, MetaData from Invoice where Balance > '0' startposition ${startPosition} maxresults ${QBO_INVOICE_PAGE_SIZE}`;
}

export function nextInvoiceStartPosition(
  startPosition: number,
  returnedCount: number,
  pageSize = QBO_INVOICE_PAGE_SIZE
): number | null {
  if (returnedCount < pageSize) return null;
  return startPosition + returnedCount;
}

export function indexOpenInvoices(invoices: OpenInvoiceDraft[]): OpenInvoiceDraft[] {
  const byId = new Map<string, OpenInvoiceDraft>();
  for (const invoice of invoices) {
    byId.set(invoice.qboInvoiceId, invoice);
  }
  return [...byId.values()];
}

export function chunkInvoices<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("BAD_CHUNK");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function collectOpenInvoices(params: {
  reportingDate: string;
  fetchPage: (startPosition: number) => Promise<unknown>;
}): Promise<OpenInvoiceDraft[]> {
  const collected: OpenInvoiceDraft[] = [];
  let start = 1;
  for (let page = 0; page < QBO_MAX_INVOICE_PAGES; page += 1) {
    const body = await params.fetchPage(start);
    const raws = invoicesFromQueryResponse(body);
    for (const raw of raws) {
      const parsed = openInvoiceFromQbo(raw, params.reportingDate);
      if (parsed) collected.push(parsed);
    }
    const next = nextInvoiceStartPosition(start, raws.length);
    if (next === null) return indexOpenInvoices(collected);
    start = next;
  }
  throw new Error("PAGINATION_LIMIT");
}

export function invoiceWritePayload(invoice: OpenInvoiceDraft): Record<string, string> {
  return {
    qbo_invoice_id: invoice.qboInvoiceId,
    doc_number: invoice.docNumber ?? "",
    customer_name: invoice.customerName ?? "",
    txn_date: invoice.txnDate ?? "",
    due_date: invoice.dueDate ?? "",
    total_amount: invoice.totalAmount === null ? "" : invoice.totalAmount.toFixed(2),
    remaining_balance: invoice.remainingBalance.toFixed(2),
    qbo_updated_at: invoice.qboUpdatedAt ?? "",
    voided: "false",
  };
}
