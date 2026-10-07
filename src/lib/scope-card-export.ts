import { buildScopeCard, type ScopeCard } from "./scope-card";
import type { Client } from "./types";

export interface ScopeCardExportResult {
  ok: boolean;
  card?: ScopeCard;
  error?: string;
  unchanged?: boolean;
}

export async function exportScopeCardToServer(
  client: Client
): Promise<ScopeCardExportResult> {
  const card = buildScopeCard(client, client.scopeCardVersion ?? 1);

  try {
    const response = await fetch("/api/scope-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      card?: ScopeCard;
      error?: string;
      versionChanged?: boolean;
    };

    if (!response.ok) {
      return { ok: false, error: data.error ?? "Export failed." };
    }

    return {
      ok: true,
      card: data.card,
      unchanged: data.versionChanged === false,
    };
  } catch {
    return { ok: false, error: "Could not reach scope-card export API." };
  }
}

export function canAcceptScopeCard(client: Client): boolean {
  if (client.onboardingPath === "payment-only") return true;
  return (
    client.onboardingFormStatus === "submitted" ||
    client.completedSteps.includes("requirements-submitted")
  );
}
