"use client";

import { CurrencyAmount } from "@/components/CurrencyAmount";
import { CustomerSetupPaymentPanel } from "@/components/customer/CustomerSetupPaymentPanel";
import { ClientOnboardingForm } from "@/components/onboarding/ClientOnboardingForm";
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
} from "@/lib/client-milestones";
import { getDiscoverySchedulingUrl } from "@/lib/onboarding-config";
import { isScopePricingConfirmed } from "@/lib/onboarding";
import type { Client } from "@/lib/types";

export function ClientOnboardingJourney({ client }: { client: Client }) {
  const phases = getClientPhases(client);
  const schedulingUrl = getDiscoverySchedulingUrl();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Your onboarding</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Self-service intake, then guided setup with the {client.company} team
          at RavenView.
        </p>
      </div>

      <ol className="space-y-4">
        {phases.map((phase, index) => {
          const state = getPhaseState(client, phase.milestone);
          return (
            <li
              key={phase.key}
              className={`rounded-xl border p-5 ${
                state === "current"
                  ? "border-purple bg-purple-50/30 shadow-soft"
                  : state === "complete"
                    ? "border-purple-100 bg-white"
                    : "border-purple-50 bg-white/60 opacity-80"
              }`}
            >
              <div className="flex items-start gap-3">
                <PhaseNumber
                  n={index + 1}
                  state={state}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-ink">{phase.title}</h2>
                  <PhaseBody
                    client={client}
                    phaseKey={phase.key}
                    state={state}
                    schedulingUrl={schedulingUrl}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PhaseNumber({
  n,
  state,
}: {
  n: number;
  state: "complete" | "current" | "upcoming";
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        state === "complete"
          ? "bg-purple text-white"
          : state === "current"
            ? "border-2 border-purple bg-white text-purple"
            : "border border-purple-100 bg-white text-ink-subtle"
      }`}
    >
      {state === "complete" ? "✓" : n}
    </span>
  );
}

function PhaseBody({
  client,
  phaseKey,
  state,
  schedulingUrl,
}: {
  client: Client;
  phaseKey: string;
  state: "complete" | "current" | "upcoming";
  schedulingUrl: string;
}) {
  if (state === "upcoming" && phaseKey !== "intake") {
    return (
      <p className="mt-2 text-xs text-ink-subtle">
        Available after earlier steps are complete.
      </p>
    );
  }

  switch (phaseKey) {
    case "intake":
      if (isMilestoneComplete(client, "intake")) {
        return (
          <p className="mt-2 text-sm text-ink-muted">
            Intake submitted — thank you. Continue with your discovery call
            below.
          </p>
        );
      }
      return (
        <div className="mt-3">
          <ClientOnboardingForm client={client} embedded />
        </div>
      );

    case "discovery":
      return (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-ink-muted">
            Let&apos;s review your goals and plan your dashboard together.
          </p>
          {isMilestoneComplete(client, "discovery") ? (
            <p className="text-xs text-emerald-700">Discovery complete.</p>
          ) : schedulingUrl ? (
            <a
              href={schedulingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-dark"
            >
              Schedule your discovery call ↗
            </a>
          ) : (
            <p className="text-sm text-ink">
              We&apos;ll contact you to arrange your call.
            </p>
          )}
        </div>
      );

    case "scope":
      return (
        <div className="mt-2">
          {isScopePricingConfirmed(client) ? (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700">
                Scope and pricing confirmed. Your agreed setup fee is{" "}
                <CurrencyAmount amount={client.setupFee} /> with{" "}
                <CurrencyAmount amount={client.monthlyFee} />/month service at
                launch.
              </p>
              {client.agreedScopeSummary && (
                <p className="text-sm text-ink-muted">{client.agreedScopeSummary}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Awaiting scope confirmation</p>
          )}
        </div>
      );

    case "deposit":
      return (
        <DepositPhase client={client} />
      );

    case "guided":
      return (
        <GuidedSetupPhase client={client} />
      );

    case "build":
      return (
        <div className="mt-2 space-y-2">
          {isMilestoneComplete(client, "building") ? (
            <p className="text-sm text-ink-muted">Dashboard build in progress or complete.</p>
          ) : (
            <p className="text-sm text-ink-muted">
              We&apos;ll configure your dashboard after guided data setup.
            </p>
          )}
          {(client.dashboardPreviewUrl || client.dashboardUrl) && (
            <a
              href={client.dashboardPreviewUrl ?? client.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-purple hover:text-purple-dark"
            >
              Open dashboard preview ↗
            </a>
          )}
          {!client.dashboardPreviewUrl && !client.dashboardUrl && (
            <p className="text-xs text-ink-subtle">Preview link coming soon.</p>
          )}
        </div>
      );

    case "launch":
      return (
        <FinalLaunchPhase client={client} />
      );

    default:
      return null;
  }
}

function DepositPhase({ client }: { client: Client }) {
  if (!canShowDepositPreview(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Deposit will be available after scope and pricing are confirmed.
      </p>
    );
  }

  const deposit = getDepositAmount(client);
  const remaining = getSetupBalanceRemaining(client);

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-lg border border-purple-100 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Deposit (50% of setup)</span>
          <CurrencyAmount amount={deposit} />
        </div>
        <div className="mt-2 flex justify-between border-t border-purple-50 pt-2">
          <span className="text-ink-muted">Remaining balance at launch</span>
          <CurrencyAmount amount={remaining > 0 ? remaining : client.setupFee - deposit} />
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          Monthly service (
          <CurrencyAmount amount={client.monthlyFee} className="inline" />
          /mo) starts at launch.
        </p>
      </div>
      {isDepositPaid(client) ? (
        <p className="text-xs text-emerald-700">Deposit recorded toward setup — thank you.</p>
      ) : (
        <CustomerSetupPaymentPanel client={client} mode="deposit" />
      )}
    </div>
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

function GuidedSetupPhase({ client }: { client: Client }) {
  if (!canShowGuidedDataSetup(client)) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Guided setup opens after your deposit is received.
      </p>
    );
  }

  const connections = client.guidedConnections ?? [];

  return (
    <div className="mt-2 space-y-4">
      <p className="text-sm font-medium text-ink">
        Set up your connections with us
      </p>
      <p className="text-sm text-ink-muted">
        You sign in directly with the provider and approve access. We
        won&apos;t ask for your account password.
      </p>

      {connections.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Your confirmed tools will appear here once scope is finalized.
        </p>
      ) : (
        <ul className="space-y-2">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="rounded-lg border border-purple-100 bg-white px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{conn.label}</span>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple">
                  {CONNECTION_STATUS_LABELS[conn.demoStatus]} (demo)
                </span>
              </div>
              <button
                type="button"
                disabled
                className="mt-2 cursor-not-allowed rounded-md border border-dashed border-purple-200 px-3 py-1.5 text-xs text-ink-muted"
              >
                Connect with provider — preview
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-purple-100 bg-purple-50/20 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-purple">
          Guided call checklist
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-ink-muted">
          <li>Select the relevant spreadsheet, calendar, or business account</li>
          <li>Confirm which data and metrics belong in the dashboard</li>
          <li>Confirm reporting definitions and date/time settings</li>
        </ul>
        <p className="mt-2 text-xs text-ink-subtle">
          Connection statuses above are simulated for this demo — not verified by
          a provider.
        </p>
      </div>
    </div>
  );
}

