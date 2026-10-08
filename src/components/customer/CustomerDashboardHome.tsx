"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import {
  CustomerCompletePaymentButton,
  CustomerPaymentCompactSummary,
} from "@/components/customer/CustomerSetupPaymentPanel";
import { PortalPreviewReviewControls } from "@/components/customer/PortalPreviewReview";
import { WorkspaceSampleDashboard } from "@/components/customer/WorkspaceSampleDashboard";
import { getPortalJourneyBookends } from "@/lib/client-milestones";
import {
  CUSTOMER_PORTAL_STAGE_LABELS,
  getCustomerPortalProgress,
  getCustomerPortalStage,
  getPreviewRevisionLabel,
  showCustomerDashboardPreview,
} from "@/lib/customer-portal-stage";
import {
  getPortalCustomerBlockers,
  getPortalNextAction,
  getPortalNextStepMessage,
} from "@/lib/customer-portal-ui";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { getDiscoverySchedulingUrl } from "@/lib/onboarding-config";
import type { Client } from "@/lib/types";
import type { CustomerPortalStage } from "@/lib/customer-portal-stage";

export function CustomerDashboardHome() {
  const { client, workspace } = useCustomerPortal();

  if (!client || !workspace) {
    return (
      <p className="text-sm text-ink-muted">
        No CRM record linked to this workspace. Reset demo data in admin.
      </p>
    );
  }

  const stage = getCustomerPortalStage(client);
  const schedulingUrl = getDiscoverySchedulingUrl();
  const next = getPortalNextAction(client, stage);
  const nextStep = getPortalNextStepMessage(client, stage);
  const blockers = getPortalCustomerBlockers(client, stage);

  const primaryHref =
    next.primaryExternalHref === "discovery-scheduling"
      ? schedulingUrl
      : next.primaryHref;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple">
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          {CUSTOMER_PORTAL_STAGE_LABELS[stage]}
        </h1>
        {nextStep && (
          <p className="mt-2 max-w-2xl text-sm text-ink">{nextStep}</p>
        )}
      </header>

      {(blockers.length > 0 ||
        (!next.useInPagePrimary && next.primaryLabel && primaryHref)) && (
        <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/20 px-4 py-3 sm:px-5">
          {blockers.length > 0 && (
            <ul className="space-y-1 text-sm text-ink">
              {blockers.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-amber-700" aria-hidden>
                    •
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}
          {!next.useInPagePrimary && next.primaryLabel && primaryHref && (
            <div>
              {next.primaryExternalHref === "discovery-scheduling" ? (
                <a
                  href={primaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
                >
                  {next.primaryLabel}
                </a>
              ) : (
                <Link
                  href={primaryHref}
                  className="inline-block rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
                >
                  {next.primaryLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <PortalDashboardSection client={client} stage={stage} next={next} />

      <section
        aria-labelledby="portal-snapshot-heading"
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft">
          <h2
            id="portal-snapshot-heading"
            className="text-sm font-semibold text-ink"
          >
            Progress
          </h2>
          <PortalProgressSummary client={client} />
        </div>
        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Payment status</h2>
          <div className="mt-3">
            <CustomerPaymentCompactSummary client={client} />
            <CustomerCompletePaymentButton client={client} />
          </div>
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Connections and layout preferences are under{" "}
        <Link href="/dashboard/connections" className="font-semibold text-purple">
          Connections
        </Link>{" "}
        and{" "}
        <Link href="/dashboard/settings" className="font-semibold text-purple">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}

function PortalProgressSummary({ client }: { client: Client }) {
  const { percent, completed, total } = getCustomerPortalProgress(client);
  const isLive = client.status === "active";
  const { lastCompletedLabel, nextLabel } = getPortalJourneyBookends(client);
  const barValue = isLive ? 100 : percent;
  const countLabel = isLive
    ? "Launch complete"
    : `${completed} of ${total} milestones`;

  return (
    <div className="mt-2 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Most recently completed
          </p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {lastCompletedLabel ?? "None yet"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Next step
          </p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {nextLabel ?? "—"}
            {isLive && (
              <span className="font-normal text-ink-muted"> — complete</span>
            )}
          </p>
        </div>
      </div>
      <ProgressBar value={barValue} label={countLabel} />
    </div>
  );
}

function PortalDashboardSection({
  client,
  stage,
  next,
}: {
  client: Client;
  stage: CustomerPortalStage;
  next: ReturnType<typeof getPortalNextAction>;
}) {
  const showPreview = showCustomerDashboardPreview(client);
  const isReviewStage = stage === "preview-ready";

  return (
    <section aria-labelledby="portal-dashboard-heading" className="space-y-3">
      <div>
        <h2
          id="portal-dashboard-heading"
          className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
        >
          Your dashboard
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{next.description}</p>
      </div>

      {stage === "building" && !showPreview && (
        <p className="rounded-xl border border-purple-100 bg-white p-4 text-sm text-ink shadow-soft">
          {client.buildStatusNote ??
            "We are building your dashboard from the agreed scope. Preview will show here when ready."}
        </p>
      )}

      {!showPreview &&
        stage !== "building" &&
        stage !== "live" &&
        stage !== "approved-balance-due" &&
        stage !== "approved-awaiting-launch" && (
        <p className="rounded-xl border border-dashed border-purple-100 bg-purple-50/30 p-6 text-center text-sm text-ink-muted">
          Dashboard preview appears here during build and review.
        </p>
      )}

      {showPreview && (
        <WorkspaceSampleDashboard
          changesRequestedNote={
            client.previewChangeRequest
              ? `Change request on file (${getPreviewRevisionLabel(client)}).`
              : undefined
          }
        />
      )}

      {isReviewStage && <PortalPreviewReviewControls client={client} />}

      {stage === "live" && (
        <p className="text-xs text-ink-muted">
          Live in this demo — figures are sample data, not connected integrations.
        </p>
      )}
    </section>
  );
}
