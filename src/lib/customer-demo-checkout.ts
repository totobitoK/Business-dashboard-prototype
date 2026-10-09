import {
  canShowDepositPreview,
  getDepositAmount,
  getSetupBalanceRemaining,
  isDepositPaid,
  isFinalBalancePaid,
} from "./client-milestones";
import { isPreviewApprovedForCurrentRevision } from "./preview-review";
import type { Client } from "./types";

export type DemoCheckoutKind = "deposit" | "final-balance";

export type DemoCheckoutOffer =
  | {
      ok: true;
      kind: DemoCheckoutKind;
      amount: number;
      label: string;
      modalTitle: string;
    }
  | { ok: false; reason: string };

/** Outstanding deposit (50% target minus already recorded setup payments). */
export function getOutstandingDepositAmount(client: Client): number {
  if (client.setupFee <= 0) return 0;
  const target = getDepositAmount(client);
  return Math.max(0, Math.round((target - client.setupPaidAmount) * 100) / 100);
}

/**
 * Eligibility and amount for simulated customer checkout.
 * Re-read the client at submit time — do not trust stale closure amounts.
 */
export function getDemoCheckoutOffer(client: Client): DemoCheckoutOffer {
  if (client.setupFee <= 0) {
    return { ok: false, reason: "No setup fee on this account." };
  }
  if (isFinalBalancePaid(client)) {
    return { ok: false, reason: "Setup fee is already paid in full." };
  }

  if (!isDepositPaid(client)) {
    if (!canShowDepositPreview(client)) {
      return {
        ok: false,
        reason: "Deposit checkout opens after scope is confirmed.",
      };
    }
    const amount = getOutstandingDepositAmount(client);
    if (amount <= 0) {
      return { ok: false, reason: "Deposit target already met." };
    }
    return {
      ok: true,
      kind: "deposit",
      amount,
      label: `Pay deposit — ${formatUsd(amount)}`,
      modalTitle: "Pay setup deposit",
    };
  }

  if (!isPreviewApprovedForCurrentRevision(client)) {
    return {
      ok: false,
      reason:
        "Remaining setup balance is available after you approve the current preview revision.",
    };
  }

  const amount = getSetupBalanceRemaining(client);
  if (amount <= 0) {
    return { ok: false, reason: "No remaining setup balance." };
  }

  return {
    ok: true,
    kind: "final-balance",
    amount,
    label: `Complete setup payment — ${formatUsd(amount)}`,
    modalTitle: "Complete setup payment",
  };
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
