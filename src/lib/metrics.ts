import type { ActivityCategory, ActivityEntry, Client } from "./types";
import { getSetupRemaining } from "./onboarding";
import { TOOL_LABELS } from "./onboarding-form";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculatePaidRevenue(clients: Client[]): number {
  return clients.reduce((total, client) => {
    const clientTotal = client.payments.reduce((sum, p) => {
      if (p.type === "refund") return sum - p.amount;
      return sum + p.amount;
    }, 0);
    return total + clientTotal;
  }, 0);
}

export function calculatePipelineRevenue(clients: Client[]): number {
  return clients
    .filter((c) => c.status === "pending")
    .reduce((total, c) => total + getSetupRemaining(c), 0);
}

export function calculateMRR(clients: Client[]): number {
  return clients
    .filter((c) => c.status === "active" && c.subscriptionActive)
    .reduce((total, c) => total + c.monthlyFee, 0);
}

export function getActiveCount(clients: Client[]): number {
  return clients.filter((c) => c.status === "active").length;
}

export function getPendingCount(clients: Client[]): number {
  return clients.filter((c) => c.status === "pending").length;
}

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  payments: "Payments",
  notes: "Notes",
  onboarding: "Onboarding",
};

export function getRecentActivity(
  clients: Client[],
  limit?: number
): ActivityEntry[] {
  const activities: ActivityEntry[] = [];

  for (const client of clients) {
    if (client.onboardingSubmission?.submittedAt) {
      activities.push({
        id: `onboard-submit-${client.id}`,
        clientId: client.id,
        clientName: client.company,
        date: client.onboardingSubmission.submittedAt,
        category: "onboarding",
        description: "Client submitted onboarding requirements",
      });
    }
    if (client.scopePricingConfirmedAt) {
      activities.push({
        id: `onboard-scope-${client.id}`,
        clientId: client.id,
        clientName: client.company,
        date: client.scopePricingConfirmedAt,
        category: "onboarding",
        description: "Scope and pricing confirmed by admin",
      });
    }
    for (const payment of client.payments) {
      activities.push({
        id: `pay-${payment.id}`,
        clientId: client.id,
        clientName: client.company,
        date: payment.date,
        category: "payments",
        description:
          payment.type === "refund"
            ? `Refund of ${formatCurrencyDetailed(payment.amount)} processed`
            : `${payment.type === "setup" ? "Setup" : "Subscription"} payment of ${formatCurrencyDetailed(payment.amount)} received`,
      });
    }
    for (const note of client.notes) {
      activities.push({
        id: `note-${note.id}`,
        clientId: client.id,
        clientName: client.company,
        date: note.date,
        category: "notes",
        description: `Note added: "${note.content.slice(0, 60)}${note.content.length > 60 ? "…" : ""}"`,
      });
    }
  }

  const sorted = activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return limit ? sorted.slice(0, limit) : sorted;
}

export function groupActivityByCategory(
  activities: ActivityEntry[]
): Record<ActivityCategory, ActivityEntry[]> {
  return {
    payments: activities.filter((a) => a.category === "payments"),
    notes: activities.filter((a) => a.category === "notes"),
    onboarding: activities.filter((a) => a.category === "onboarding"),
  };
}

export function formatToolsList(tools: string[]): string {
  return tools.map((t) => TOOL_LABELS[t as keyof typeof TOOL_LABELS] ?? t).join(", ");
}
