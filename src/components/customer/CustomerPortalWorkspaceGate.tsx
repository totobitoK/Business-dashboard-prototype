"use client";

import type { ReactNode } from "react";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function CustomerPortalWorkspaceGate({ children }: { children: ReactNode }) {
  const { workspaceInvalid, workspace } = useCustomerPortal();

  if (workspaceInvalid || !workspace) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-ink">
        <p className="font-semibold text-ink">Unknown demo workspace</p>
        <p className="mt-2 text-ink-muted">
          This link or saved selection does not match a demo company. Choose a workspace
          from the banner above, or open a valid preview link from admin.
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Demo workspace selection is not secure authorization — it only picks which
          fictional company to display locally.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
