import {
  canShowGuidedDataSetup,
  getSetupBalanceRemaining,
  isDepositPaid,
  isFinalBalancePaid,
  isMilestoneComplete,
} from "./client-milestones";
import type { CustomerPortalStage } from "./customer-portal-stage";
import { isScopePricingConfirmed } from "./onboarding";
import { hasUnresolvedPreviewFeedback } from "./preview-review";
import type { Client } from "./types";

export interface PortalNextAction {
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  primaryExternalHref?: string;
  useInPagePrimary?: boolean;
}

export function getPortalCustomerBlockers(
  client: Client,
  stage: CustomerPortalStage
): string[] {
  const blockers: string[] = [];

  if (stage === "onboarding") {
    if (client.onboardingPath === "full") {
      blockers.push("Onboarding form not submitted yet.");
    }
  }

  if (stage === "scope-and-deposit") {
    if (!isScopePricingConfirmed(client)) {
      blockers.push("Scope and pricing are not confirmed yet — discovery may still be in progress.");
    }
    if (
      isScopePricingConfirmed(client) &&
      client.setupFee > 0 &&
      !isDepositPaid(client)
    ) {
      blockers.push(
        "Setup deposit has not been recorded yet — use the payment button when you are ready."
      );
    }
  }

  if (stage === "guided-connections") {
    if (!isMilestoneComplete(client, "guided-data-setup")) {
      blockers.push("Guided connection setup is your current step.");
    }
  }

  if (hasUnresolvedPreviewFeedback(client)) {
    blockers.push(
      "You have an open preview change request. Wait for a revised preview before approving again."
    );
  }

  if (stage === "preview-ready" && hasUnresolvedPreviewFeedback(client)) {
    blockers.push("Approve only after RavenView marks the revised preview ready.");
  }

  return blockers;
}

export function getPortalNextAction(
  client: Client,
  stage: CustomerPortalStage
): PortalNextAction {
  switch (stage) {
    case "onboarding":
      return {
        title: "Complete onboarding",
        description:
          "Tell us about your business, metrics, and tools so we can prepare scope and pricing.",
        primaryLabel: "Continue onboarding",
        primaryHref: `/onboarding/${client.id}`,
      };
    case "scope-and-deposit":
      if (!isScopePricingConfirmed(client)) {
        return {
          title: "Discovery & scope",
          description:
            "We will confirm agreed scope and setup pricing after discovery.",
          primaryLabel: "Book a discovery call",
          primaryExternalHref: "discovery-scheduling",
        };
      }
      if (client.setupFee > 0 && !isDepositPaid(client)) {
        return {
          title: "Setup deposit",
          description:
            "Your deposit is recorded by RavenView when received — see payment status below.",
        };
      }
      return {
        title: "Scope confirmed",
        description: "Next steps will appear when guided setup opens.",
      };
    case "guided-connections":
      return {
        title: "Guided connection setup",
        description:
          "Complete data connections with our team. You sign in directly with each provider.",
        primaryLabel: "Open connections",
        primaryHref: "/dashboard/connections",
      };
    case "building":
      return {
        title: "Dashboard build in progress",
        description:
          client.buildStatusNote ??
          "We are configuring your dashboard from the agreed scope.",
      };
    case "preview-ready":
      return {
        title: "Review dashboard preview",
        description: "Approve the sample layout below or send change requests.",
        useInPagePrimary: true,
      };
    case "approved-balance-due":
      return {
        title: "Preview approved",
        description: "Your approved preview is below.",
      };
    case "approved-awaiting-launch":
      return {
        title: "Awaiting launch",
        description:
          "Setup is paid and preview is approved. RavenView will launch when ready.",
      };
    case "live":
      return {
        title: "Your dashboard is live",
        description: "Sample operations data below — not live integrations in this demo.",
      };
    default:
      return { title: "Project in progress", description: "" };
  }
}

export function isGuidedSetupCurrentTask(
  client: Client,
  stage: CustomerPortalStage
): boolean {
  return stage === "guided-connections" && canShowGuidedDataSetup(client);
}

export function guidedSetupStatusLabel(client: Client): string {
  if (isMilestoneComplete(client, "guided-data-setup")) return "Complete";
  if ((client.guidedConnections?.length ?? 0) === 0) return "Not started";
  const statuses = client.guidedConnections!.map((c) => c.demoStatus);
  if (statuses.every((s) => s === "data-validated")) return "Complete";
  if (statuses.some((s) => s === "needs-attention")) return "Needs attention";
  if (statuses.some((s) => s !== "not-started")) return "In progress";
  return "Not started";
}

/** Stages where the home screen should stay minimal — details live in “More project details”. */
export function portalUsesCompactDetails(stage: CustomerPortalStage): boolean {
  return (
    stage === "preview-ready" ||
    stage === "building" ||
    stage === "live" ||
    stage === "approved-awaiting-launch"
  );
}

export function getPortalNextStepMessage(
  client: Client,
  stage: CustomerPortalStage
): string | null {
  if (stage === "approved-balance-due" && !isFinalBalancePaid(client)) {
    const remaining = getSetupBalanceRemaining(client);
    const formatted = remaining.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return `Next step: Pay the remaining ${formatted} setup balance in Payment status (below your dashboard preview) — select Complete setup payment when you are ready.`;
  }
  return null;
}

export function paymentOneLineSummary(client: Client): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return `Setup ${fmt(client.setupFee)} · Recorded ${fmt(client.setupPaidAmount)} · Remaining ${fmt(getSetupBalanceRemaining(client))}`;
}
