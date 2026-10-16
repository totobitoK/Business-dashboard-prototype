import { notFound } from "next/navigation";
import { LiveOnboardingJourney } from "@/components/onboarding/LiveOnboardingJourney";
import {
  intakeDraftVersion,
  mapLiveProjectBundleToClient,
} from "@/lib/db/map-live-to-client";
import { loadProjectBundle } from "@/lib/db/project-detail.server";

export default async function LiveOnboardingProjectPage({
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
    if (message === "NOT_FOUND" || message === "FORBIDDEN") {
      notFound();
    }
    throw e;
  }

  const client = mapLiveProjectBundleToClient(bundle);
  const draftVersion = intakeDraftVersion(bundle);

  return (
    <LiveOnboardingJourney client={client} initialDraftVersion={draftVersion} />
  );
}
