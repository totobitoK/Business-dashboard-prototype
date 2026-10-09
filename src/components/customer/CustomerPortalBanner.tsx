"use client";

import { DashboardSelect } from "@/components/customer/dashboard-controls";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function CustomerPortalBanner() {
  const { workspaces, workspaceId, setWorkspaceId, workspaceInvalid, theme } =
    useCustomerPortal();

  const workspaceOptions = workspaces.map((w) => ({
    value: w.id,
    label: w.label,
  }));

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-ink sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold">Customer portal prototype</span>
          <span className="hidden sm:inline"> — </span>
          <span className="block text-ink sm:inline">
            Fictional data only. No real auth or company isolation.
          </span>
        </p>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink">
            Demo workspace
          </span>
          {workspaceInvalid ? (
            <DashboardSelect
              theme={theme}
              value=""
              aria-label="Select demo workspace"
              options={[{ value: "", label: "Invalid — choose workspace" }, ...workspaceOptions]}
              onChange={(id) => {
                if (id) setWorkspaceId(id);
              }}
              align="right"
            />
          ) : (
            <DashboardSelect
              theme={theme}
              value={workspaceId}
              aria-label="Select demo workspace"
              options={workspaceOptions}
              onChange={setWorkspaceId}
              align="right"
            />
          )}
        </div>
      </div>
    </div>
  );
}
