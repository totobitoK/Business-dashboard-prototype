"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { WorkspaceScheduleDashboard } from "@/components/customer/WorkspaceScheduleDashboard";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = resolveDashboardSection(pathname, searchParams);
  const mode = section === "revenue" ? "revenue" : "overview";
  const navigationBase = useMemo(() => liveProjectPreviewBase(projectId), [projectId]);

  return (
    <LiveSamplePreviewProvider workspaceId={workspaceId} navigationBase={navigationBase}>
      {section === "schedule" ? (
        <WorkspaceScheduleDashboard />
      ) : (
        <WorkspaceSampleDashboard mode={mode} changesRequestedNote={changesRequestedNote} />
      )}
    </LiveSamplePreviewProvider>
  );
}
