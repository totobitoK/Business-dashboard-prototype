"use client";

import { useMemo } from "react";
import { ClientOnboardingForm } from "@/components/onboarding/ClientOnboardingForm";
import { useClientStore } from "@/lib/client-store";
import { createDemoIntakeApi } from "@/lib/onboarding-intake-api";
import type { OnboardingIntakeApi } from "@/lib/onboarding-intake-api";
import type { Client } from "@/lib/types";

export function ClientOnboardingJourney({
  client,
  intakeApi,
}: {
  client: Client;
  intakeApi?: OnboardingIntakeApi;
}) {
  const store = useClientStore();
  const resolvedIntakeApi = useMemo(
    () => intakeApi ?? createDemoIntakeApi(store),
    [intakeApi, store]
  );

  return <ClientOnboardingForm client={client} intakeApi={resolvedIntakeApi} />;
}
