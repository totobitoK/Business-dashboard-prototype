"use client";

import { useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useClientStore } from "@/lib/client-store";
import { getDepositAmount, getSetupBalanceRemaining } from "@/lib/client-milestones";
import { formatToolsList } from "@/lib/metrics";
import {
  hasCustomerAcceptedCurrentPublishedScope,
  hasPendingScopeChangeRequest,
  hasPublishedScopeForReview,
} from "@/lib/scope-acceptance";
import type { Client } from "@/lib/types";

export function ScopeAcceptancePanel({ client }: { client: Client }) {
  const { acceptCustomerScopePricing, requestCustomerScopeChanges } = useClientStore();
  const [changeNote, setChangeNote] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );

  if (!hasPublishedScopeForReview(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        RavenView is preparing your proposed scope, tools, and pricing. You will be
        able to accept here once it is published.
      </p>
    );
  }

  const deposit = getDepositAmount(client);
  const remaining = getSetupBalanceRemaining(client);
  const accepted = hasCustomerAcceptedCurrentPublishedScope(client);
  const pendingChange = hasPendingScopeChangeRequest(client);

  const sources = client.acceptedSourcesIn ?? [];
  const screens = client.acceptedScreens ?? [];

  return (
    <div className="mt-3 space-y-4">
      <div className="rounded-xl border border-purple-100 bg-white p-4 text-sm shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple">
          Proposed scope · revision {client.publishedScopeRevision}
        </p>
        {client.agreedScopeSummary && (
          <p className="mt-2 whitespace-pre-wrap text-ink">{client.agreedScopeSummary}</p>
        )}
        {client.dashboardScope && (
          <p className="mt-2 text-ink-muted whitespace-pre-wrap">{client.dashboardScope}</p>
        )}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-muted">Included tools</dt>
            <dd className="mt-0.5 text-ink">
              {sources.length > 0 ? sources.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Dashboard screens</dt>
            <dd className="mt-0.5 text-ink">
              {screens.length > 0 ? screens.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Setup fee</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              <CurrencyAmount amount={client.setupFee} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Deposit (50%)</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              <CurrencyAmount amount={deposit} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Remaining at launch</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              <CurrencyAmount amount={remaining} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Monthly service</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              <CurrencyAmount amount={client.monthlyFee} />/mo
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-subtle">
          Monthly billing starts when your dashboard goes live.
        </p>
        {client.onboardingSubmission?.selectedTools?.length ? (
          <p className="mt-2 text-xs text-ink-muted">
            Intake tools (requirements):{" "}
            {formatToolsList(client.onboardingSubmission.selectedTools)}
          </p>
        ) : null}
      </div>

      {accepted && (
        <p className="text-sm text-emerald-700">
          You accepted this scope on{" "}
          {client.scopeCustomerAcceptedAt
            ? new Date(client.scopeCustomerAcceptedAt).toLocaleDateString()
            : "record"}{" "}
          (revision {client.scopeCustomerAcceptedRevision}).
        </p>
      )}

      {pendingChange && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Change request sent — our team will follow up. You can accept a new revision
          when we publish an update.
        </p>
      )}

      {message && (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}

      {!accepted && !pendingChange && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
            onClick={() => {
              setMessage(null);
              const result = acceptCustomerScopePricing(client.id);
              if (!result.ok) {
                setMessage({
                  type: "error",
                  text: result.error ?? "Could not save acceptance on this device.",
                });
                return;
              }
              setMessage({ type: "success", text: "Scope & pricing accepted." });
            }}
          >
            Accept scope & pricing
          </button>
          <button
            type="button"
            className="rounded-lg border border-purple-100 px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
            onClick={() => setShowChangeForm((v) => !v)}
          >
            Request changes
          </button>
        </div>
      )}

      {showChangeForm && !pendingChange && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-muted">
            What should we change?
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-purple-100 px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
            onClick={() => {
              setMessage(null);
              const result = requestCustomerScopeChanges(client.id, changeNote);
              if (!result.ok) {
                setMessage({
                  type: "error",
                  text: result.error ?? "Could not save your request.",
                });
                return;
              }
              setShowChangeForm(false);
              setChangeNote("");
              setMessage({ type: "success", text: "Change request sent to RavenView." });
            }}
          >
            Send change request
          </button>
        </div>
      )}
    </div>
  );
}
