import type { Client, ClientOnboardingDraft } from "./types";

export type OnboardingDraftSaveResult = { ok: true } | { ok: false; error: string };

export function canPersistOnboardingDraft(client: Client): boolean {
  return client.onboardingFormStatus !== "submitted";
}

export function mergeOnboardingDraftUpdate(
  client: Client,
  draft: ClientOnboardingDraft
): Client | null {
  if (!canPersistOnboardingDraft(client)) return null;
  return {
    ...client,
    onboardingFormStatus: "in-progress",
    onboardingDraft: draft,
  };
}

/** Apply draft only to the matching client; other records unchanged. */
export function applyOnboardingDraftToClientList(
  clients: Client[],
  clientId: string,
  draft: ClientOnboardingDraft
): Client[] {
  return clients.map((c) => {
    if (c.id !== clientId) return c;
    const next = mergeOnboardingDraftUpdate(c, draft);
    return next ?? c;
  });
}

export function normalizeDraftStep(
  step: ClientOnboardingDraft["currentStep"] | undefined
): ClientOnboardingDraft["currentStep"] {
  if (step === "review" || step === 1 || step === 2 || step === 3) return step;
  return 1;
}
