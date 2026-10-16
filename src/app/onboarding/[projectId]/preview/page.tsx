import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { CustomerPortalProvider } from "@/lib/customer-portal-context";
import { mapLiveProjectBundleToClient } from "@/lib/db/map-live-to-client";
import { loadProjectBundle } from "@/lib/db/project-detail.server";
import { isValidWorkspaceId } from "@/lib/customer-workspaces";
import { liveClientRoutes } from "@/lib/routes";
import { getPreviewRevisionLabel } from "@/lib/customer-portal-stage";

export default async function LiveProjectPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let bundle;
  try {
    bundle = await loadProjectBundle(projectId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "NOT_FOUND" || message === "FORBIDDEN") notFound();
    throw e;
  }

  const client = mapLiveProjectBundleToClient(bundle);
  const workspaceId = client.demoWorkspaceId?.trim() ?? "";

  if (!bundle.readyPreview || bundle.readyPreview.status !== "ready" || !isValidWorkspaceId(workspaceId)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-ink">Preview unavailable</h1>
        <p className="text-sm text-ink-muted">
          RavenView has not published a sample dashboard preview for this project yet.
        </p>
        <Link
          href={liveClientRoutes.onboarding(projectId)}
          className="text-sm font-semibold text-purple hover:underline"
        >
          ← Back to onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-purple-100 bg-purple-50/40 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">{client.company} · Sample preview</p>
            <p className="text-xs text-ink-muted">
              {getPreviewRevisionLabel(client)} · Figures are sample data, not live integrations.
            </p>
          </div>
          <Link
            href={liveClientRoutes.onboarding(projectId)}
            className="text-sm font-semibold text-purple hover:underline"
          >
            Back to onboarding
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl p-4">
        <CustomerPortalProvider forcedWorkspaceId={workspaceId}>
          <WorkspaceSampleDashboard
            changesRequestedNote={
              client.previewChangeRequest
                ? `Change request on file (${getPreviewRevisionLabel(client)}).`
                : undefined
            }
          />
        </CustomerPortalProvider>
      </div>
    </div>
  );
}
