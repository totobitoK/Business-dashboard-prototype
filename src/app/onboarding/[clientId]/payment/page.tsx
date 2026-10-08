"use client";

import { useParams } from "next/navigation";
import {
  ClientPageShell,
  PaymentPreview,
} from "@/components/onboarding/PaymentPreview";
import { useClientStore } from "@/lib/client-store";

export default function ClientPaymentPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { clients } = useClientStore();
  const client = clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <ClientPageShell>
        <p className="text-sm text-ink-muted">Client not found in demo data.</p>
      </ClientPageShell>
    );
  }

  return (
    <ClientPageShell client={client}>
      <PaymentPreview client={client} />
    </ClientPageShell>
  );
}
