"use client";

import { PageHeader } from "@/components/PageHeader";
import { PendingOnboardingList } from "@/components/PendingOnboardingList";
import { useClientStore } from "@/lib/client-store";
import { getPendingCount } from "@/lib/metrics";

export default function OnboardingPage() {
  const { clients } = useClientStore();
  const pendingCount = getPendingCount(clients);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Onboarding"
        description={`${pendingCount} client${pendingCount === 1 ? "" : "s"} working through onboarding.`}
      />
      <PendingOnboardingList />
    </div>
  );
}
