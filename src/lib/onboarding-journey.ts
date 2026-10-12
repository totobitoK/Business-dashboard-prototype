import {
  canShowDepositPreview,
  getClientPhases,
  getMilestoneProgress,
  getMilestoneProgressPercent,
  getPhaseState,
  hasIntakeComplete,
  isMilestoneComplete,
} from "./client-milestones";
import { getDiscoverySchedulingUrl, getGuidedSetupSchedulingUrl } from "./onboarding-config";
import {
  hasCustomerAcceptedCurrentPublishedScope,
  hasPendingScopeChangeRequest,
  hasPublishedScopeForReview,
  needsCustomerScopeAcceptance,
} from "./scope-acceptance";
import type { Client, ClientMilestone } from "./types";

export type OnboardingJourneyBlocker = {
  id: string;
  message: string;
};

export function getOnboardingJourneyBlockers(client: Client): OnboardingJourneyBlocker[] {
  const blockers: OnboardingJourneyBlocker[] = [];

  if (client.onboardingPath === "full" && !hasIntakeComplete(client)) {
    blockers.push({
      id: "intake",
      message: "Complete and submit the intake form.",
    });
  }

  if (client.onboardingPath === "payment-only" && !client.paymentOnlyPrepConfirmed) {
    blockers.push({
      id: "payment-only-prep",
      message: "Your RavenView contact is preparing your account (payment-only path).",
    });
  }

  if (
    hasPublishedScopeForReview(client) &&
    needsCustomerScopeAcceptance(client) &&
    !hasPendingScopeChangeRequest(client)
  ) {
    blockers.push({
      id: "scope-accept",
      message: "Review and accept scope & pricing, or request changes.",
    });
  }

  if (hasPendingScopeChangeRequest(client)) {
    blockers.push({
      id: "scope-changes",
      message: "We are reviewing your scope change request.",
    });
  }

  if (
    isMilestoneComplete(client, "scope-confirmed") === false &&
    hasIntakeComplete(client) &&
    !hasPublishedScopeForReview(client) &&
    !needsCustomerScopeAcceptance(client)
  ) {
    if (client.onboardingPath === "full" || client.paymentOnlyPrepConfirmed) {
      blockers.push({
        id: "scope-publish",
        message: "RavenView is preparing your proposed scope and pricing.",
      });
    }
  }

  if (!canShowDepositPreview(client) && isMilestoneComplete(client, "discovery") === false) {
    if (hasIntakeComplete(client)) {
      blockers.push({
        id: "discovery",
        message: "Book your discovery call so we can align on goals.",
      });
    }
  }

  return blockers;
}

export type CurrentOnboardingTask = {
  phaseKey: string;
  title: string;
  description: string;
  customerAction: string | null;
  ravenViewAction: string | null;
  milestone: ClientMilestone;
};

export function getCurrentOnboardingTask(client: Client): CurrentOnboardingTask | null {
  const phases = getClientPhases(client);
  const current = phases.find((p) => getPhaseState(client, p.milestone) === "current");
  if (!current) {
    if (client.status === "active") return null;
    const last = phases[phases.length - 1];
    if (last && isMilestoneComplete(client, last.milestone)) {
      return {
        phaseKey: "launch",
        title: "Awaiting launch",
        description: "Setup is complete on your side. RavenView will activate your dashboard.",
        customerAction: null,
        ravenViewAction: "Final launch checks",
        milestone: "final-balance",
      };
    }
    return null;
  }

  switch (current.key) {
    case "intake":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "Tell us about your business and reporting goals.",
        customerAction: "Complete the intake form below.",
        ravenViewAction: null,
      };
    case "discovery":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "Align on dashboard goals and next steps.",
        customerAction: getDiscoverySchedulingUrl()
          ? "Book your discovery call."
          : "Watch for RavenView to schedule your call.",
        ravenViewAction: getDiscoverySchedulingUrl() ? null : "We will reach out to schedule.",
      };
    case "scope":
      if (needsCustomerScopeAcceptance(client)) {
        return {
          phaseKey: current.key,
          title: current.title,
          milestone: current.milestone,
          description: "Review tools, screens, and fees before your deposit.",
          customerAction: "Accept scope & pricing or request changes.",
          ravenViewAction: null,
        };
      }
      if (hasPendingScopeChangeRequest(client)) {
        return {
          phaseKey: current.key,
          title: current.title,
          milestone: current.milestone,
          description: "Your change request is with our team.",
          customerAction: null,
          ravenViewAction: "Review requested scope changes and publish an update.",
        };
      }
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "We will publish scope, tools, and pricing for your review.",
        customerAction: null,
        ravenViewAction: "Prepare and publish proposed scope.",
      };
    case "deposit":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "Secure your build slot with the agreed deposit.",
        customerAction: hasCustomerAcceptedCurrentPublishedScope(client)
          ? "Complete deposit payment."
          : "Accept scope & pricing first.",
        ravenViewAction: null,
      };
    case "guided":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "Connect the tools in your agreed scope on a live call with RavenView.",
        customerAction:
          isMilestoneComplete(client, "guided-data-setup")
            ? null
            : isMilestoneComplete(client, "deposit")
              ? getGuidedSetupSchedulingUrl()
                ? "Schedule guided setup."
                : "We will contact you to arrange setup."
              : "Available after deposit.",
        ravenViewAction: isMilestoneComplete(client, "guided-data-setup")
          ? null
          : "We will not mark setup complete until after the call.",
      };
    case "build":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: isMilestoneComplete(client, "guided-data-setup")
          ? "Your dashboard build is underway."
          : "Available after guided setup is complete.",
        customerAction: client.dashboardPreviewUrl ? "Review the preview when ready." : null,
        ravenViewAction: isMilestoneComplete(client, "guided-data-setup")
          ? "Building from your agreed scope."
          : null,
      };
    case "launch":
      return {
        phaseKey: current.key,
        title: current.title,
        milestone: current.milestone,
        description: "Pay remaining setup balance and go live.",
        customerAction: isMilestoneComplete(client, "client-review")
          ? "Pay remaining setup balance."
          : "Approve your dashboard preview first.",
        ravenViewAction: client.status === "active" ? null : "Launch when setup is paid.",
      };
  }
}

export function getOnboardingProgressSummary(client: Client): {
  percent: number;
  completed: number;
  total: number;
  label: string;
} {
  const { completed, total } = getMilestoneProgress(client);
  return {
    percent: getMilestoneProgressPercent(client),
    completed,
    total,
    label:
      client.status === "active"
        ? "Live"
        : `${completed} of ${total} milestones complete`,
  };
}
