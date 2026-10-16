export type SetupPaymentObligation = {
  fee_confirmed: boolean;
  setup_fee: number | null;
  received: number;
  remaining: number | null;
  overpayment: number | null;
  fully_paid: boolean;
};

export type AdminSetupPaymentSummary = {
  obligation: SetupPaymentObligation;
  draft_setup_fee_estimate: number | null;
};

export function parseSetupPaymentObligation(raw: unknown): SetupPaymentObligation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.received !== "number" && typeof row.received !== "string") return null;
  return {
    fee_confirmed: row.fee_confirmed === true,
    setup_fee:
      row.setup_fee === null || row.setup_fee === undefined
        ? null
        : Number(row.setup_fee),
    received: Number(row.received),
    remaining:
      row.remaining === null || row.remaining === undefined
        ? null
        : Number(row.remaining),
    overpayment:
      row.overpayment === null || row.overpayment === undefined
        ? null
        : Number(row.overpayment),
    fully_paid: row.fully_paid === true,
  };
}

export function parseAdminSetupPaymentSummary(raw: unknown): AdminSetupPaymentSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const obligation = parseSetupPaymentObligation(row.obligation);
  if (!obligation) return null;
  const draft = row.draft_setup_fee_estimate;
  return {
    obligation,
    draft_setup_fee_estimate:
      draft === null || draft === undefined ? null : Number(draft),
  };
}
