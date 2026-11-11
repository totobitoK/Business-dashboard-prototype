"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import { resolveDashboardSection } from "@/lib/dashboard-section-routes";

/** Restored customer dashboard. Demo preview and signed-in routes share this layout. */
export function CustomerPortalDashboard({
  liveSnapshot = null,
  changesRequestedNote,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = resolveDashboardSection(pathname, searchParams);

  if (section === "schedule") {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <WorkspaceScheduleDashboard liveSnapshot={liveSnapshot} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceSampleDashboard
        mode={section === "revenue" ? "revenue" : "overview"}
        changesRequestedNote={changesRequestedNote}
        liveSnapshot={liveSnapshot}
      />
    </div>
  );
}
