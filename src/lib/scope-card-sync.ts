import type { Client } from "./types";

/** CRM fields that affect the scope-card projection. */
export const SCOPE_CARD_SYNC_FIELDS: (keyof Client)[] = [
  "company",
  "email",
  "status",
  "acceptedSourcesIn",
  "acceptedScreens",
  "dashboardUrl",
  "setupFee",
  "monthlyFee",
  "setupPaidAmount",
];

const debouncers = new Map<string, ReturnType<typeof setTimeout>>();

export function shouldAutoExportScopeCard(client: Client): boolean {
  return (
    client.completedSteps.includes("requirements-submitted") ||
    client.completedSteps.includes("scope-pricing-confirmed") ||
    !!client.scopeCardExportedAt
  );
}

export function touchesScopeCardFields(updates: Partial<Client>): boolean {
  return SCOPE_CARD_SYNC_FIELDS.some((key) => key in updates);
}

/** Debounced scope-card sync — reads latest client inside `run`. */
export function scheduleScopeCardSync(
  clientId: string,
  run: () => void,
  delayMs = 500
): void {
  const pending = debouncers.get(clientId);
  if (pending) clearTimeout(pending);
  debouncers.set(
    clientId,
    setTimeout(() => {
      debouncers.delete(clientId);
      run();
    }, delayMs)
  );
}

/** Immediate sync (no debounce) for one-shot events like form submit. */
export function scheduleScopeCardSyncImmediate(
  clientId: string,
  run: () => void
): void {
  const pending = debouncers.get(clientId);
  if (pending) clearTimeout(pending);
  debouncers.delete(clientId);
  run();
}
