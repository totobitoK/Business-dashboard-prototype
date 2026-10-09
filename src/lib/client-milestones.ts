import type {
  Client,
  ClientMilestone,
  ConnectionDemoStatus,
  GuidedConnection,
} from "./types";
import { isScopePricingConfirmed } from "./onboarding";
import { isPreviewApprovedForCurrentRevision } from "./preview-review";

export const MILESTONE_LABELS: Record<ClientMilestone, string> = {
  intake: "Intake",
  discovery: "Discovery",
  "scope-confirmed": "Scope confirmed",
  deposit: "Deposit",
  "guided-data-setup": "Guided data setup",
  building: "Building",
  "client-review": "Client review",
  "final-balance": "Final payment",
  active: "Active",
};

export const CONNECTION_STATUS_LABELS: Record<ConnectionDemoStatus, string> = {
  "not-started": "Not started",
  "awaiting-authorization": "Awaiting authorization",
  authorized: "Authorized",
  syncing: "Syncing",
  "data-validated": "Data validated",
  "needs-attention": "Needs attention",
};

const ADMIN_TOGGLABLE: ClientMilestone[] = [
  "discovery",
  "guided-data-setup",
  "building",
  "client-review",
];

export function isAdminTogglableMilestone(m: ClientMilestone): boolean {
  return ADMIN_TOGGLABLE.includes(m);
}

export function getDepositAmount(client: Client): number {
  return Math.round(client.setupFee * 50) / 100;
}

export function getSetupBalanceRemaining(client: Client): number {
  return Math.max(0, client.setupFee - client.setupPaidAmount);
}

export function isDepositPaid(client: Client): boolean {
  if (client.setupFee <= 0) return false;
  return client.setupPaidAmount >= getDepositAmount(client);
}

export function isFinalBalancePaid(client: Client): boolean {
  if (client.setupFee <= 0) return true;
  return client.setupPaidAmount >= client.setupFee;
}

export function isSetupPaymentFullyReceived(client: Client): boolean {
  if (client.setupFee <= 0) return true;
  return client.setupPaidAmount >= client.setupFee;
}

export function hasIntakeComplete(client: Client): boolean {
  if (client.onboardingPath === "payment-only") return true;
  return (
    client.onboardingFormStatus === "submitted" ||
    client.completedSteps.includes("requirements-submitted")
  );
}

export function hasScopeConfirmed(client: Client): boolean {
  return (
    isScopePricingConfirmed(client) ||
    client.adminCompletedMilestones?.includes("scope-confirmed") === true
  );
}

export function hasDiscoveryComplete(client: Client): boolean {
  return client.adminCompletedMilestones?.includes("discovery") === true;
}

function hasAdminMilestone(client: Client, m: ClientMilestone): boolean {
  return client.adminCompletedMilestones?.includes(m) === true;
}

/** Journey milestones only — activation (`active` status) is completion, not a step. */
export function getMilestonesForPath(client: Client): ClientMilestone[] {
  if (client.onboardingPath === "payment-only") {
    return [
      "discovery",
      "scope-confirmed",
      "deposit",
      "guided-data-setup",
      "building",
      "client-review",
      "final-balance",
    ];
  }
  return [
    "intake",
    "discovery",
    "scope-confirmed",
    "deposit",
    "guided-data-setup",
    "building",
    "client-review",
    "final-balance",
  ];
}

export function isMilestoneComplete(client: Client, milestone: ClientMilestone): boolean {
  switch (milestone) {
    case "intake":
      return hasIntakeComplete(client);
    case "discovery":
      return hasDiscoveryComplete(client);
    case "scope-confirmed":
      return hasScopeConfirmed(client);
    case "deposit":
      return isDepositPaid(client);
    case "final-balance":
      return isFinalBalancePaid(client);
    case "active":
      return client.status === "active";
    case "guided-data-setup":
    case "building":
      return hasAdminMilestone(client, milestone);
    case "client-review":
      return (
        isPreviewApprovedForCurrentRevision(client) ||
        hasAdminMilestone(client, milestone)
      );
    default:
      return false;
  }
}

export function getCompletedMilestones(client: Client): ClientMilestone[] {
  return getMilestonesForPath(client).filter((m) =>
    isMilestoneComplete(client, m)
  );
}

export function getMilestoneProgress(client: Client): {
  completed: number;
  total: number;
} {
  const path = getMilestonesForPath(client);
  const total = path.length;
  if (client.status === "active") {
    return { completed: total, total };
  }
  const completed = path.filter((m) => isMilestoneComplete(client, m)).length;
  return { completed, total };
}

export function isClientJourneyComplete(client: Client): boolean {
  const path = getMilestonesForPath(client);
  return path.every((m) => isMilestoneComplete(client, m));
}

/** Last completed and next upcoming milestone labels (portal progress copy). */
export function getPortalJourneyBookends(client: Client): {
  lastCompletedLabel: string | null;
  nextLabel: string | null;
} {
  const path = getMilestonesForPath(client);

  if (client.status === "active") {
    const lastMilestone = path[path.length - 1];
    return {
      lastCompletedLabel: lastMilestone
        ? MILESTONE_LABELS[lastMilestone]
        : null,
      nextLabel: "Active",
    };
  }

  let lastCompleted: ClientMilestone | null = null;
  let next: ClientMilestone | null = null;

  for (const milestone of path) {
    if (isMilestoneComplete(client, milestone)) {
      lastCompleted = milestone;
    } else if (!next) {
      next = milestone;
    }
  }

  if (isClientJourneyComplete(client)) {
    return {
      lastCompletedLabel: lastCompleted
        ? MILESTONE_LABELS[lastCompleted]
        : null,
      nextLabel: "Launch",
    };
  }

  return {
    lastCompletedLabel: lastCompleted
      ? MILESTONE_LABELS[lastCompleted]
      : null,
    nextLabel: next ? MILESTONE_LABELS[next] : null,
  };
}

export function canShowDepositPreview(client: Client): boolean {
  if (client.onboardingPath === "payment-only") {
    return (
      client.paymentOnlyPrepConfirmed === true && hasScopeConfirmed(client)
    );
  }
  return hasScopeConfirmed(client) && hasIntakeComplete(client);
}

export function canShowFinalPaymentPreview(client: Client): boolean {
  return (
    isMilestoneComplete(client, "client-review") &&
    isMilestoneComplete(client, "building") &&
    isDepositPaid(client) &&
    !isFinalBalancePaid(client)
  );
}

export function canShowGuidedDataSetup(client: Client): boolean {
  return isDepositPaid(client) && hasScopeConfirmed(client);
}

export function syncGuidedConnectionsFromScope(client: Client): GuidedConnection[] {
  const labels = client.acceptedSourcesIn ?? [];
  const existing = client.guidedConnections ?? [];
  const byLabel = new Map(existing.map((c) => [c.label, c]));

  return labels.map((label, i) => {
    const prev = byLabel.get(label);
    return (
      prev ?? {
        id: `conn-${i}-${label.replace(/\s+/g, "-").toLowerCase()}`,
        label,
        demoStatus: "not-started" as ConnectionDemoStatus,
      }
    );
  });
}

export const CLIENT_PHASES = [
  {
    key: "intake",
    title: "Tell us about your business",
    milestone: "intake" as ClientMilestone,
  },
  {
    key: "discovery",
    title: "Discovery call",
    milestone: "discovery" as ClientMilestone,
  },
  {
    key: "scope",
    title: "Scope and pricing",
    milestone: "scope-confirmed" as ClientMilestone,
  },
  {
    key: "deposit",
    title: "Deposit",
    milestone: "deposit" as ClientMilestone,
  },
  {
    key: "guided",
    title: "Guided data setup",
    milestone: "guided-data-setup" as ClientMilestone,
  },
  {
    key: "build",
    title: "Build and review",
    milestone: "building" as ClientMilestone,
  },
  {
    key: "launch",
    title: "Final payment and launch",
    milestone: "final-balance" as ClientMilestone,
  },
] as const;

export function getClientPhases(client: Client) {
  if (client.onboardingPath === "payment-only") {
    return CLIENT_PHASES.filter((p) => p.key !== "intake");
  }
  return CLIENT_PHASES;
}

export function getNextMilestoneLabel(client: Client): string | null {
  const phases = getClientPhases(client);
  const next = phases.find((p) => !isMilestoneComplete(client, p.milestone));
  return next?.title ?? null;
}

export function getMilestoneProgressPercent(client: Client): number {
  const { completed, total } = getMilestoneProgress(client);
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function getPhaseState(
  client: Client,
  milestone: ClientMilestone
): "complete" | "current" | "upcoming" {
  if (isMilestoneComplete(client, milestone)) return "complete";
  const phases = getClientPhases(client);
  const firstIncomplete = phases.find(
    (p) => !isMilestoneComplete(client, p.milestone)
  );
  if (firstIncomplete?.milestone === milestone) return "current";
  return "upcoming";
}
