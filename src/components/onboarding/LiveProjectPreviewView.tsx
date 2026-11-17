"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDashboardComposition } from "@/components/customer/use-dashboard-composition";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
import { visibleDashboardSection } from "@/lib/dashboard-composition";
import { LiveSamplePreviewProvider } from "@/lib/live-sample-preview-context";
import { liveProjectPreviewBase } from "@/lib/live-preview-section-routes";
import { resolveDashboardSection } from "@/lib/dashboard-section-routes";

export function LiveProjectPreviewView({
  projectId,
  workspaceId,
  changesRequestedNote,
}: {
  projectId: string;
  workspaceId: string;
  changesRequestedNote?: string;
}) {
  const navigationBase = useMemo(() => liveProjectPreviewBase(projectId), [projectId]);

  return (
    <LiveSamplePreviewProvider workspaceId={workspaceId} navigationBase={navigationBase}>
      <LiveProjectPreviewBody changesRequestedNote={changesRequestedNote} />
    </LiveSamplePreviewProvider>
  );
}

function LiveProjectPreviewBody({
  changesRequestedNote,
}: {
  changesRequestedNote?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = resolveDashboardSection(pathname, searchParams);
  const section = visibleDashboardSection(requested, useDashboardComposition());
  const mode = section === "revenue" ? "revenue" : "overview";

  if (section === "schedule") return <WorkspaceScheduleDashboard />;
  return (
    <WorkspaceSampleDashboard mode={mode} changesRequestedNote={changesRequestedNote} />
  );
}
