import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment } from "@/lib/types";

export interface LiveProjectPaymentRow {
  id: string;
  project_id: string;
  payment_date: string;
  amount: number;
  type: string;
  note: string | null;
  record_source: string;
  payment_method: string | null;
  method_reference: string | null;
  provider_name: string | null;
  external_transaction_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  replaces_payment_id: string | null;
  created_at: string;
}

export async function loadProjectPayments(
  supabase: SupabaseClient,
  projectId: string
): Promise<LiveProjectPaymentRow[]> {
  const { data, error } = await supabase
    .from("project_payments")
    .select(
      "id, project_id, payment_date, amount, type, note, record_source, payment_method, method_reference, provider_name, external_transaction_id, voided_at, void_reason, replaces_payment_id, created_at"
    )
    .eq("project_id", projectId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LiveProjectPaymentRow[];
}

export function mapLivePaymentsToClientPayments(rows: LiveProjectPaymentRow[]): Payment[] {
  return rows.map((row) => ({
    id: row.id,
    date: row.payment_date,
    amount: Number(row.amount),
    type: row.type as Payment["type"],
    note: row.void_reason
      ? `Voided: ${row.void_reason}${row.note ? ` — ${row.note}` : ""}`
      : row.note ?? undefined,
    recordSource: row.record_source as Payment["recordSource"],
    methodReference: row.method_reference ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    providerName: row.provider_name ?? undefined,
    externalTransactionId: row.external_transaction_id ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    replacesPaymentId: row.replaces_payment_id ?? undefined,
  }));
}

export function sumValidSetupPayments(rows: LiveProjectPaymentRow[]): number {
  return rows
    .filter((r) => r.type === "setup" && !r.voided_at)
    .reduce((sum, r) => sum + Number(r.amount), 0);
}
