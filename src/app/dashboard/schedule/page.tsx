"use client";

import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export default function DashboardSchedulePage() {
  const { workspace, client } = useCustomerPortal();

  if (!client || !workspace) {
    return (
      <p className="text-sm text-ink-muted">
        No workspace linked. Open the portal from admin with a valid workspace.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Schedule</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Calendar and upcoming visits — sample {workspace.label} data only.
        </p>
      </header>
      <WorkspaceScheduleDashboard />
    </div>
  );
}
