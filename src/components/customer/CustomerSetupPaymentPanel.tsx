"use client";

import { useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useClientStore } from "@/lib/client-store";
import {
  getDepositAmount,
  getSetupBalanceRemaining,
  isDepositPaid,
  isFinalBalancePaid,
} from "@/lib/client-milestones";
import type { Client } from "@/lib/types";

export type CustomerPaymentPanelMode = "deposit" | "final-balance" | "auto";

function setupPaymentLines(client: Client) {
  return client.payments.filter((p) => p.type === "setup" || p.type === "refund");
}

export function CustomerPaymentHistoryList({ client }: { client: Client }) {
  const lines = setupPaymentLines(client);
  if (lines.length === 0) {
    return <p className="text-sm text-ink-muted">No setup payments recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-purple-50 rounded-lg border border-purple-50">
      {lines.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between px-3 py-2 text-sm"
        >
          <span className="text-ink">
            {new Date(p.date).toLocaleDateString()}
            {p.note ? ` — ${p.note}` : ""}
          </span>
          <CurrencyAmount
            amount={p.amount}
            prefix={p.type === "refund" ? "−" : ""}
            className="font-medium"
          />
        </li>
      ))}
    </ul>
  );
}

/** Compact summary for portal home; use accordion for history. */
export function CustomerPaymentCompactSummary({
  client,
  mode = "auto",
  showDemoNotice = true,
}: {
  client: Client;
  mode?: CustomerPaymentPanelMode;
  showDemoNotice?: boolean;
}) {
  const depositDue = getDepositAmount(client);
  const remaining = getSetupBalanceRemaining(client);
  const depositPaid = isDepositPaid(client);
  const fullyPaid = isFinalBalancePaid(client);
  const resolvedMode: Exclude<CustomerPaymentPanelMode, "auto"> =
    mode === "auto"
      ? !depositPaid && client.setupFee > 0
        ? "deposit"
        : "final-balance"
      : mode;

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-ink-muted">Setup fee</dt>
        <dd className="font-semibold text-ink">
          <CurrencyAmount amount={client.setupFee} />
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted">Recorded toward setup</dt>
        <dd className="font-semibold text-ink">
          <CurrencyAmount amount={client.setupPaidAmount} />
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted">Remaining balance</dt>
        <dd className="font-semibold text-ink">
          <CurrencyAmount amount={remaining} />
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted">Monthly subscription</dt>
        <dd className="font-semibold text-ink">
          <CurrencyAmount amount={client.monthlyFee} />
          <span className="text-xs font-normal text-ink-muted"> /mo at launch</span>
        </dd>
      </div>
      {resolvedMode === "deposit" && !depositPaid && client.setupFee > 0 && (
        <div className="sm:col-span-2">
          <dt className="text-ink-muted">Deposit due (50%)</dt>
          <dd className="font-semibold text-ink">
            <CurrencyAmount amount={depositDue} />
          </dd>
        </div>
      )}
      {fullyPaid && (
        <p className="sm:col-span-2 text-sm font-medium text-emerald-800">
          Setup fee paid in full.
        </p>
      )}
      {showDemoNotice && !fullyPaid && (
        <p className="sm:col-span-2 rounded-lg border border-dashed border-purple-200 bg-purple-50/40 px-3 py-2 text-sm text-ink">
          Checkout below simulates a card payment for this prototype. RavenView can also
          record payments received offline on your account.
        </p>
      )}
    </dl>
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function CustomerDemoCheckoutModal({
  open,
  onClose,
  client,
  amount,
  paymentLabel,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  amount: number;
  paymentLabel: string;
}) {
  const { addPayment } = useClientStore();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  function handleClose() {
    if (submitting) return;
    setDone(false);
    onClose();
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = addPayment(client.id, amount, "setup", {
      recordSource: "online",
      note: "Demo checkout",
    });
    setSubmitting(false);
    if (result.ok) {
      setDone(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-ink/30"
        aria-label="Close checkout"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-checkout-title"
        className="fixed inset-x-4 top-[10vh] z-50 mx-auto w-full max-w-md rounded-xl border border-purple-100 bg-white shadow-card sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="border-b border-purple-100 px-5 py-4">
          <h2 id="demo-checkout-title" className="text-lg font-semibold text-ink">
            {paymentLabel}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Simulated checkout — no real charge.
          </p>
        </div>
        {done ? (
          <div className="space-y-4 px-5 py-6">
            <p className="text-sm font-medium text-emerald-800">
              Payment recorded for {formatUsd(amount)}. Your portal will update
              automatically.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-dark"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-4 px-5 py-5">
            <p className="text-2xl font-semibold text-ink">{formatUsd(amount)}</p>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-ink-muted">Card number</span>
                <input
                  readOnly
                  value="4242 4242 4242 4242"
                  className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/30 px-3 py-2 text-sm text-ink"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-ink-muted">Expiry</span>
                  <input
                    readOnly
                    value="12 / 34"
                    className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/30 px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">CVC</span>
                  <input
                    readOnly
                    value="123"
                    className="mt-1 w-full rounded-lg border border-purple-100 bg-purple-50/30 px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 rounded-lg border border-purple-100 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-purple-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-dark disabled:opacity-50"
              >
                {submitting ? "Processing…" : `Pay ${formatUsd(amount)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export function CustomerCompletePaymentButton({ client }: { client: Client }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (client.setupFee <= 0 || isFinalBalancePaid(client)) {
    return null;
  }

  const depositPaid = isDepositPaid(client);
  const depositDue = getDepositAmount(client);
  const remaining = getSetupBalanceRemaining(client);
  const amount = !depositPaid ? depositDue : remaining;
  const label = !depositPaid
    ? `Pay deposit — ${formatUsd(amount)}`
    : `Complete setup payment — ${formatUsd(amount)}`;
  const modalTitle = !depositPaid ? "Pay setup deposit" : "Complete setup payment";

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setCheckoutOpen(true)}
        className="w-full rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-dark"
      >
        {label}
      </button>
      <CustomerDemoCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        client={client}
        amount={amount}
        paymentLabel={modalTitle}
      />
    </div>
  );
}

export function CustomerSetupPaymentPanel({
  client,
  mode = "auto",
}: {
  client: Client;
  mode?: CustomerPaymentPanelMode;
}) {
  const depositPaid = isDepositPaid(client);

  const resolvedMode: Exclude<CustomerPaymentPanelMode, "auto"> =
    mode === "auto"
      ? !depositPaid && client.setupFee > 0
        ? "deposit"
        : "final-balance"
      : mode;

  return (
    <div className="space-y-4 rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-sm font-semibold text-ink">Setup fee & payments</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Amounts below reflect what RavenView has recorded for your project — not live
          checkout.
        </p>
      </div>
      <CustomerPaymentCompactSummary client={client} mode={resolvedMode} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Payment history (recorded by RavenView)
        </p>
        <div className="mt-2">
          <CustomerPaymentHistoryList client={client} />
        </div>
      </div>
    </div>
  );
}
