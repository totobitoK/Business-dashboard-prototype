"use client";

import { CountUpReplay } from "@/components/customer/CountUpFigure";
import { useDashboardComposition } from "@/components/customer/use-dashboard-composition";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import {
  DashboardSectionProvider,
  useDashboardSection,
} from "@/components/customer/dashboard-section-context";
import { visibleDashboardSection } from "@/lib/dashboard-composition";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";

/** Shared customer dashboard. A live snapshot means connector data; otherwise the page uses sample records. */
function CustomerPortalDashboardView({
  liveSnapshot = null,
  changesRequestedNote,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  const requested = useDashboardSection()?.section ?? "overview";
  const section = visibleDashboardSection(requested, useDashboardComposition(liveSnapshot));

  return (
    <CountUpReplay replayKey={section}>
      {section === "schedule" ? (
        <div className="flex min-h-full flex-1 flex-col">
          <WorkspaceScheduleDashboard liveSnapshot={liveSnapshot} />
        </div>
      ) : (
        <div className="flex min-h-full flex-1 flex-col">
          <WorkspaceSampleDashboard
            mode={section === "revenue" ? "revenue" : "overview"}
            changesRequestedNote={changesRequestedNote}
            liveSnapshot={liveSnapshot}
          />
        </div>
      )}
    </CountUpReplay>
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
