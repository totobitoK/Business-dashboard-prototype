"use client";

import { useState } from "react";
import { useClientStore } from "@/lib/client-store";
import { getPreviewRevisionLabel } from "@/lib/customer-portal-stage";
import { hasUnresolvedPreviewFeedback } from "@/lib/preview-review";
import type { Client } from "@/lib/types";

export function PortalPreviewReviewControls({ client }: { client: Client }) {
  const { submitCustomerPreviewFeedback, approveCustomerPreview } = useClientStore();
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSaved, setApproveSaved] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-purple-100 bg-white p-4 shadow-soft sm:p-5">
      <p className="text-sm font-semibold text-ink">
        Preview review · {getPreviewRevisionLabel(client)}
      </p>
      {hasUnresolvedPreviewFeedback(client) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
          You requested changes on an earlier version. Approve only after RavenView marks a
          revised preview ready.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFeedbackError(null);
            setFeedbackSent(false);
            const ok = submitCustomerPreviewFeedback(client.id, feedback);
            if (!ok) {
              setFeedbackError("Please describe the changes you need before submitting.");
              return;
            }
            setFeedback("");
            setFeedbackSent(true);
          }}
        >
          <label className="text-sm font-semibold text-ink" htmlFor="preview-feedback">
            Request changes
          </label>
          <textarea
            id="preview-feedback"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-2 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-ink"
            placeholder="Describe what you'd like adjusted…"
          />
          {feedbackError && (
            <p className="mt-2 text-sm text-amber-800" role="alert">
              {feedbackError}
            </p>
          )}
          {feedbackSent && (
            <p className="mt-2 text-sm text-emerald-800" role="status">
              Feedback saved. Preview approval was cleared — launch stays blocked until you
              approve a revised version.
            </p>
          )}
          <button
            type="submit"
            className="mt-3 rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
          >
            Submit feedback
          </button>
        </form>
        <div>
          <p className="text-sm font-semibold text-ink">Approve preview</p>
          <p className="mt-2 text-sm text-ink-muted">
            Confirms the layout direction. Does not record payment or launch your dashboard.
          </p>
          {approveError && (
            <p className="mt-2 text-sm text-amber-800" role="alert">
              {approveError}
            </p>
          )}
          {approveSaved && (
            <p className="mt-2 text-sm text-emerald-800" role="status">
              Preview approval saved.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setApproveError(null);
              setApproveSaved(false);
              const result = approveCustomerPreview(client.id);
              if (!result.ok) {
                setApproveError(
                  result.error ?? "Could not save approval. Refresh and try again."
                );
                return;
              }
              setApproveSaved(true);
            }}
            className="mt-4 rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
          >
            Approve preview
          </button>
        </div>
      </div>
    </div>
  );
}
