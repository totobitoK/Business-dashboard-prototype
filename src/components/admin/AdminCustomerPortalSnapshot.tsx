"use client";

import { CurrencyAmount } from "@/components/CurrencyAmount";
import {
  CUSTOMER_PORTAL_STAGE_LABELS,
  getCustomerPortalStage,
  getPreviewRevisionLabel,
} from "@/lib/customer-portal-stage";
import { buildCustomerPortalPreviewUrl } from "@/lib/customer-portal-context";
import { getWorkspaceForClientId } from "@/lib/customer-workspaces";
import { getSetupBalanceRemaining } from "@/lib/client-milestones";
import {
  getCurrentPreviewRevision,
  hasUnresolvedPreviewFeedback,
  isPreviewApprovedForCurrentRevision,
} from "@/lib/preview-review";
import type { Client } from "@/lib/types";

export function AdminCustomerPortalSnapshot({ client }: { client: Client }) {
  const workspace = getWorkspaceForClientId(client.id);
  const stage = getCustomerPortalStage(client);
  const remaining = getSetupBalanceRemaining(client);
  const rev = getCurrentPreviewRevision(client);
  const approved = isPreviewApprovedForCurrentRevision(client);

  const portalNotes = client.notes
    .filter(
      (n) =>
        /preview|customer portal|Customer preview|Customer approved|feedback/i.test(
          n.content
        )
    )
    .slice(0, 3);

  if (!workspace) {
    return (
      <div className="rounded-lg border border-baby-200 bg-baby-50/40 px-4 py-3 text-sm text-navy-muted">
        No demo customer portal workspace linked to this client.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-purple-dark">
          Customer portal (demo)
        </p>
        <a
          href={buildCustomerPortalPreviewUrl(workspace.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-purple hover:text-purple-dark"
        >
          Open portal preview ↗
        </a>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-navy-muted">Stage shown to customer</dt>
          <dd className="font-semibold text-navy">
            {CUSTOMER_PORTAL_STAGE_LABELS[stage]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Workspace</dt>
          <dd className="font-mono text-xs text-navy">{workspace.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Preview</dt>
          <dd className="text-navy">
            {getPreviewRevisionLabel(client)}
            {approved ? " · Approved" : " · Not approved"}
            {hasUnresolvedPreviewFeedback(client) ? " · Open feedback" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Setup recorded</dt>
          <dd className="text-navy">
            <CurrencyAmount amount={client.setupPaidAmount} className="font-semibold" />
            {" / "}
            <CurrencyAmount amount={client.setupFee} />
            {remaining > 0 && (
              <span className="text-navy-muted">
                {" "}
                (<CurrencyAmount amount={remaining} className="inline" /> remaining)
              </span>
            )}
          </dd>
        </div>
      </dl>
      {client.previewChangeRequest && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-xs text-navy">
          <span className="font-semibold">Open change request:</span>{" "}
          {client.previewChangeRequest.slice(0, 140)}
          {client.previewChangeRequest.length > 140 ? "…" : ""}
        </p>
      )}
      {portalNotes.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-purple-100 pt-2 text-xs text-navy-muted">
          {portalNotes.map((n) => (
            <li key={n.id}>
              {new Date(n.date).toLocaleDateString()} — {n.content.slice(0, 100)}
              {n.content.length > 100 ? "…" : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-navy-muted">
        Rev {rev} · Portal UI is simplified by stage; this panel reflects saved CRM data.
      </p>
    </div>
  );
}
