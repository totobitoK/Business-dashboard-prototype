import { EASTERN_TIME_ZONE } from "@/lib/company-time-zone";
import { SQUARE_MAX_PAGES } from "./config";

const LOCATION_ID = /^[A-Za-z0-9]{1,64}$/;
const SQUARE_ID = /^[A-Za-z0-9_-]{1,192}$/;
const CURRENCY = /^[A-Z]{3}$/;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SquarePage<T> = { items: T[]; cursor: string | null };

export async function collectPages<T>(
  fetchPage: (cursor: string | null) => Promise<SquarePage<T>>
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < SQUARE_MAX_PAGES; page += 1) {
    const body = await fetchPage(cursor);
    items.push(...body.items);
    if (!body.cursor) return items;
    if (body.cursor === cursor) throw new Error("CURSOR_STUCK");
    cursor = body.cursor;
  }
  throw new Error("PAGINATION_LIMIT");
}

export type SquareMoney = { amount?: number; currency?: string };

export type SquarePaymentPayload = {
  id?: string;
  status?: string;
  created_at?: string;
  location_id?: string;
  amount_money?: SquareMoney;
  source_type?: string;
};

export type SquareRefundPayload = {
  id?: string;
  status?: string;
  created_at?: string;
  location_id?: string;
  payment_id?: string;
  amount_money?: SquareMoney;
  destination_type?: string;
};

export type ImportedSquareTransaction = {
  kind: "payment" | "refund";
  squareId: string;
  locationId: string;
  createdAt: string;
  reportingDate: string;
  currency: string;
  amountMinor: number;
  sourceType: string | null;
};

export function civilDateInTimeZone(iso: string, timeZone: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  let zone = timeZone;
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(instant);
  } catch {
    zone = EASTERN_TIME_ZONE;
  }
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return CIVIL_DATE.test(formatted) ? formatted : null;
}

function moneyOf(money: SquareMoney | undefined): { amountMinor: number; currency: string } | null {
  if (!money || typeof money.amount !== "number" || !Number.isSafeInteger(money.amount)) return null;
  if (money.amount <= 0) return null;
  const currency = money.currency ?? "";
  if (!CURRENCY.test(currency)) return null;
  return { amountMinor: money.amount, currency };
}

function baseFields(input: {
  id: string | undefined;
  status: string | undefined;
  createdAt: string | undefined;
  locationId: string | undefined;
  money: SquareMoney | undefined;
  timeZone: string;
  selectedLocationIds: ReadonlySet<string>;
}): Omit<ImportedSquareTransaction, "kind" | "sourceType"> | null {
  if (input.status !== "COMPLETED") return null;
  if (!input.id || !SQUARE_ID.test(input.id)) return null;
  if (!input.locationId || !LOCATION_ID.test(input.locationId)) return null;
  if (!input.selectedLocationIds.has(input.locationId)) return null;
  if (!input.createdAt) return null;
  const reportingDate = civilDateInTimeZone(input.createdAt, input.timeZone);
  if (!reportingDate) return null;
  const money = moneyOf(input.money);
  if (!money) return null;
  return {
    squareId: input.id,
    locationId: input.locationId,
    createdAt: input.createdAt,
    reportingDate,
    currency: money.currency,
    amountMinor: money.amountMinor,
  };
}

export function collectCompletedTransactions(input: {
  payments: SquarePaymentPayload[];
  refunds: SquareRefundPayload[];
  timeZone: string;
  selectedLocationIds: readonly string[];
}): ImportedSquareTransaction[] {
  const selected = new Set(input.selectedLocationIds);
  const byKey = new Map<string, ImportedSquareTransaction>();
  for (const payment of input.payments) {
    const fields = baseFields({
      id: payment.id,
      status: payment.status,
      createdAt: payment.created_at,
      locationId: payment.location_id,
      money: payment.amount_money,
      timeZone: input.timeZone,
      selectedLocationIds: selected,
    });
    if (!fields) continue;
    byKey.set(`payment:${fields.squareId}`, {
      ...fields,
      kind: "payment",
      sourceType: payment.source_type ?? null,
    });
  }
  for (const refund of input.refunds) {
    const fields = baseFields({
      id: refund.id,
      status: refund.status,
      createdAt: refund.created_at,
      locationId: refund.location_id,
      money: refund.amount_money,
      timeZone: input.timeZone,
      selectedLocationIds: selected,
    });
    if (!fields) continue;
    byKey.set(`refund:${fields.squareId}`, {
      ...fields,
      kind: "refund",
      sourceType: refund.destination_type ?? null,
    });
  }
  return [...byKey.values()];
}
