"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminPublishPreviewReadyAction,
  adminReopenBuildAction,
  adminUpdateBuildProgressAction,
} from "@/lib/actions/milestone3a-rpc";
import {
  CUSTOMER_DEMO_WORKSPACES,
} from "@/lib/customer-workspaces";
import type {
  LiveClientProject,
  LivePreviewRevision,
  LivePreviewRevisionApproval,
  LivePreviewRevisionFeedback,
  LiveProjectBuildProgress,
} from "@/lib/db/live-types";

function parseRequests(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function LiveProjectBuildPreviewEditor({
  project,
  buildProgress,
  readyPreview,
  readyPreviewFeedback,
  readyPreviewApproval,
  previewHistory,
}: {
  project: LiveClientProject;
  buildProgress?: LiveProjectBuildProgress | null;
  readyPreview?: LivePreviewRevision | null;
  readyPreviewFeedback?: LivePreviewRevisionFeedback | null;
  readyPreviewApproval?: LivePreviewRevisionApproval | null;
  previewHistory?: LivePreviewRevision[] | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [discovery, setDiscovery] = useState(Boolean(buildProgress?.discovery_completed_at));
  const [guided, setGuided] = useState(Boolean(buildProgress?.guided_setup_completed_at));
  const [building, setBuilding] = useState(buildProgress?.building_active ?? false);
  const [progressNote, setProgressNote] = useState(buildProgress?.customer_progress_note ?? "");
  const [requestsText, setRequestsText] = useState(
    (buildProgress?.outstanding_customer_requests ?? []).join("\n")
  );
  const [nextUpdate, setNextUpdate] = useState(buildProgress?.next_update_message ?? "");
  const [workspaceId, setWorkspaceId] = useState(
    readyPreview?.demo_workspace_id ?? CUSTOMER_DEMO_WORKSPACES[0]?.id ?? ""
  );

  async function saveBuild() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await adminUpdateBuildProgressAction(project.id, {
      discoveryComplete: discovery,
      guidedSetupComplete: guided,
      buildingActive: building,
      customerProgressNote: progressNote,
      outstandingCustomerRequests: parseRequests(requestsText),
      nextUpdateMessage: nextUpdate,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Build progress saved.");
    router.refresh();
  }

  async function publishPreview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await adminPublishPreviewReadyAction(project.id, workspaceId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Preview published for customer review.");
    router.refresh();
  }

  async function reopenBuild() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await adminReopenBuildAction(project.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Build reopened — prior preview approvals no longer apply.");
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">Build progress &amp; preview</h2>
        <p className="text-sm text-ink-muted">
          Customer-visible notes only — use project notes for internal commentary.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={discovery} onChange={(e) => setDiscovery(e.target.checked)} />
          Discovery complete
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
          Guided setup complete
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={building} onChange={(e) => setBuilding(e.target.checked)} />
          Build in progress
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-medium text-ink-muted">Customer progress note</span>
        <textarea
          rows={2}
          className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
          value={progressNote}
          onChange={(e) => setProgressNote(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="text-xs font-medium text-ink-muted">
          Outstanding customer requests (one per line)
        </span>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
          value={requestsText}
          onChange={(e) => setRequestsText(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="text-xs font-medium text-ink-muted">Next update message (optional)</span>
        <input
          className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
          value={nextUpdate}
          onChange={(e) => setNextUpdate(e.target.value)}
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => void saveBuild()}
        className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark disabled:opacity-50"
      >
        Save build progress
      </button>

      <div className="border-t border-purple-50 pt-4">
        <h3 className="text-sm font-semibold text-ink">Preview revision</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Ready preview:{" "}
          {readyPreview
            ? `#${readyPreview.preview_revision} · scope rev ${readyPreview.scope_revision} · ${readyPreview.status}`
            : "none"}
        </p>

        <label className="mt-3 block text-sm">
          <span className="text-xs font-medium text-ink-muted">Sample workspace mapping</span>
          <select
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {CUSTOMER_DEMO_WORKSPACES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} ({w.id})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publishPreview()}
            className="rounded-lg border border-purple bg-white px-4 py-2 text-sm font-semibold text-purple hover:bg-purple-50 disabled:opacity-50"
          >
            Mark preview ready for customer review
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reopenBuild()}
            className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            Reopen build (invalidate approval)
          </button>
        </div>
      </div>

      {(readyPreviewFeedback || readyPreviewApproval) && (
        <div className="rounded-lg border border-purple-50 bg-purple-50/30 p-3 text-sm">
          <p className="font-semibold text-ink">Current ready preview activity</p>
          {readyPreviewFeedback ? (
            <p className="mt-2 text-ink-muted">
              <span className="font-medium text-ink">Feedback: </span>
              {readyPreviewFeedback.feedback}
            </p>
          ) : null}
          {readyPreviewApproval ? (
            <p className="mt-2 text-emerald-800">
              Approved {new Date(readyPreviewApproval.approved_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      )}

      {previewHistory && previewHistory.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-ink">Preview revision history</summary>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {previewHistory.map((row) => (
              <li key={row.id}>
                #{row.preview_revision} · scope {row.scope_revision} · {row.status}
                {row.demo_workspace_id ? ` · ${row.demo_workspace_id}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
