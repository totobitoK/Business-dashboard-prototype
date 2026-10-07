import { syncGuidedConnectionsFromScope } from "./client-milestones";
import type { Client, ClientMilestone, OnboardingStep } from "./types";

const LEGACY_STEP = "details-submitted";

/** Bump when one-time admin milestone inference rules change. */
export const MILESTONE_MIGRATION_VERSION = 2;

function applyMilestoneMigration(
  client: Client,
  completedSteps: OnboardingStep[]
): Pick<
  Client,
  "adminCompletedMilestones" | "paymentOnlyPrepConfirmed" | "milestoneMigrationVersion"
> {
  const admin = new Set<ClientMilestone>(client.adminCompletedMilestones ?? []);
  const isDone = client.status === "active" || client.status === "archived";
  const scopeConfirmed =
    completedSteps.includes("scope-pricing-confirmed") ||
    !!client.scopePricingConfirmedAt;

  // Repair v1 over-inference (pending clients marked too far ahead).
  if (client.status === "pending" && !scopeConfirmed) {
    admin.delete("discovery");
  }
  if (client.status === "pending" && !completedSteps.includes("dashboard-ready")) {
    admin.delete("guided-data-setup");
    admin.delete("building");
    admin.delete("client-review");
  }

  if (scopeConfirmed) {
    admin.add("scope-confirmed");
  }

  // Discovery: not from intake alone — scope confirmed or engagement finished.
  if (isDone || scopeConfirmed) {
    admin.add("discovery");
  }

  // Guided build path: not from setup payment alone while still pending.
  if (isDone || completedSteps.includes("dashboard-ready")) {
    admin.add("guided-data-setup");
    admin.add("building");
    admin.add("client-review");
  }

  let paymentOnlyPrepConfirmed = client.paymentOnlyPrepConfirmed;
  if (client.onboardingPath === "payment-only" && isDone) {
    admin.add("scope-confirmed");
    paymentOnlyPrepConfirmed = true;
  }

  return {
    adminCompletedMilestones: [...admin],
    paymentOnlyPrepConfirmed,
    milestoneMigrationVersion: MILESTONE_MIGRATION_VERSION,
  };
}

/** Normalize legacy step names and run one-time milestone migration. */
export function normalizeClient(client: Client): Client {
  let completedSteps = [...client.completedSteps] as string[];

  if (completedSteps.includes(LEGACY_STEP)) {
    completedSteps = completedSteps.filter((s) => s !== LEGACY_STEP);
    if (!completedSteps.includes("requirements-submitted")) {
      completedSteps.push("requirements-submitted");
    }
  }

  const hasPaymentOrLater = completedSteps.some((s) =>
    ["setup-payment-received", "dashboard-ready", "active"].includes(s)
  );
  const isCompletedClient =
    client.status === "active" || client.status === "archived";

  if (
    client.onboardingPath === "full" &&
    (hasPaymentOrLater || isCompletedClient) &&
    completedSteps.includes("requirements-submitted") &&
    !completedSteps.includes("scope-pricing-confirmed")
  ) {
    completedSteps.push("scope-pricing-confirmed");
  }

  let onboardingFormStatus = client.onboardingFormStatus ?? "not-started";
  if (client.onboardingPath === "full") {
    if (client.onboardingSubmission || completedSteps.includes("requirements-submitted")) {
      onboardingFormStatus = "submitted";
    } else if (client.onboardingDraft) {
      onboardingFormStatus = "in-progress";
    }
  }

  let scopePricingConfirmedAt = client.scopePricingConfirmedAt;
  if (
    completedSteps.includes("scope-pricing-confirmed") &&
    !scopePricingConfirmedAt
  ) {
    scopePricingConfirmedAt = client.createdAt;
  }

  const steps = completedSteps as OnboardingStep[];

  const milestoneVersion = client.milestoneMigrationVersion ?? 0;
  const milestonePatch =
    milestoneVersion < MILESTONE_MIGRATION_VERSION
      ? applyMilestoneMigration(client, steps)
      : {
          adminCompletedMilestones: client.adminCompletedMilestones,
          paymentOnlyPrepConfirmed: client.paymentOnlyPrepConfirmed,
          milestoneMigrationVersion: client.milestoneMigrationVersion,
        };

  const merged: Client = {
    ...client,
    completedSteps: steps,
    onboardingFormStatus,
    scopePricingConfirmedAt,
    ...milestonePatch,
  };

  return {
    ...merged,
    guidedConnections: syncGuidedConnectionsFromScope(merged),
  };
}

export function normalizeClients(clients: Client[]): Client[] {
  return clients.map(normalizeClient);
}
