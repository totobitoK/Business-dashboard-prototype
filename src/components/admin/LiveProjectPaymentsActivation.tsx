"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import {
  adminActivateProjectAction,
  adminGetActivationEligibilityAction,
  adminRecordSetupPaymentAction,
  adminVoidSetupPaymentAction,
} from "@/lib/actions/milestone3b-rpc";
import type { LiveClientProject, LiveProjectPayment } from "@/lib/db/live-types";
import { parseOfflinePaymentAmount, todayDateInputValue } from "@/lib/offline-payment-input";
import { newSetupPaymentOperationKey } from "@/lib/setup-payment-idempotency";
import type { AdminSetupPaymentSummary } from "@/lib/setup-payment-summary";

export function LiveProjectPaymentsActivation({
  project,
  payments,
  setupSummary,
}: {
  project: LiveClientProject;
  payments: LiveProjectPayment[];
  setupSummary?: AdminSetupPaymentSummary;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<{
    canActivate: boolean;
    blockedReasons: string[];
    alreadyActive: boolean;
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDateInputValue());
  const [method, setMethod] = useState("Check");
  const [reference, setReference] = useState("");
  const [paymentOpKey, setPaymentOpKey] = useState(() => newSetupPaymentOperationKey());

  const refreshEligibility = useCallback(() => {
    startTransition(async () => {
      const res = await adminGetActivationEligibilityAction(project.id);
      if (res.ok) {
        setEligibility({
          canActivate: res.canActivate,
          blockedReasons: res.blockedReasons,
          alreadyActive: res.alreadyActive,
        });
      }
    });
  }, [project.id]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  const obligation = setupSummary?.obligation;
  const feeConfirmed = obligation?.fee_confirmed === true;
  const fee = feeConfirmed ? (obligation?.setup_fee ?? 0) : null;
  const received = obligation?.received ?? 0;
  const remaining = feeConfirmed ? (obligation?.remaining ?? 0) : null;
  const over = feeConfirmed ? (obligation?.overpayment ?? 0) : null;
  const draftEstimate = setupSummary?.draft_setup_fee_estimate ?? null;

  function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = parseOfflinePaymentAmount(amount);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    const opKey = paymentOpKey;
    startTransition(async () => {
      const res = await adminRecordSetupPaymentAction({
        projectId: project.id,
        amount: parsed.amount,
        paymentDate,
        paymentMethod: method.trim(),
        methodReference: reference.trim() || undefined,
        idempotencyKey: opKey,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setPaymentOpKey(newSetupPaymentOperationKey());
      setMessage(res.idempotentReplay ? "Payment already recorded (idempotent)." : "Payment recorded.");
      setAmount("");
      refreshEligibility();
      window.location.reload();
    });
  }

  function activate() {
    setMessage(null);
    startTransition(async () => {
      const res = await adminActivateProjectAction(project.id);
      if (!res.ok) {
        setMessage(res.error);
        if (res.blockedReasons?.length) {
          setEligibility({
            canActivate: false,
            blockedReasons: res.blockedReasons,
            alreadyActive: false,
          });
        }
        return;
      }
      setMessage(res.alreadyActive ? "Project is already active." : "Project activated.");
      refreshEligibility();
      window.location.reload();
    });
  }

  function voidPayment(paymentId: string) {
    const reason = window.prompt("Reason for voiding this payment (required):");
    if (!reason?.trim()) return;
    startTransition(async () => {
      const res = await adminVoidSetupPaymentAction({
        paymentId,
        projectId: project.id,
        voidReason: reason.trim(),
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage("Payment voided.");
      refreshEligibility();
      window.location.reload();
    });
  }

  return (
    <section className="rounded-xl border border-black/10 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">Setup payments & activation</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Manual offline setup payments only (separate from future card/processor integration). The
        shared ledger reserves provider name and external transaction id for Stripe later. Recording
        payments or approving previews does not activate the project.
      </p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Published setup fee</dt>
          <dd className="font-semibold">
            {feeConfirmed && fee !== null ? (
              <CurrencyAmount amount={fee} />
            ) : (
              <span className="text-ink-muted">Awaiting scope publish</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Received</dt>
          <dd className="font-semibold">
            <CurrencyAmount amount={received} />
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Remaining</dt>
          <dd className="font-semibold">
            {feeConfirmed && remaining !== null ? (
              <CurrencyAmount amount={remaining} />
            ) : (
              <span className="text-ink-muted">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Overpayment</dt>
          <dd className="font-semibold">
            {feeConfirmed && over !== null ? (
              <CurrencyAmount amount={over} />
            ) : (
              <span className="text-ink-muted">—</span>
            )}
          </dd>
        </div>
      </dl>

      {draftEstimate !== null && !feeConfirmed ? (
        <p className="mt-2 text-sm text-amber-900">
          Unpublished admin draft estimate (not customer-visible):{" "}
          <CurrencyAmount amount={draftEstimate} className="inline font-semibold" />
        </p>
      ) : null}

      <h3 className="mt-4 text-sm font-semibold text-ink">Record manual payment</h3>
      <form onSubmit={recordPayment} className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink">Amount</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Payment date</span>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Method</span>
          <input
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Reference (optional)</span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Record setup payment
          </button>
        </div>
      </form>

      {payments.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/5 px-3 py-2"
            >
              <span>
                {p.payment_date} · <CurrencyAmount amount={Number(p.amount)} className="inline" /> ·{" "}
                {p.record_source === "online" && p.provider_name
                  ? `${p.provider_name}${p.external_transaction_id ? ` · ${p.external_transaction_id}` : ""}`
                  : `Manual · ${p.payment_method ?? "—"}`}
                {p.voided_at ? (
                  <span className="ml-2 text-amber-800">Voided: {p.void_reason}</span>
                ) : null}
              </span>
              {!p.voided_at && p.type === "setup" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => voidPayment(p.id)}
                  className="text-xs font-semibold text-amber-800 hover:underline"
                >
                  Void…
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold text-ink">Activation</h3>
        {project.status === "active" ? (
          <p className="mt-2 text-sm text-ink-muted">
            Active
            {project.activated_at
              ? ` since ${new Date(project.activated_at).toLocaleString()}`
              : ""}
            .
          </p>
        ) : (
          <>
            {eligibility && eligibility.blockedReasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {eligibility.blockedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={pending || (eligibility !== null && !eligibility.canActivate)}
              onClick={activate}
              className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Activate project
            </button>
          </>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-ink-muted">{message}</p> : null}
    </section>
  );
}
