"use client";

import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export default function DashboardRevenuePage() {
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
        <h1 className="text-2xl font-semibold text-ink">Revenue</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Collections, open invoices, and aging — sample {workspace.label} data only.
        </p>
      </header>
      <WorkspaceSampleDashboard mode="revenue" />
    </div>
  );
}
