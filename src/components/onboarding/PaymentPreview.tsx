"use client";

import Link from "next/link";
import {
  CustomerCompletePaymentButton,
  CustomerSetupPaymentPanel,
} from "@/components/customer/CustomerSetupPaymentPanel";
import { RavenViewWordmark } from "@/components/RavenViewWordmark";
import { branding } from "@/lib/branding";
import { canShowDepositPreview, canShowFinalPaymentPreview } from "@/lib/client-milestones";
import { canShowPaymentPreview } from "@/lib/onboarding";
import { clientRoutes } from "@/lib/routes";
import type { Client } from "@/lib/types";

export function PaymentPreview({ client }: { client: Client }) {
  const canPay = canShowPaymentPreview(client);
  const showDeposit = canShowDepositPreview(client);
  const showFinal = canShowFinalPaymentPreview(client);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-ink">Setup payments</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {client.company} — {branding.fullName}
      </p>

      {!canPay && !showDeposit && !showFinal ? (
        <div className="mt-6 rounded-xl border border-purple-100 bg-purple-50/40 p-5">
          <p className="text-sm text-ink">
            Your requirements are being reviewed. We&apos;ll confirm scope and
            pricing before setup payment details are available.
          </p>
          {client.onboardingPath === "full" && (
            <Link
              href={clientRoutes.onboarding(client.id)}
              className="mt-3 inline-block text-sm font-medium text-purple hover:text-purple-dark"
            >
              ← Back to onboarding
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <CustomerSetupPaymentPanel
            client={client}
            mode={showFinal && !showDeposit ? "final-balance" : "deposit"}
          />
          <CustomerCompletePaymentButton client={client} />
          {client.onboardingPath === "full" && (
            <Link
              href={clientRoutes.onboarding(client.id)}
              className="inline-block text-sm font-medium text-purple hover:text-purple-dark"
            >
              ← Back to onboarding
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function ClientPageShell({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: Client;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-purple-100 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <RavenViewWordmark size="md" />
          {client && (
            <span className="text-xs text-ink-muted">{client.company}</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
