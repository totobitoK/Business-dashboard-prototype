import { getActivationEligibility } from "./client-activation";
import {
  getPortalJourneyBookends,
  isClientJourneyComplete,
} from "./client-milestones";
import { getCustomerPortalStage } from "./customer-portal-stage";
import { getNextStepLabel } from "./onboarding";
import {
  hasUnresolvedPreviewFeedback,
  isPreviewApprovedForCurrentRevision,
} from "./preview-review";
import type { Client } from "./types";

export type ManageDrawerSectionId =
  | "project-progress"
  | "scope-requirements"
  | "company-contact"
  | "billing"
  | "notes-files";

export function getAdminNextRequiredAction(client: Client): string {
  if (client.status === "active") {
    return "None — client is active. Use billing or notes as needed.";
  }
  if (client.status === "archived") {
    const { canActivate } = getActivationEligibility(client);
    return canActivate
      ? "Reactivate when the account should go live again."
      : "Reactivation blocked — resolve blockers in project progress.";
  }

  const { blockedReasons } = getActivationEligibility(client);
  if (blockedReasons.length > 0) {
    return blockedReasons[0];
  }
  if (isClientJourneyComplete(client)) {
    return "Activate client — all milestones complete.";
  }
  const onboardingNext = getNextStepLabel(client);
  if (onboardingNext) return onboardingNext;

  const { nextLabel } = getPortalJourneyBookends(client);
  return nextLabel ? `Customer milestone: ${nextLabel}` : "Review project progress.";
}

export function getPrimaryManageDrawerSection(
  client: Client
): ManageDrawerSectionId | null {
  if (client.status === "active") return null;

  const action = getAdminNextRequiredAction(client).toLowerCase();

  if (
    action.includes("payment") ||
    action.includes("deposit") ||
    action.includes("balance") ||
    action.includes("setup fee")
  ) {
    return "billing";
  }
  if (
    action.includes("preview") ||
    action.includes("build") ||
    action.includes("guided") ||
    action.includes("milestone") ||
    action.includes("discovery") ||
    action.includes("intake") ||
    action.includes("activate")
  ) {
    if (
      action.includes("scope") ||
      action.includes("intake") ||
      action.includes("onboarding") ||
      action.includes("discovery")
    ) {
      return "scope-requirements";
    }
    return "project-progress";
  }
  if (action.includes("scope") || action.includes("onboarding")) {
    return "scope-requirements";
  }

  const stage = getCustomerPortalStage(client);
  if (stage === "scope-and-deposit" || stage === "onboarding") {
    return "scope-requirements";
  }
  if (
    stage === "guided-connections" ||
    stage === "building" ||
    stage === "preview-ready" ||
    stage === "approved-awaiting-launch"
  ) {
    return "project-progress";
  }
  if (stage === "approved-balance-due") {
    return "billing";
  }
  return "project-progress";
}

export function getDefaultOpenManageDrawerSections(
  client: Client
): Set<ManageDrawerSectionId> {
  if (client.status === "active") {
    return new Set();
  }
  const primary = getPrimaryManageDrawerSection(client);
  return primary ? new Set([primary]) : new Set(["project-progress"]);
}

export function getAdminLaunchBlockerSummaries(client: Client): string[] {
  if (client.status === "active") return [];
  return getActivationEligibility(client).blockedReasons;
}

export function getAdminPreviewAlert(client: Client): {
  openFeedback: boolean;
  approved: boolean;
  changeRequest?: string;
} {
  return {
    openFeedback: hasUnresolvedPreviewFeedback(client),
    approved: isPreviewApprovedForCurrentRevision(client),
    changeRequest: client.previewChangeRequest,
  };
}
