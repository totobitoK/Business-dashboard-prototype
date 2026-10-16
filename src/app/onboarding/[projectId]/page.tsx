import { notFound } from "next/navigation";
import { LiveOnboardingGoogleCalendarSection } from "@/components/onboarding/LiveOnboardingGoogleCalendarSection";
import { LiveOnboardingJourney } from "@/components/onboarding/LiveOnboardingJourney";
import {
  intakeDraftVersion,
  mapLiveProjectBundleToClient,
} from "@/lib/db/map-live-to-client";
import { loadProjectBundle } from "@/lib/db/project-detail.server";

export default async function LiveOnboardingProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;

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
  const companyId = bundle.project.company_id;

  return (
    <LiveOnboardingJourney
      client={client}
      initialDraftVersion={draftVersion}
      googleCalendarSection={
        <LiveOnboardingGoogleCalendarSection
          companyId={companyId}
          flashCode={sp.google ?? null}
        />
      }
    />
  );
}
