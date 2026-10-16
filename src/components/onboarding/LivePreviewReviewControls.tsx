"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  customerApprovePreviewAction,
  customerSubmitPreviewFeedbackAction,
} from "@/lib/actions/milestone3a-rpc";
import { getPreviewRevisionLabel } from "@/lib/customer-portal-stage";
import { hasUnresolvedPreviewFeedback, isPreviewApprovedForCurrentRevision } from "@/lib/preview-review";
import type { Client } from "@/lib/types";

export function LivePreviewReviewControls({ client }: { client: Client }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSaved, setApproveSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewId = client.previewRevisionRowId;
  const previewConfigured = Boolean(client.demoWorkspaceId?.trim());
  const approved = isPreviewApprovedForCurrentRevision(client);

  if (!previewId || !previewConfigured) {
    return (
      <div className="rounded-xl border border-dashed border-purple-100 bg-purple-50/40 p-4 text-sm text-ink-muted">
        Dashboard preview is not available yet. RavenView will notify you when a sample
        preview is ready for review.
      </div>
    );
  }

  if (approved) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
        <p className="font-semibold text-emerald-900">Preview approved</p>
        <p className="text-emerald-900">
          Thank you — your approval is recorded for {getPreviewRevisionLabel(client)}.
          Billing and launch are not enabled in this milestone; RavenView will follow up
          when those steps are available.
        </p>
      </div>
    );
  }

  const canApprove =
    previewConfigured &&
    !hasUnresolvedPreviewFeedback(client) &&
    !client.previewChangeRequest;

  return (
    <div className="space-y-4 rounded-xl border border-purple-100 bg-white p-4 shadow-soft sm:p-5">
      <p className="text-sm font-semibold text-ink">
        Preview review · {getPreviewRevisionLabel(client)}
      </p>
      {hasUnresolvedPreviewFeedback(client) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
          You requested changes on this preview. RavenView is reviewing your feedback — approve
          only after a revised preview is published.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFeedbackError(null);
            setFeedbackSent(false);
            setBusy(true);
            void customerSubmitPreviewFeedbackAction(client.id, previewId, feedback).then(
              (result) => {
                setBusy(false);
                if (!result.ok) {
                  setFeedbackError(result.error);
                  return;
                }
                setFeedback("");
                setFeedbackSent(true);
                router.refresh();
              }
            );
          }}
        >
          <label className="text-sm font-semibold text-ink" htmlFor="live-preview-feedback">
            Request changes
          </label>
          <textarea
            id="live-preview-feedback"
            rows={4}
            value={feedback}
            disabled={busy}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-2 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-ink"
            placeholder="Describe what you'd like adjusted…"
          />
          {feedbackError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {feedbackError}
            </p>
          ) : null}
          {feedbackSent ? (
            <p className="mt-2 text-sm text-emerald-800" role="status">
              Feedback saved. Approval is paused until RavenView publishes a revised preview.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50 disabled:opacity-50"
          >
            Submit feedback
          </button>
        </form>
        <div>
          <p className="text-sm font-semibold text-ink">Approve preview</p>
          <p className="mt-2 text-sm text-ink-muted">
            Confirms the layout direction. Does not record payment or launch your dashboard.
          </p>
          {approveError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {approveError}
            </p>
          ) : null}
          {approveSaved ? (
            <p className="mt-2 text-sm text-emerald-800" role="status">
              Preview approval saved.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !canApprove}
            onClick={() => {
              setApproveError(null);
              setApproveSaved(false);
              setBusy(true);
              void customerApprovePreviewAction(client.id, previewId).then((result) => {
                setBusy(false);
                if (!result.ok) {
                  setApproveError(result.error);
                  return;
                }
                setApproveSaved(true);
                router.refresh();
              });
            }}
            className="mt-4 rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark disabled:opacity-50"
          >
            Approve preview
          </button>
          {!canApprove && !hasUnresolvedPreviewFeedback(client) && client.previewChangeRequest ? (
            <p className="mt-2 text-xs text-ink-muted">
              Resolve outstanding feedback before approving.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
