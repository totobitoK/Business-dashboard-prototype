"use client";

import { useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { useClientStore } from "@/lib/client-store";
import { getDepositAmount, getSetupBalanceRemaining } from "@/lib/client-milestones";
import { formatToolsList } from "@/lib/metrics";
import {
  getCustomerFacingScope,
  hasCustomerAcceptedCurrentPublishedScope,
  hasPendingScopeChangeRequest,
  hasPublishedScopeForReview,
  hasUnpublishedScopeDraftChanges,
  needsCustomerScopeAcceptance,
} from "@/lib/scope-acceptance";
import type { Client } from "@/lib/types";

export function ScopeAcceptancePanel({ client }: { client: Client }) {
  const { acceptCustomerScopePricing, requestCustomerScopeChanges } = useClientStore();
  const [changeNote, setChangeNote] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );

  const published = getCustomerFacingScope(client);
  const acceptanceRequired = needsCustomerScopeAcceptance(client);

  if (!hasPublishedScopeForReview(client) || !published) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        {acceptanceRequired
          ? "Customer acceptance required — RavenView will publish scope and pricing for your review."
          : "RavenView is preparing your proposed scope, tools, and pricing. You will be able to accept here once it is published."}
      </p>
    );
  }

  const deposit = getDepositAmount({ ...client, setupFee: published.setupFee });
  const remaining = getSetupBalanceRemaining({ ...client, setupFee: published.setupFee });
  const accepted = hasCustomerAcceptedCurrentPublishedScope(client);
  const pendingChange = hasPendingScopeChangeRequest(client);
  const draftPending = hasUnpublishedScopeDraftChanges(client);

  const sources = published.acceptedSourcesIn ?? [];
  const screens = published.acceptedScreens ?? [];

  return (
    <div className="mt-3 space-y-4">
      {client.scopeAcceptanceNeedsReview && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          RavenView is verifying scope acceptance records from an older demo migration.
          You may need to accept again before deposit.
        </p>
      )}

      {draftPending && (
        <p className="rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2 text-sm text-ink">
          RavenView is updating scope behind the scenes. What you see below is the last
          published revision — accept only after we publish an update.
        </p>
      )}

      <div className="rounded-xl border border-purple-100 bg-white p-4 text-sm shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple">
          Proposed scope · revision {published.revision}
        </p>
        {published.agreedScopeSummary && (
          <p className="mt-2 whitespace-pre-wrap text-ink">{published.agreedScopeSummary}</p>
        )}
        {published.dashboardScope && (
          <p className="mt-2 whitespace-pre-wrap text-ink-muted">{published.dashboardScope}</p>
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
              <CurrencyAmount amount={published.setupFee} />
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
              <CurrencyAmount amount={published.monthlyFee} />/mo
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

      {!accepted && !pendingChange && !draftPending && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
            onClick={() => {
              setMessage(null);
              const rev = client.publishedScopeRevision!;
              const result = acceptCustomerScopePricing(client.id, rev);
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
