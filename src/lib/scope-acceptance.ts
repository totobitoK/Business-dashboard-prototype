import type { Client } from "./types";
import { isScopePricingConfirmed } from "./onboarding";

/** Fields that change what the customer must accept before deposit. */
export function touchesCustomerScopeMaterial(updates: Partial<Client>): boolean {
  return (
    "setupFee" in updates ||
    "monthlyFee" in updates ||
    "acceptedSourcesIn" in updates ||
    "acceptedScreens" in updates ||
    "agreedScopeSummary" in updates ||
    "dashboardScope" in updates
  );
}

export function getEffectiveScopeRevision(client: Client): number {
  return client.scopeRevision ?? client.publishedScopeRevision ?? 0;
}

/** Legacy clients without publish flow — treated as accepted when admin confirmed scope. */
export function isLegacyScopeConfirmation(client: Client): boolean {
  if (client.publishedScopeRevision != null) return false;
  return (
    isScopePricingConfirmed(client) ||
    client.adminCompletedMilestones?.includes("scope-confirmed") === true
  );
}

export function hasPublishedScopeForReview(client: Client): boolean {
  return (
    client.publishedScopeRevision != null &&
    client.publishedScopeRevision > 0 &&
    !!client.scopePublishedAt
  );
}

export function hasCustomerAcceptedCurrentPublishedScope(client: Client): boolean {
  if (!hasPublishedScopeForReview(client)) return false;
  return (
    client.scopeCustomerAcceptedRevision === client.publishedScopeRevision &&
    !!client.scopeCustomerAcceptedAt
  );
}

/** Deposit / guided setup gate — customer acceptance or legacy admin confirmation. */
export function hasCustomerScopeAcceptanceForDeposit(client: Client): boolean {
  if (isLegacyScopeConfirmation(client)) return true;
  return hasCustomerAcceptedCurrentPublishedScope(client);
}

export function needsCustomerScopeAcceptance(client: Client): boolean {
  if (!hasPublishedScopeForReview(client)) return false;
  return !hasCustomerAcceptedCurrentPublishedScope(client);
}

export function hasPendingScopeChangeRequest(client: Client): boolean {
  return !!client.scopeChangeRequestAt;
}

export function buildScopeMaterialChangePatch(
  client: Client,
  updates: Partial<Client>
): Partial<Client> {
  if (!touchesCustomerScopeMaterial(updates)) return {};
  const nextRevision = getEffectiveScopeRevision(client) + 1;
  return {
    scopeRevision: nextRevision,
    scopeCustomerAcceptedAt: undefined,
    scopeCustomerAcceptedRevision: undefined,
  };
}

export function buildScopePublishPatch(client: Client, publishedAt: string): Partial<Client> {
  const revision = Math.max(getEffectiveScopeRevision(client), 1);
  return {
    scopeRevision: revision,
    publishedScopeRevision: revision,
    scopePublishedAt: publishedAt,
    scopeCustomerAcceptedAt: undefined,
    scopeCustomerAcceptedRevision: undefined,
    scopeChangeRequestAt: undefined,
    scopeChangeRequestNote: undefined,
  };
}

export function buildCustomerScopeAcceptPatch(
  client: Client,
  acceptedAt: string
): Partial<Client> | null {
  if (!hasPublishedScopeForReview(client)) return null;
  const rev = client.publishedScopeRevision!;
  return {
    scopeCustomerAcceptedAt: acceptedAt,
    scopeCustomerAcceptedRevision: rev,
    scopeChangeRequestAt: undefined,
    scopeChangeRequestNote: undefined,
  };
}

export function scopeHasPublishableContent(client: Client): boolean {
  return (
    (client.acceptedSourcesIn?.length ?? 0) > 0 ||
    (client.acceptedScreens?.length ?? 0) > 0 ||
    Boolean(client.agreedScopeSummary?.trim()) ||
    Boolean(client.dashboardScope?.trim())
  );
}

/** Same outcome as store `publishScopeForCustomerReview` (without persistence). */
export function applyPublishScopeToClient(
  client: Client,
  publishedAt: string
): Client | null {
  if (!scopeHasPublishableContent(client)) return null;
  const patch = buildScopePublishPatch(client, publishedAt);
  return { ...client, ...patch };
}

/** Same outcome as store `acceptCustomerScopePricing` (without notes). */
export function applyAcceptScopeToClient(client: Client, acceptedAt: string): Client | null {
  const patch = buildCustomerScopeAcceptPatch(client, acceptedAt);
  if (!patch) return null;
  return { ...client, ...patch };
}

/** One-time backfill for stored clients that predates customer scope acceptance. */
export function backfillLegacyScopePublish(client: Client): Partial<Client> {
  if (client.publishedScopeRevision != null) return {};
  const legacy = isLegacyScopeConfirmation(client);
  if (!legacy) return {};
  const at = client.scopePricingConfirmedAt ?? client.createdAt;
  return {
    scopeRevision: 1,
    publishedScopeRevision: 1,
    scopePublishedAt: at,
    scopeCustomerAcceptedRevision: 1,
    scopeCustomerAcceptedAt: at,
  };
}
