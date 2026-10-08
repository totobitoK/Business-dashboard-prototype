"use client";

import Link from "next/link";
import { useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { ProgressBar } from "@/components/ProgressBar";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import {
  CUSTOMER_PORTAL_STAGE_LABELS,
  getCustomerPortalProgress,
  getCustomerPortalStage,
} from "@/lib/customer-portal-stage";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { useClientStore } from "@/lib/client-store";
import {
  canShowDepositPreview,
  getDepositAmount,
  getMilestonesForPath,
  getSetupBalanceRemaining,
  isDepositPaid,
  isFinalBalancePaid,
  isMilestoneComplete,
  MILESTONE_LABELS,
} from "@/lib/client-milestones";
import { getDiscoverySchedulingUrl } from "@/lib/onboarding-config";
import { isScopePricingConfirmed } from "@/lib/onboarding";
import { clientRoutes, dashboardRoutes } from "@/lib/routes";
import type { Client } from "@/lib/types";

export function CustomerDashboardHome() {
  const { client, workspace } = useCustomerPortal();

  if (!client) {
    return (
      <p className="text-sm text-ink-muted">
        No CRM record linked to workspace {workspace.label}. Reset demo data in admin.
      </p>
    );
  }

  const stage = getCustomerPortalStage(client);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple">
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          {CUSTOMER_PORTAL_STAGE_LABELS[stage]}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Project stage is derived from your onboarding milestones — the same record
          your RavenView team sees in admin.
        </p>
      </div>

      {stage === "onboarding" && <OnboardingStage client={client} />}
      {stage === "scope-and-deposit" && <ScopeDepositStage client={client} />}
      {stage === "guided-connections" && <GuidedConnectionsStage client={client} />}
      {stage === "building" && <BuildingStage client={client} />}
      {stage === "preview-ready" && <PreviewReadyStage client={client} />}
      {(stage === "approved-balance-due" || stage === "approved-awaiting-launch") && (
        <ApprovedStage client={client} stage={stage} />
      )}
      {stage === "live" && <LiveStage client={client} />}
    </div>
  );
}

function MilestoneProgressCard({ client }: { client: Client }) {
  const { percent, completed, total } = getCustomerPortalProgress(client);
  const path = getMilestonesForPath(client);

  return (
    <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink">Project progress</p>
        <p className="text-sm text-ink-muted">
          {completed}/{total} milestones
        </p>
      </div>
      <div className="mt-3">
        <ProgressBar value={percent} />
      </div>
      <ul className="mt-4 space-y-1 text-sm text-ink">
        {path.map((m) => (
          <li key={m} className="flex items-center gap-2">
            <span aria-hidden>{isMilestoneComplete(client, m) ? "✓" : "○"}</span>
            {MILESTONE_LABELS[m]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OnboardingStage({ client }: { client: Client }) {
  const schedulingUrl = getDiscoverySchedulingUrl();
  const { percent } = getCustomerPortalProgress(client);

  return (
    <>
      <MilestoneProgressCard client={client} />
      <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-5">
        <p className="text-sm font-semibold text-ink">Next action</p>
        <p className="mt-2 text-sm text-ink">
          Complete the onboarding form so we can learn about your business, metrics,
          and tools.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={clientRoutes.onboarding(client.id)}
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
          >
            Continue onboarding
          </Link>
          <a
            href={schedulingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
          >
            Book a discovery call
          </a>
        </div>
        <p className="mt-3 text-xs text-ink-muted">{percent}% of milestones complete</p>
      </div>
    </>
  );
}

function ScopeDepositStage({ client }: { client: Client }) {
  const scopeConfirmed = isScopePricingConfirmed(client);
  const depositPaid = isDepositPaid(client);
  const schedulingUrl = getDiscoverySchedulingUrl();

  return (
    <>
      <MilestoneProgressCard client={client} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Agreed scope</h2>
          {scopeConfirmed ? (
            <>
              <p className="mt-2 text-sm text-ink">
                {client.agreedScopeSummary ??
                  client.dashboardScope ??
                  "Scope confirmed — details in your onboarding record."}
              </p>
              <p className="mt-3 text-sm text-ink">
                Setup fee: <CurrencyAmount amount={client.setupFee} className="font-semibold" />
                {" · "}
                Monthly: <CurrencyAmount amount={client.monthlyFee} className="font-semibold" />
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Awaiting scope and customized pricing confirmation after discovery.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Deposit</h2>
          {depositPaid ? (
            <p className="mt-2 text-sm text-ink">
              Deposit recorded — <CurrencyAmount amount={client.setupPaidAmount} /> applied
              toward setup.
            </p>
          ) : scopeConfirmed ? (
            <>
              <p className="mt-2 text-sm text-ink">
                Deposit due:{" "}
                <CurrencyAmount amount={getDepositAmount(client)} className="font-semibold" /> (50%
                of setup)
              </p>
              {canShowDepositPreview(client) && (
                <Link
                  href={clientRoutes.onboardingPayment(client.id)}
                  className="mt-4 inline-block rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
                >
                  Open payment preview
                </Link>
              )}
              <p className="mt-2 text-xs text-ink-muted">
                Payment preview only — no charge in this prototype.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Deposit unlocks after scope is confirmed.</p>
          )}
        </div>
      </div>
      {!scopeConfirmed && (
        <a
          href={schedulingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-semibold text-purple hover:text-purple-dark"
        >
          Book a discovery call →
        </a>
      )}
    </>
  );
}

function GuidedConnectionsStage({ client }: { client: Client }) {
  return (
    <>
      <MilestoneProgressCard client={client} />
      <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
        <h2 className="text-sm font-semibold text-ink">Tools in your scope</h2>
        <p className="mt-2 text-sm text-ink-muted">
          We complete setup together — you sign in directly with each provider. RavenView
          never asks for your account passwords.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          {(client.acceptedSourcesIn ?? []).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
        <Link
          href={dashboardRoutes.connections}
          className="mt-4 inline-block rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
        >
          View connections →
        </Link>
      </div>
    </>
  );
}

function BuildingStage({ client }: { client: Client }) {
  return (
    <>
      <MilestoneProgressCard client={client} />
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-5">
        <h2 className="text-lg font-semibold text-ink">Your dashboard is being built</h2>
        <p className="mt-2 text-sm text-ink">
          {client.buildStatusNote ??
            "We are configuring your agreed metrics and layout. You will receive a preview when it is ready for review."}
        </p>
        {client.previewChangeRequest && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
            Latest feedback received — our team is incorporating your notes.
          </p>
        )}
      </div>
    </>
  );
}

function PreviewReadyStage({ client }: { client: Client }) {
  const { submitCustomerPreviewFeedback, approveCustomerPreview } = useClientStore();
  const [feedback, setFeedback] = useState("");

  return (
    <>
      <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-5">
        <h2 className="text-lg font-semibold text-ink">Review your dashboard preview</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Sample figures below match your agreed scope. Approve when ready, or send change
          requests — approval does not charge you or go live automatically.
        </p>
      </div>
      <WorkspaceSampleDashboard />
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            submitCustomerPreviewFeedback(client.id, feedback);
            setFeedback("");
          }}
        >
          <label className="text-sm font-semibold text-ink" htmlFor="preview-feedback">
            Request changes
          </label>
          <textarea
            id="preview-feedback"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-2 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-ink"
            placeholder="Describe what you'd like adjusted…"
          />
          <button
            type="submit"
            className="mt-3 rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-ink hover:bg-purple-50"
          >
            Submit feedback
          </button>
        </form>
        <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink">Approve preview</p>
          <p className="mt-2 text-sm text-ink-muted">
            Confirms the layout direction. Your remaining setup balance will be due before
            launch.
          </p>
          <button
            type="button"
            onClick={() => approveCustomerPreview(client.id)}
            className="mt-4 rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
          >
            Approve preview
          </button>
        </div>
      </div>
    </>
  );
}

function ApprovedStage({
  client,
  stage,
}: {
  client: Client;
  stage: "approved-balance-due" | "approved-awaiting-launch";
}) {
  const remaining = getSetupBalanceRemaining(client);

  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
        <p className="text-sm font-semibold text-emerald-900">Preview approved</p>
        <p className="mt-2 text-sm text-ink">
          {stage === "approved-balance-due" ? (
            <>
              Remaining setup balance:{" "}
              <CurrencyAmount amount={remaining} className="font-semibold" />
            </>
          ) : (
            <>
              Setup balance paid. RavenView will launch your dashboard when final checks
              are complete — launch is an admin action in this prototype.
            </>
          )}
        </p>
        {stage === "approved-balance-due" && !isFinalBalancePaid(client) && (
          <Link
            href={clientRoutes.onboardingPayment(client.id)}
            className="mt-4 inline-block rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
          >
            Payment preview — remaining balance
          </Link>
        )}
      </div>
      <WorkspaceSampleDashboard />
    </>
  );
}

function LiveStage(_props: { client: Client }) {
  return (
    <>
      <div className="rounded-xl border-2 border-purple bg-purple-50/50 p-4">
        <p className="text-sm font-bold uppercase tracking-wide text-purple-dark">
          Demo data — not live integrations
        </p>
        <p className="mt-1 text-sm text-ink">
          Your account is active in this prototype. Figures remain sample-only until real
          connections ship in a later stage.
        </p>
      </div>
      <WorkspaceSampleDashboard />
    </>
  );
}
