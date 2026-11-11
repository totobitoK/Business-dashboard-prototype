"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import { resolveDashboardSection } from "@/lib/dashboard-section-routes";

/** Designed customer dashboard. Demo preview and the signed-in /dashboard route both render this. */
export function CustomerPortalDashboard({
  changesRequestedNote,
}: {
  changesRequestedNote?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = resolveDashboardSection(pathname, searchParams);

  if (section === "schedule") {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <WorkspaceScheduleDashboard />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceSampleDashboard
        mode={section === "revenue" ? "revenue" : "overview"}
        changesRequestedNote={changesRequestedNote}
      />
    </div>
  );
}
