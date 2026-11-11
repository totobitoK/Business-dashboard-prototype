"use client";

import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import {
  DashboardSectionProvider,
  useDashboardSection,
} from "@/components/customer/dashboard-section-context";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";

/** Restored customer dashboard. Demo preview and signed-in routes share this layout. */
function CustomerPortalDashboardView({
  liveSnapshot = null,
  changesRequestedNote,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  const section = useDashboardSection()?.section ?? "overview";

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

export function CustomerPortalDashboard(props: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  return (
    <DashboardSectionProvider>
      <CustomerPortalDashboardView {...props} />
    </DashboardSectionProvider>
  );
}
