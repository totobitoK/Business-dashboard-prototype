"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminPublishScopeAction,
  adminSaveScopeDraftAction,
  type AdminScopeDraftInput,
} from "@/lib/actions/milestone2-rpc";
import type { LiveAdminScopeDraft, LiveClientProject } from "@/lib/db/live-types";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatList(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

function seedFromProject(
  project: LiveClientProject,
  adminScopeDraft: LiveAdminScopeDraft | null | undefined
): AdminScopeDraftInput {
  const draft = adminScopeDraft?.scope_draft ?? {};
  return {
    company_name: project.company_name,
    contact_name: project.contact_name,
    email: project.email,
    phone: project.phone,
    website: project.website ?? "",
    setup_fee: Number(draft.setup_fee ?? project.setup_fee),
    monthly_fee: Number(draft.monthly_fee ?? project.monthly_fee),
    agreed_scope_summary: String(draft.agreed_scope_summary ?? ""),
    dashboard_scope: String(draft.dashboard_scope ?? project.dashboard_scope ?? ""),
    accepted_sources_in: (draft.accepted_sources_in as string[]) ?? [],
    accepted_screens: (draft.accepted_screens as string[]) ?? [],
  };
}

export function LiveProjectScopeEditor({
  project,
  adminScopeDraft,
}: {
  project: LiveClientProject;
  adminScopeDraft?: LiveAdminScopeDraft | null;
}) {
  const router = useRouter();
  const initial = useMemo(
    () => seedFromProject(project, adminScopeDraft),
    [project, adminScopeDraft]
  );
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sourcesText = formatList(draft.accepted_sources_in);
  const screensText = formatList(draft.accepted_screens);

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const contact = {
      company_name: draft.company_name,
      contact_name: draft.contact_name,
      email: draft.email,
      phone: draft.phone,
      website: draft.website,
    };
    const scopeDraft = {
      setup_fee: draft.setup_fee,
      monthly_fee: draft.monthly_fee,
      agreed_scope_summary: draft.agreed_scope_summary,
      dashboard_scope: draft.dashboard_scope,
      accepted_sources_in: draft.accepted_sources_in,
      accepted_screens: draft.accepted_screens,
    };
    const result = await adminSaveScopeDraftAction(project.id, contact, scopeDraft);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Draft saved.");
    setEditing(false);
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await adminPublishScopeAction(project.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Scope published for customer review.");
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Scope & contact</h2>
          <p className="text-sm text-ink-muted">
            Published revision: {project.published_revision || "none"} · Material draft gen:{" "}
            {adminScopeDraft?.material_generation ?? 0}
            {project.scope_pending_material_publish ? " · unpublished material changes" : ""}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            className="rounded-lg border border-purple-100 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-purple-50"
            onClick={() => {
              setDraft(seedFromProject(project, adminScopeDraft));
              setEditing(true);
              setMessage(null);
              setError(null);
            }}
          >
            Edit draft
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-purple px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-dark disabled:opacity-50"
              onClick={() => void saveDraft()}
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-purple-100 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-purple-50"
              onClick={() => {
                setDraft(initial);
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Company</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.company_name}
            onChange={(e) => setDraft((d) => ({ ...d, company_name: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Contact</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.contact_name}
            onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Email</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Phone</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Website</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.website}
            onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Setup fee</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.setup_fee}
            onChange={(e) =>
              setDraft((d) => ({ ...d, setup_fee: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink-muted">Monthly fee</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.monthly_fee}
            onChange={(e) =>
              setDraft((d) => ({ ...d, monthly_fee: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Agreed scope summary</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.agreed_scope_summary}
            onChange={(e) =>
              setDraft((d) => ({ ...d, agreed_scope_summary: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Dashboard scope</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={draft.dashboard_scope}
            onChange={(e) => setDraft((d) => ({ ...d, dashboard_scope: e.target.value }))}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Accepted sources (comma-separated)</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={sourcesText}
            onChange={(e) =>
              setDraft((d) => ({ ...d, accepted_sources_in: parseList(e.target.value) }))
            }
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Accepted screens (comma-separated)</span>
          <input
            className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2"
            disabled={!editing}
            value={screensText}
            onChange={(e) =>
              setDraft((d) => ({ ...d, accepted_screens: parseList(e.target.value) }))
            }
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark disabled:opacity-50"
        onClick={() => void publish()}
      >
        Publish scope for customer review
      </button>
      <p className="text-xs text-ink-muted">
        Publishing creates an immutable scope revision. Customers must accept again after material
        changes. Internal admin notes remain separate from customer change requests.
      </p>
    </div>
  );
}
