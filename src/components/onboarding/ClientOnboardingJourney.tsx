"use client";

import { useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import {
  CustomerCompletePaymentButton,
  CustomerPaymentCompactSummary,
  CustomerPaymentHistoryList,
  CustomerSetupPaymentPanel,
} from "@/components/customer/CustomerSetupPaymentPanel";
import { getOutstandingDepositAmount } from "@/lib/customer-demo-checkout";
import { ClientOnboardingForm } from "@/components/onboarding/ClientOnboardingForm";
import { ScopeAcceptancePanel } from "@/components/onboarding/ScopeAcceptancePanel";
import {
  canShowDepositPreview,
  canShowFinalPaymentPreview,
  canShowGuidedDataSetup,
  CONNECTION_STATUS_LABELS,
  getClientPhases,
  getDepositAmount,
  getPhaseState,
  getSetupBalanceRemaining,
  isDepositPaid,
  isFinalBalancePaid,
  isMilestoneComplete,
  isZeroSetupFee,
  MILESTONE_LABELS,
} from "@/lib/client-milestones";
import {
  getCurrentOnboardingTask,
  getOnboardingJourneyBlockers,
  getOnboardingProgressSummary,
} from "@/lib/onboarding-journey";
import {
  getAgreedScopeToolLabels,
  getOutstandingCustomerRequests,
} from "@/lib/onboarding-handoff";
import {
  getDiscoverySchedulingUrl,
  getGuidedSetupSchedulingUrl,
} from "@/lib/onboarding-config";
import { formatToolsList } from "@/lib/metrics";
import { hasCustomerAcceptedCurrentPublishedScope } from "@/lib/scope-acceptance";
import type { Client } from "@/lib/types";

export function ClientOnboardingJourney({ client }: { client: Client }) {
  const schedulingUrl = getDiscoverySchedulingUrl();
  const progress = getOnboardingProgressSummary(client);
  const blockers = getOnboardingJourneyBlockers(client);
  const currentTask = getCurrentOnboardingTask(client);
  const phases = getClientPhases(client);

  const [allStepsOpen, setAllStepsOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => new Set());

  const intakeDone = isMilestoneComplete(client, "intake");

  function toggleStep(key: string) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Your onboarding</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {client.company} · RavenView
        </p>
      </div>

      <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Progress</p>
          <p className="text-sm text-ink-muted">{progress.label}</p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-purple-50"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-purple transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {intakeDone &&
        !isMilestoneComplete(client, "discovery") &&
        schedulingUrl &&
        currentTask?.phaseKey !== "discovery" && (
          <a
            href={schedulingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-purple-200 bg-purple-50/50 px-4 py-3 text-sm font-semibold text-purple hover:bg-purple-50"
          >
            Book your discovery call ↗
          </a>
        )}

      {blockers.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
          {blockers.map((b) => (
            <li key={b.id} className="flex gap-2">
              <span aria-hidden>•</span>
              {b.message}
            </li>
          ))}
        </ul>
      )}

      {currentTask && (
        <section className="rounded-xl border border-purple bg-purple-50/30 p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple">
            Current step
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{currentTask.title}</h2>
          <p className="mt-2 text-sm text-ink-muted">{currentTask.description}</p>
          {currentTask.customerAction && (
            <p className="mt-3 text-sm font-medium text-ink">
              Your action: {currentTask.customerAction}
            </p>
          )}
          {currentTask.ravenViewAction && (
            <p className="mt-2 text-sm text-ink-muted">
              RavenView: {currentTask.ravenViewAction}
            </p>
          )}

          {intakeDone && currentTask.phaseKey === "discovery" && schedulingUrl && (
            <a
              href={schedulingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-dark"
            >
              Book your discovery call ↗
            </a>
          )}

          {currentTask.phaseKey === "intake" && client.onboardingPath === "full" && (
            <div className="mt-4">
              <ClientOnboardingForm client={client} embedded />
            </div>
          )}

          {currentTask.phaseKey === "scope" && (
            <ScopeAcceptancePanel client={client} />
          )}

          {currentTask.phaseKey === "deposit" && canShowDepositPreview(client) && (
            <DepositPhase client={client} />
          )}

          {currentTask.phaseKey === "guided" && (
            <GuidedSetupPhase client={client} prominentSchedule />
          )}

          {currentTask.phaseKey === "build" && (
            <BuildPhase client={client} />
          )}

          {currentTask.phaseKey === "launch" && (
            <FinalLaunchPhase client={client} />
          )}
        </section>
      )}

      {intakeDone && client.onboardingSubmission && (
        <details
          className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft"
          open={answersOpen}
          onToggle={(e) => setAnswersOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Submitted answers
          </summary>
          <SubmittedAnswersSummary client={client} />
        </details>
      )}

      {(client.serviceName || client.dashboardScope || client.agreedScopeSummary) && (
        <details
          className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft"
          open={projectOpen}
          onToggle={(e) => setProjectOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Project details from RavenView
          </summary>
          <dl className="mt-3 space-y-2 text-sm">
            {client.serviceName && (
              <div>
                <dt className="text-xs text-ink-muted">Service</dt>
                <dd>{client.serviceName}</dd>
              </div>
            )}
            {client.dashboardScope && (
              <div>
                <dt className="text-xs text-ink-muted">Dashboard scope</dt>
                <dd className="whitespace-pre-wrap">{client.dashboardScope}</dd>
              </div>
            )}
            {client.agreedScopeSummary && (
              <div>
                <dt className="text-xs text-ink-muted">Agreed scope</dt>
                <dd className="whitespace-pre-wrap">{client.agreedScopeSummary}</dd>
              </div>
            )}
          </dl>
        </details>
      )}

      <details
        className="rounded-xl border border-purple-100 bg-white shadow-soft"
        open={allStepsOpen}
        onToggle={(e) => setAllStepsOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          View all steps
        </summary>
        <ol className="space-y-2 border-t border-purple-50 px-4 py-3">
          {phases.map((phase) => {
            const state = getPhaseState(client, phase.milestone);
            const isOpen = openSteps.has(phase.key);
            return (
              <li
                key={phase.key}
                className={`rounded-lg border px-3 py-2 ${
                  state === "current"
                    ? "border-purple-200 bg-purple-50/40"
                    : "border-purple-50 bg-white"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => toggleStep(phase.key)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-ink">
                    {MILESTONE_LABELS[phase.milestone]} — {phase.title}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {state === "complete" ? "Done" : state === "current" ? "Now" : "Later"}
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-2 border-t border-purple-50 pt-2">
                    <StepDetail
                      client={client}
                      phaseKey={phase.key}
                      schedulingUrl={schedulingUrl}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}

function StepDetail({
  client,
  phaseKey,
  schedulingUrl,
}: {
  client: Client;
  phaseKey: string;
  schedulingUrl: string;
}) {
  switch (phaseKey) {
    case "intake":
      if (client.onboardingPath === "payment-only") {
        return (
          <p className="text-sm text-ink-muted">
            Payment-only onboarding — no intake form required.
          </p>
        );
      }
      if (isMilestoneComplete(client, "intake")) {
        return (
          <p className="text-sm text-ink-muted">
            Intake submitted. Expand &quot;Submitted answers&quot; above to review.
          </p>
        );
      }
      return <ClientOnboardingForm client={client} embedded />;
    case "discovery":
      return (
        <DiscoverySnippet
          client={client}
          schedulingUrl={schedulingUrl}
          prominent={false}
        />
      );
    case "scope":
      return <ScopeAcceptancePanel client={client} />;
    case "deposit":
      return <DepositPhase client={client} />;
    case "guided":
      return <GuidedSetupPhase client={client} />;
    case "build":
      return <BuildPhase client={client} />;
    case "launch":
      return <FinalLaunchPhase client={client} />;
    default:
      return null;
  }
}

function SubmittedAnswersSummary({ client }: { client: Client }) {
  const sub = client.onboardingSubmission;
  if (!sub) return null;
  return (
    <dl className="mt-3 space-y-2 text-sm text-ink">
      <div>
        <dt className="text-xs text-ink-muted">Company</dt>
        <dd>{sub.company}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Dashboard goals</dt>
        <dd>{sub.dashboardGoals}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-muted">Tools</dt>
        <dd>{formatToolsList(sub.selectedTools)}</dd>
      </div>
    </dl>
  );
}

function DiscoverySnippet({
  client,
  schedulingUrl,
  prominent,
}: {
  client: Client;
  schedulingUrl: string;
  prominent?: boolean;
}) {
  if (isMilestoneComplete(client, "discovery")) {
    return <p className="text-sm text-emerald-700">Discovery complete.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-muted">
        Review goals and plan your dashboard with RavenView.
      </p>
      {schedulingUrl ? (
        <a
          href={schedulingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-dark ${
            prominent ? "text-base" : ""
          }`}
        >
          Schedule your discovery call ↗
        </a>
      ) : (
        <p className="text-sm text-ink">We&apos;ll contact you to arrange your call.</p>
      )}
    </div>
  );
}

function BuildPhase({ client }: { client: Client }) {
  const guidedDone = isMilestoneComplete(client, "guided-data-setup");
  const outstanding = getOutstandingCustomerRequests(client);

  if (!guidedDone) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        We&apos;ll start your dashboard build after guided setup is complete.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-3 text-sm">
      <p className="font-semibold text-ink">We&apos;re building your dashboard.</p>
      {client.buildStatusNote ? (
        <p className="text-ink-muted">{client.buildStatusNote}</p>
      ) : (
        <p className="text-ink-muted">
          RavenView will post an update here when your preview is ready.
        </p>
      )}

      {outstanding.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Outstanding from you
          </p>
          <ul className="mt-1 list-inside list-disc text-amber-950">
            {outstanding.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {(client.dashboardPreviewUrl || client.dashboardUrl) && (
        <a
          href={client.dashboardPreviewUrl ?? client.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex font-medium text-purple hover:text-purple-dark"
        >
          Open dashboard preview ↗
        </a>
      )}

      <CompletedGuidedSetupDetails client={client} defaultOpen={false} />
    </div>
  );
}

function DepositPhase({ client }: { client: Client }) {
  if (!canShowDepositPreview(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        {!hasCustomerAcceptedCurrentPublishedScope(client)
          ? "Accept scope & pricing before the deposit is available."
          : "Deposit will be available after scope is confirmed."}
      </p>
    );
  }

  const depositTarget = getDepositAmount(client);
  const outstandingDeposit = getOutstandingDepositAmount(client);
  const zeroFee = isZeroSetupFee(client);
  const depositPaid = isDepositPaid(client);
  const tools = getAgreedScopeToolLabels(client);

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-lg border border-purple-100 bg-white p-4 text-sm">
        <CustomerPaymentCompactSummary client={client} mode="deposit" />
        {!zeroFee && !depositPaid && (
          <div className="mt-3 border-t border-purple-50 pt-3">
            <div className="flex justify-between font-semibold text-ink">
              <span>Outstanding deposit</span>
              <CurrencyAmount amount={outstandingDeposit} />
            </div>
            {client.setupPaidAmount > 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Partial payment recorded —{" "}
                <CurrencyAmount amount={client.setupPaidAmount} className="inline" /> toward{" "}
                <CurrencyAmount amount={depositTarget} className="inline" /> deposit target (
                50% of setup).
              </p>
            )}
          </div>
        )}
        {zeroFee && (
          <p className="mt-3 border-t border-purple-50 pt-3 text-sm font-medium text-emerald-800">
            No setup deposit is required for your project ($0 agreed setup fee).
          </p>
        )}
      </div>

      <p className="text-sm text-ink-muted">
        After your deposit is received, we&apos;ll help you connect the tools included
        in your scope
        {tools.length > 0 ? `: ${tools.join(", ")}.` : "."}
      </p>

      {client.payments.some((p) => p.type === "setup" || p.type === "refund") && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Recorded payments
          </p>
          <div className="mt-1">
            <CustomerPaymentHistoryList client={client} />
          </div>
        </div>
      )}

      {depositPaid ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700">
            {zeroFee ? "Setup deposit requirement met." : "Deposit recorded — thank you."}
          </p>
          {canShowGuidedDataSetup(client) && (
            <GuidedSetupHandoffLink client={client} />
          )}
        </div>
      ) : !zeroFee ? (
        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Demo payment
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Simulated card checkout for this prototype — same rules as the full payment
            panel.
          </p>
          <CustomerCompletePaymentButton client={client} />
        </div>
      ) : (
        canShowGuidedDataSetup(client) && <GuidedSetupHandoffLink client={client} />
      )}
    </div>
  );
}

function GuidedSetupHandoffLink({ client }: { client: Client }) {
  const guidedUrl = getGuidedSetupSchedulingUrl();
  if (!canShowGuidedDataSetup(client)) return null;
  return (
    <p className="text-sm text-ink">
      Next:{" "}
      {guidedUrl ? (
        <a
          href={guidedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-purple hover:text-purple-dark"
        >
          Schedule guided setup ↗
        </a>
      ) : (
        <>We&apos;ll contact you to arrange guided setup.</>
      )}
    </p>
  );
}

function FinalLaunchPhase({ client }: { client: Client }) {
  const remaining = getSetupBalanceRemaining(client);

  if (!isDepositPaid(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Final payment is available after your deposit and dashboard review.
      </p>
    );
  }

  if (isFinalBalancePaid(client)) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-sm text-emerald-700">Setup balance paid in full.</p>
        {client.status === "active" ? (
          <p className="text-sm text-ink-muted">Your dashboard is live.</p>
        ) : (
          <p className="text-sm font-medium text-ink">Awaiting launch</p>
        )}
      </div>
    );
  }

  if (!canShowFinalPaymentPreview(client) && !isMilestoneComplete(client, "client-review")) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Remaining balance due after build and client review.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-lg border border-purple-100 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Remaining setup balance</span>
          <CurrencyAmount amount={remaining} />
        </div>
      </div>
      <CustomerSetupPaymentPanel client={client} mode="final-balance" />
    </div>
  );
}

const GUIDED_PREP_CHECKLIST = [
  "Have sign-in access to the tools included in your agreed scope.",
  "Know which business account, calendar, or spreadsheet you want to use.",
  "Bring any questions about the numbers you want to track.",
] as const;

function GuidedSetupPhase({
  client,
  prominentSchedule = false,
}: {
  client: Client;
  prominentSchedule?: boolean;
}) {
  const guidedDone = isMilestoneComplete(client, "guided-data-setup");
  const guidedUrl = getGuidedSetupSchedulingUrl();
  const tools = getAgreedScopeToolLabels(client);

  if (!canShowGuidedDataSetup(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Guided setup opens after your deposit is received and scope is confirmed.
      </p>
    );
  }

  if (guidedDone) {
    return (
      <div className="mt-2 space-y-2 text-sm">
        <p className="font-medium text-emerald-800">Guided setup marked complete.</p>
        <p className="text-ink-muted">
          RavenView is moving into your dashboard build — see Build & review for updates.
        </p>
        <CompletedGuidedSetupDetails client={client} defaultOpen={false} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {prominentSchedule &&
        (guidedUrl ? (
          <a
            href={guidedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-lg bg-purple px-4 py-3 text-sm font-semibold text-white hover:bg-purple-dark sm:w-auto sm:inline-flex"
          >
            Schedule guided setup ↗
          </a>
        ) : (
          <p className="rounded-lg border border-purple-100 bg-purple-50/40 px-4 py-3 text-sm text-ink">
            We&apos;ll contact you to arrange setup — no scheduling link is configured
            for this demo.
          </p>
        ))}

      {!prominentSchedule && guidedUrl && (
        <a
          href={guidedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
        >
          Schedule guided setup ↗
        </a>
      )}

      <div className="rounded-lg border border-purple-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple">
          Prepare for the call
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          {GUIDED_PREP_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Tools in your agreed scope</p>
        {tools.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">
            RavenView will list included tools once scope is published.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {tools.map((label) => (
              <li key={label} className="rounded-md border border-purple-50 px-3 py-2">
                {label}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-subtle">
          You sign in directly with each provider during the call. RavenView will
          never ask for your password, API keys, or access tokens in email or chat.
        </p>
      </div>
    </div>
  );
}

function CompletedGuidedSetupDetails({
  client,
  defaultOpen,
}: {
  client: Client;
  defaultOpen: boolean;
}) {
  const connections = client.guidedConnections ?? [];
  if (connections.length === 0) return null;

  return (
    <details className="rounded-lg border border-purple-100 bg-white/80 px-3 py-2" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Connection progress (demo)
      </summary>
      <ul className="mt-2 space-y-2 pb-1">
        {connections.map((conn) => (
          <li
            key={conn.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-purple-50 px-2 py-1.5 text-sm"
          >
            <span className="font-medium text-ink">{conn.label}</span>
            <span className="text-xs text-ink-muted">
              {CONNECTION_STATUS_LABELS[conn.demoStatus]} (demo)
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
