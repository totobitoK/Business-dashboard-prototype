"use client";

import Link from "next/link";
import { CONNECTION_STATUS_LABELS } from "@/lib/client-milestones";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { dashboardRoutes } from "@/lib/routes";

function formatSync(iso?: string): string {
  if (!iso) return "Not synced yet (demo)";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerConnectionsPage() {
  const { client, workspace, workspaceId } = useCustomerPortal();

  if (!client || !workspace) {
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
          Status reflects guided setup progress in this demo — not live OAuth. No real
          provider account is linked in this prototype.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-5 text-sm text-ink">
          No connections listed yet. They appear when scope is confirmed in admin.
        </div>
      ) : (
        <ul className="space-y-4">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="rounded-xl border border-purple-100 bg-white px-4 py-4 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{conn.label}</p>
                  <p className="text-xs text-ink-muted">
                    Provider: {conn.provider ?? conn.label}
                  </p>
                </div>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-dark">
                  {CONNECTION_STATUS_LABELS[conn.demoStatus]}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-ink-muted">
                    Workspace ID
                  </dt>
                  <dd className="font-mono text-xs text-ink">{workspaceId}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-ink-muted">
                    External account (fictional)
                  </dt>
                  <dd className="font-mono text-xs text-ink">
                    {conn.externalAccountId ?? "— pending demo ID —"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-ink-muted">
                    Selected account
                  </dt>
                  <dd className="text-ink">
                    {conn.selectedAccountLabel ?? "Not selected in demo"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-ink-muted">
                    Access mode
                  </dt>
                  <dd className="text-ink">{conn.accessMode ?? "Read-only (display)"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-ink-muted">
                    Last successful sync (simulated)
                  </dt>
                  <dd className="text-ink">{formatSync(conn.lastSuccessfulSyncAt)}</dd>
                </div>
                {conn.demoStatus === "needs-attention" && conn.errorDetail && (
                  <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase text-amber-900">
                      Error (demo)
                    </dt>
                    <dd className="mt-1 text-sm text-ink">{conn.errorDetail}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted">
        Connection simulation controls live in the RavenView admin client profile — they
        never connect to real provider APIs here.
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
