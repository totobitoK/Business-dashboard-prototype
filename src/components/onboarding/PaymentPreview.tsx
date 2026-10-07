"use client";

import Link from "next/link";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { RavenViewWordmark } from "@/components/RavenViewWordmark";
import { branding } from "@/lib/branding";
import { canShowPaymentPreview } from "@/lib/onboarding";
import { clientRoutes } from "@/lib/routes";
import type { Client } from "@/lib/types";

export function PaymentPreview({ client }: { client: Client }) {
  const canPay = canShowPaymentPreview(client);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-ink">Payment preview</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {client.company} — {branding.fullName}
      </p>

      {!canPay ? (
        <div className="mt-6 rounded-xl border border-purple-100 bg-purple-50/40 p-5">
          <p className="text-sm text-ink">
            Your requirements are being reviewed. We&apos;ll confirm scope and
            pricing before setup payment is available.
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
        <>
          <div className="mt-6 space-y-4 rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between border-b border-purple-50 pb-3">
              <span className="text-sm text-ink-muted">Setup fee</span>
              <CurrencyAmount amount={client.setupFee} className="text-lg" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Monthly subscription</span>
              <CurrencyAmount amount={client.monthlyFee} className="text-lg" />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-purple-200 bg-purple-50/30 px-4 py-3">
            <p className="text-sm font-medium text-ink">Checkout not connected</p>
            <p className="mt-1 text-xs text-ink-muted">
              No payment can be taken in this prototype. Real payment processing
              will be added in a future stage.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-lg bg-purple/40 px-4 py-2.5 text-sm font-medium text-white"
          >
            Pay setup fee — coming next
          </button>
        </>
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
