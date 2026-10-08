import {
  hasDiscoveryComplete,
  hasIntakeComplete,
  hasScopeConfirmed,
  isMilestoneComplete,
  isSetupPaymentFullyReceived,
} from "./client-milestones";
import type { Client } from "./types";
import {
  getCurrentPreviewRevision,
  hasUnresolvedPreviewFeedback,
  isPreviewApprovedForCurrentRevision,
} from "./preview-review";

export interface ActivationEligibility {
  canActivate: boolean;
  blockedReasons: string[];
}

export function wasPreviouslyLaunched(client: Client): boolean {
  return Boolean(client.launchedAt);
}

/** Single source of truth for activate button, status dropdown → active, and reactivation. */
export function getActivationEligibility(client: Client): ActivationEligibility {
  if (client.status === "active") {
    return { canActivate: true, blockedReasons: [] };
  }

  if (client.status === "archived" && wasPreviouslyLaunched(client)) {
    return { canActivate: true, blockedReasons: [] };
  }

  if (client.status !== "pending" && client.status !== "archived") {
    return {
      canActivate: false,
      blockedReasons: ["Client must be pending or archived to activate."],
    };
  }

  const blockedReasons: string[] = [];

  if (client.onboardingPath === "full" && !hasIntakeComplete(client)) {
    blockedReasons.push("Intake form not submitted.");
  }
  if (client.onboardingPath === "payment-only" && !client.paymentOnlyPrepConfirmed) {
    blockedReasons.push("Payment-only preparation not confirmed in admin.");
  }
  if (!hasDiscoveryComplete(client)) {
    blockedReasons.push("Discovery milestone not complete.");
  }
  if (!hasScopeConfirmed(client)) {
    blockedReasons.push("Scope and pricing not confirmed.");
  }
  if (!isSetupPaymentFullyReceived(client)) {
    blockedReasons.push("Required setup payment not fully received.");
  }
  if (!isMilestoneComplete(client, "guided-data-setup")) {
    blockedReasons.push("Guided data setup not complete.");
  }
  if (!isMilestoneComplete(client, "building")) {
    blockedReasons.push("Dashboard build not complete.");
  }
  if (!isPreviewApprovedForCurrentRevision(client)) {
    blockedReasons.push(
      `Preview not approved for revision ${getCurrentPreviewRevision(client)}.`
    );
  }
  if (hasUnresolvedPreviewFeedback(client)) {
    blockedReasons.push("Unresolved preview change request.");
  }

  return {
    canActivate: blockedReasons.length === 0,
    blockedReasons,
  };
}

export function canActivateClient(client: Client): boolean {
  return getActivationEligibility(client).canActivate;
}

export function getActivationBlockedSummary(client: Client): string {
  const { blockedReasons } = getActivationEligibility(client);
  if (blockedReasons.length === 0) return "";
  return blockedReasons.join(" ");
}
