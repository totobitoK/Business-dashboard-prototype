export function parseOfflinePaymentAmount(
  input: string
): { ok: true; amount: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter an amount." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      error: "Use a positive amount with at most two decimal places.",
    };
  }
  const amount = Math.round(parseFloat(trimmed) * 100) / 100;
  if (amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  return { ok: true, amount };
}

export function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
