"use client";

import { useCustomerPortal } from "@/lib/customer-portal-context";

export function CustomerPortalBanner() {
  const { workspaces, workspaceId, setWorkspaceId, workspaceInvalid } =
    useCustomerPortal();

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-ink sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold">Customer portal prototype</span>
          <span className="hidden sm:inline"> — </span>
          <span className="block sm:inline text-ink">
            Fictional data only. No real auth or company isolation.
          </span>
        </p>
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink">
            Demo workspace
          </span>
          <select
            value={workspaceInvalid ? "" : workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="max-w-[14rem] rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm font-medium text-ink"
            aria-label="Select demo workspace"
          >
            {workspaceInvalid && (
              <option value="">Invalid — choose workspace</option>
            )}
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
