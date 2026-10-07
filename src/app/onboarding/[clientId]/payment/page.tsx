"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientPageShell } from "@/components/onboarding/PaymentPreview";
import { clientRoutes } from "@/lib/routes";
import { useClientStore } from "@/lib/client-store";

/** Legacy payment URL — redirects to phased onboarding journey. */
export default function ClientPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const { clients } = useClientStore();
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (client) router.replace(clientRoutes.onboarding(clientId));
  }, [client, clientId, router]);

  return (
    <ClientPageShell client={client}>
      <p className="text-sm text-ink-muted">Loading onboarding…</p>
    </ClientPageShell>
  );
}
