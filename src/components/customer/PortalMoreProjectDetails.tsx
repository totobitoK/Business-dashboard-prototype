"use client";

import Link from "next/link";
import { CustomerContactSummary } from "@/components/customer/CustomerContactSummary";
import {
  CustomerPaymentCompactSummary,
  CustomerPaymentHistoryList,
} from "@/components/customer/CustomerSetupPaymentPanel";
import { PortalAccordion } from "@/components/customer/PortalAccordion";
import { getCustomerPortalProgress } from "@/lib/customer-portal-stage";
import { guidedSetupStatusLabel, paymentOneLineSummary } from "@/lib/customer-portal-ui";
import {
  getMilestonesForPath,
  isMilestoneComplete,
  MILESTONE_LABELS,
} from "@/lib/client-milestones";
import { isScopePricingConfirmed } from "@/lib/onboarding";
import { clientRoutes, dashboardRoutes } from "@/lib/routes";
import type { Client } from "@/lib/types";
import type { CustomerPortalStage } from "@/lib/customer-portal-stage";

export function PortalMoreProjectDetails({
  client,
  stage,
  schedulingUrl,
  defaultOpen = false,
}: {
  client: Client;
  stage: CustomerPortalStage;
  schedulingUrl: string;
  defaultOpen?: boolean;
}) {
  const path = getMilestonesForPath(client);
  const scopeConfirmed = isScopePricingConfirmed(client);
  const scopeSummary =
    client.agreedScopeSummary ??
    client.dashboardScope ??
    "Scope will appear after confirmation.";
  const { completed, total } = getCustomerPortalProgress(client);

  return (
    <PortalAccordion
      title="More project details"
      summary={`Progress ${completed}/${total} · ${paymentOneLineSummary(client).split("·").pop()?.trim() ?? "Payments"}`}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-ink">Project progress</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink">
            {path.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span aria-hidden>{isMilestoneComplete(client, m) ? "✓" : "○"}</span>
                {MILESTONE_LABELS[m]}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Agreed scope</h3>
          {scopeConfirmed ? (
            <>
              <p className="mt-2 text-sm text-ink">{scopeSummary}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Confirmed with RavenView — use preview feedback to request scope changes.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Awaiting confirmation after discovery.{" "}
              <a
                href={schedulingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-purple"
              >
                Book a call
              </a>
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Guided setup</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Status: {guidedSetupStatusLabel(client)}
          </p>
          <Link
            href={dashboardRoutes.connections}
            className="mt-2 inline-block text-sm font-semibold text-purple hover:text-purple-dark"
          >
            View connections →
          </Link>
        </div>

        <div id="portal-payments">
          <h3 className="text-sm font-semibold text-ink">Payment details</h3>
          <div className="mt-2">
            <CustomerPaymentCompactSummary client={client} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Payment history
          </p>
          <div className="mt-2">
            <CustomerPaymentHistoryList client={client} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Dashboard requirements</h3>
          <DashboardRequirementsReadOnly client={client} stage={stage} />
        </div>

        <CustomerContactSummary client={client} embedded />
      </div>
    </PortalAccordion>
  );
}

function DashboardRequirementsReadOnly({
  client,
  stage,
}: {
  client: Client;
  stage: CustomerPortalStage;
}) {
  const sub = client.onboardingSubmission;

  return (
    <div className="mt-2 space-y-4 text-sm text-ink">
      {sub ? (
        <>
          <div>
            <p className="text-xs font-semibold uppercase text-ink-muted">Business</p>
            <p className="mt-1">{sub.businessDescription}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-ink-muted">Dashboard goals</p>
            <p className="mt-1">{sub.dashboardGoals}</p>
          </div>
        </>
      ) : (
        <p className="text-ink-muted">
          <Link href={clientRoutes.onboarding(client.id)} className="font-semibold text-purple">
            Complete onboarding
          </Link>{" "}
          to add requirements.
        </p>
      )}
      {(client.acceptedSourcesIn?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-ink-muted">Confirmed sources</p>
          <ul className="mt-1 list-inside list-disc">
            {client.acceptedSourcesIn!.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {stage === "preview-ready" && (
        <p className="text-xs text-ink-muted">
          Requirement changes after scope confirmation go through Request changes above.
        </p>
      )}
    </div>
  );
}
