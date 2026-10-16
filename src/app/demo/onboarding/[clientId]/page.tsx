"use client";

import { useParams } from "next/navigation";
import { ClientOnboardingJourney } from "@/components/onboarding/ClientOnboardingJourney";
import { ClientPageShell } from "@/components/onboarding/PaymentPreview";
import { useClientStore } from "@/lib/client-store";

export default function ClientOnboardingPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { clients } = useClientStore();
  const client = clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <ClientPageShell>
        <p className="text-sm text-ink-muted">
          Client not found. This demo saves clients in this browser only — not
          on other devices. No sign-in email was sent.
        </p>
      </ClientPageShell>
    );
  }

  return (
    <ClientPageShell client={client}>
      <ClientOnboardingJourney client={client} />
    </ClientPageShell>
  );
}
