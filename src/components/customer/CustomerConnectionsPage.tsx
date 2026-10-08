"use client";

import Link from "next/link";
import { CONNECTION_STATUS_LABELS } from "@/lib/client-milestones";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { dashboardRoutes } from "@/lib/routes";

export function CustomerConnectionsPage() {
  const { client, workspace } = useCustomerPortal();

  if (!client) {
    return <p className="text-sm text-ink-muted">Workspace not linked to a client record.</p>;
  }

  const connections = client.guidedConnections ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple">
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Data connections</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Sources included in your confirmed scope. Status reflects guided setup progress
          in this demo — not live OAuth.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-5 text-sm text-ink">
          No connections listed yet. They appear when scope is confirmed in admin.
        </div>
      ) : (
        <ul className="space-y-3">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-100 bg-white px-4 py-4 shadow-soft"
            >
              <span className="font-semibold text-ink">{conn.label}</span>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-dark">
                {CONNECTION_STATUS_LABELS[conn.demoStatus]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted">
        You sign in with each provider directly during guided setup — RavenView does not
        collect your passwords.
      </p>

      <Link
        href={dashboardRoutes.home}
        className="inline-block text-sm font-semibold text-purple hover:text-purple-dark"
      >
        ← Back to home
      </Link>
    </div>
  );
}
