"use client";

import { CurrencyAmount } from "@/components/CurrencyAmount";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getAdminLaunchBlockerSummaries,
  getAdminNextRequiredAction,
  getAdminPreviewAlert,
} from "@/lib/admin-client-drawer";
import { buildCustomerPortalPreviewUrl } from "@/lib/customer-portal-context";
import {
  CUSTOMER_PORTAL_STAGE_LABELS,
  getCustomerPortalStage,
  getPreviewRevisionLabel,
} from "@/lib/customer-portal-stage";
import { getSetupBalanceRemaining } from "@/lib/client-milestones";
import { getWorkspaceForClientId } from "@/lib/customer-workspaces";
import type { Client } from "@/lib/types";

export function ManageDrawerOverview({ client }: { client: Client }) {
  const workspace = getWorkspaceForClientId(client.id);
  const stage = getCustomerPortalStage(client);
  const remaining = getSetupBalanceRemaining(client);
  const nextAction = getAdminNextRequiredAction(client);
  const blockers = getAdminLaunchBlockerSummaries(client);
  const preview = getAdminPreviewAlert(client);

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-navy">{client.company}</h3>
          <p className="text-sm text-navy-muted">{client.contactName}</p>
          <div className="mt-2">
            <StatusBadge status={client.status} />
          </div>
        </div>
        {workspace && (
          <a
            href={buildCustomerPortalPreviewUrl(workspace.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-purple hover:text-purple-dark"
          >
            Open customer portal ↗
          </a>
        )}
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-navy-muted">Customer stage</dt>
          <dd className="font-semibold text-navy">
            {CUSTOMER_PORTAL_STAGE_LABELS[stage]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Next required action</dt>
          <dd className="text-navy">{nextAction}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Setup paid / remaining</dt>
          <dd className="text-navy">
            <CurrencyAmount amount={client.setupPaidAmount} className="font-semibold" />
            {" · "}
            <CurrencyAmount amount={remaining} className="font-semibold" /> remaining
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-muted">Monthly fee</dt>
          <dd className="font-semibold text-navy">
            <CurrencyAmount amount={client.monthlyFee} /> /mo
          </dd>
        </div>
      </dl>

      {(blockers.length > 0 || preview.openFeedback || preview.changeRequest) && (
        <div className="mt-3 space-y-2">
          {blockers.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              <p className="font-semibold">Launch blockers</p>
              <ul className="mt-1 list-inside list-disc">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.openFeedback && (
            <p className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-navy">
              Unresolved customer preview feedback — resolve before launch.
            </p>
          )}
          {preview.changeRequest && (
            <p className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-navy">
              <span className="font-semibold">Open change request:</span>{" "}
              {preview.changeRequest.slice(0, 160)}
              {preview.changeRequest.length > 160 ? "…" : ""}
            </p>
          )}
        </div>
      )}

      <details className="mt-3 text-xs text-navy-muted">
        <summary className="cursor-pointer font-medium text-navy">
          Technical details
        </summary>
        <dl className="mt-2 space-y-1 font-mono text-[11px]">
          <div>Client ID: {client.id}</div>
          {workspace && <div>Workspace: {workspace.id}</div>}
          <div>
            Preview: {getPreviewRevisionLabel(client)}
            {preview.approved ? " · Approved" : " · Not approved"}
          </div>
        </dl>
      </details>
    </div>
  );
}
