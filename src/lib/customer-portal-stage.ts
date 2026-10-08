import {
  canShowGuidedDataSetup,
  getMilestoneProgress,
  isDepositPaid,
  isFinalBalancePaid,
  isMilestoneComplete,
} from "./client-milestones";
import { isScopePricingConfirmed } from "./onboarding";
import {
  getCurrentPreviewRevision,
  hasUnresolvedPreviewFeedback,
  isPreviewApprovedForCurrentRevision,
} from "./preview-review";
import type { Client } from "./types";

export type CustomerPortalStage =
  | "onboarding"
  | "scope-and-deposit"
  | "guided-connections"
  | "building"
  | "preview-ready"
  | "approved-balance-due"
  | "approved-awaiting-launch"
  | "live";

export const CUSTOMER_PORTAL_STAGE_LABELS: Record<CustomerPortalStage, string> = {
  onboarding: "Onboarding",
  "scope-and-deposit": "Scope & deposit",
  "guided-connections": "Guided connection setup",
  building: "Building your dashboard",
  "preview-ready": "Preview ready for review",
  "approved-balance-due": "Preview approved",
  "approved-awaiting-launch": "Awaiting launch",
  live: "Live",
};

export function getCustomerPortalStage(client: Client): CustomerPortalStage {
  if (client.status === "active") return "live";

  if (isPreviewApprovedForCurrentRevision(client)) {
    if (!isFinalBalancePaid(client)) return "approved-balance-due";
    return "approved-awaiting-launch";
  }

  if (
    hasUnresolvedPreviewFeedback(client) &&
    isMilestoneComplete(client, "building")
  ) {
    return "preview-ready";
  }

  if (
    isMilestoneComplete(client, "building") &&
    isDepositPaid(client) &&
    isMilestoneComplete(client, "guided-data-setup")
  ) {
    return "preview-ready";
  }

  if (
    isMilestoneComplete(client, "guided-data-setup") &&
    !isMilestoneComplete(client, "building")
  ) {
    return "building";
  }

  if (
    canShowGuidedDataSetup(client) &&
    !isMilestoneComplete(client, "guided-data-setup")
  ) {
    return "guided-connections";
  }

  if (needsOnboardingIntake(client)) {
    return "onboarding";
  }

  if (!isScopePricingConfirmed(client) || !isDepositPaid(client)) {
    return "scope-and-deposit";
  }

  return "onboarding";
}

export function showCustomerDashboardPreview(client: Client): boolean {
  const stage = getCustomerPortalStage(client);
  return (
    stage === "preview-ready" ||
    stage === "approved-balance-due" ||
    stage === "approved-awaiting-launch" ||
    stage === "live" ||
    (isMilestoneComplete(client, "building") &&
      (hasUnresolvedPreviewFeedback(client) || !!client.previewChangeRequest))
  );
}

export function getPreviewRevisionLabel(client: Client): string {
  return `Revision ${getCurrentPreviewRevision(client)}`;
}

export function getCustomerPortalProgress(client: Client): {
  completed: number;
  total: number;
  percent: number;
} {
  const { completed, total } = getMilestoneProgress(client);
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function needsOnboardingIntake(client: Client): boolean {
  if (client.onboardingPath === "payment-only") return false;
  return (
    client.onboardingFormStatus !== "submitted" &&
    !client.completedSteps.includes("requirements-submitted")
  );
}
