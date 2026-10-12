import type { Client, PublishedScopeSnapshot } from "./types";
import { isScopePricingConfirmed } from "./onboarding";

/** Bump when one-time scope acceptance repair runs. */
export const SCOPE_MIGRATION_VERSION = 1;

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

/** Admin confirmed scope before customer publish flow existed. Not customer acceptance. */
export function isLegacyAdminScopeConfirmation(client: Client): boolean {
  if (client.publishedScopeRevision != null) return false;
  return (
    isScopePricingConfirmed(client) ||
    client.adminCompletedMilestones?.includes("scope-confirmed") === true
  );
}

/** @deprecated Use isLegacyAdminScopeConfirmation */
export function isLegacyScopeConfirmation(client: Client): boolean {
  return isLegacyAdminScopeConfirmation(client);
}

export function hasPublishedScopeForReview(client: Client): boolean {
  return (
    client.publishedScopeRevision != null &&
    client.publishedScopeRevision > 0 &&
    !!client.scopePublishedAt &&
    !!getPublishedScopeSnapshot(client)
  );
}

export function buildScopeSnapshot(
  client: Client,
  revision: number,
  publishedAt: string
): PublishedScopeSnapshot {
  return {
    revision,
    publishedAt,
    setupFee: client.setupFee,
    monthlyFee: client.monthlyFee,
    acceptedSourcesIn: [...(client.acceptedSourcesIn ?? [])],
    acceptedScreens: [...(client.acceptedScreens ?? [])],
    agreedScopeSummary: client.agreedScopeSummary,
    dashboardScope: client.dashboardScope,
  };
}

export function getPublishedScopeSnapshot(client: Client): PublishedScopeSnapshot | null {
  if (client.publishedScopeSnapshot) {
    return client.publishedScopeSnapshot;
  }
  return null;
}

/** Scope/pricing fields the customer must review — frozen published snapshot only. */
export function getCustomerFacingScope(client: Client): PublishedScopeSnapshot | null {
  return getPublishedScopeSnapshot(client);
}

export function hasUnpublishedScopeDraftChanges(client: Client): boolean {
  if (!hasPublishedScopeForReview(client)) return false;
  return getEffectiveScopeRevision(client) > client.publishedScopeRevision!;
}

export function hasCustomerAcceptedCurrentPublishedScope(client: Client): boolean {
  if (!hasPublishedScopeForReview(client)) return false;
  if (hasUnpublishedScopeDraftChanges(client)) return false;
  if (client.scopeCustomerAcceptanceSource !== "customer") return false;
  return (
    client.scopeCustomerAcceptedRevision === client.publishedScopeRevision &&
    !!client.scopeCustomerAcceptedAt
  );
}

export function isHistoricalLaunchedClient(client: Client): boolean {
  if (client.status === "active") return true;
  if (client.launchedAt) return true;
  return client.completedSteps.some((s) =>
    ["dashboard-ready", "active"].includes(s)
  );
}

export function isScopeDepositGrandfathered(client: Client): boolean {
  if (client.scopeDepositGrandfathered === true) return true;
  return (
    isHistoricalLaunchedClient(client) &&
    isLegacyAdminScopeConfirmation(client) &&
    client.publishedScopeRevision == null
  );
}

/** Deposit / guided setup gate — explicit customer acceptance or grandfathered launch. */
export function hasCustomerScopeAcceptanceForDeposit(client: Client): boolean {
  if (isScopeDepositGrandfathered(client)) return true;
  return hasCustomerAcceptedCurrentPublishedScope(client);
}

export function needsCustomerScopeAcceptance(client: Client): boolean {
  if (!hasPublishedScopeForReview(client)) {
    if (
      isLegacyAdminScopeConfirmation(client) &&
      !isHistoricalLaunchedClient(client) &&
      !isScopeDepositGrandfathered(client)
    ) {
      return true;
    }
    return false;
  }
  if (hasUnpublishedScopeDraftChanges(client)) return true;
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
    scopeCustomerAcceptanceSource: undefined,
  };
}

export function buildScopePublishPatch(client: Client, publishedAt: string): Partial<Client> {
  const revision = Math.max(getEffectiveScopeRevision(client), 1);
  const snapshot = buildScopeSnapshot(client, revision, publishedAt);
  return {
    scopeRevision: revision,
    publishedScopeRevision: revision,
    scopePublishedAt: publishedAt,
    publishedScopeSnapshot: snapshot,
    scopeCustomerAcceptedAt: undefined,
    scopeCustomerAcceptedRevision: undefined,
    scopeCustomerAcceptanceSource: undefined,
    scopeChangeRequestAt: undefined,
    scopeChangeRequestNote: undefined,
    scopeAcceptanceNeedsReview: undefined,
  };
}

export function validateCustomerScopeAcceptance(
  client: Client,
  expectedPublishedRevision: number
): { ok: true } | { ok: false; reason: string } {
  if (!hasPublishedScopeForReview(client)) {
    return { ok: false, reason: "No published scope is available to accept yet." };
  }
  if (client.publishedScopeRevision !== expectedPublishedRevision) {
    return {
      ok: false,
      reason: "This scope revision is outdated — refresh and review the latest publish.",
    };
  }
  if (hasUnpublishedScopeDraftChanges(client)) {
    return {
      ok: false,
      reason: "RavenView is updating scope — wait for a new revision before accepting.",
    };
  }
  return { ok: true };
}

export function buildCustomerScopeAcceptPatch(
  client: Client,
  acceptedAt: string,
  expectedPublishedRevision: number
): Partial<Client> | null {
  const check = validateCustomerScopeAcceptance(client, expectedPublishedRevision);
  if (!check.ok) return null;
  const rev = client.publishedScopeRevision!;
  return {
    scopeCustomerAcceptedAt: acceptedAt,
    scopeCustomerAcceptedRevision: rev,
    scopeCustomerAcceptanceSource: "customer",
    scopeChangeRequestAt: undefined,
    scopeChangeRequestNote: undefined,
    scopeAcceptanceNeedsReview: undefined,
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

export function applyPublishScopeToClient(
  client: Client,
  publishedAt: string
): Client | null {
  if (!scopeHasPublishableContent(client)) return null;
  const patch = buildScopePublishPatch(client, publishedAt);
  return { ...client, ...patch };
}

export function applyAcceptScopeToClient(
  client: Client,
  acceptedAt: string,
  expectedPublishedRevision?: number
): Client | null {
  const rev = expectedPublishedRevision ?? client.publishedScopeRevision;
  if (rev == null) return null;
  const patch = buildCustomerScopeAcceptPatch(client, acceptedAt, rev);
  if (!patch) return null;
  return { ...client, ...patch };
}

/** One-time migration: publish legacy admin scope without fabricating customer acceptance. */
export function applyScopeAcceptanceMigration(client: Client): Partial<Client> {
  if ((client.scopeMigrationVersion ?? 0) >= SCOPE_MIGRATION_VERSION) {
    return {};
  }

  const patch: Partial<Client> = { scopeMigrationVersion: SCOPE_MIGRATION_VERSION };

  const fabricatedCustomerAcceptance =
    !!client.scopeCustomerAcceptedAt &&
    client.scopeCustomerAcceptanceSource !== "customer";

  if (fabricatedCustomerAcceptance && !isHistoricalLaunchedClient(client)) {
    patch.scopeCustomerAcceptedAt = undefined;
    patch.scopeCustomerAcceptedRevision = undefined;
    patch.scopeCustomerAcceptanceSource = undefined;
    patch.scopeAcceptanceNeedsReview = true;
  }

  if (isHistoricalLaunchedClient(client) && isLegacyAdminScopeConfirmation(client)) {
    patch.scopeDepositGrandfathered = true;
  }

  if (
    client.publishedScopeRevision == null &&
    isLegacyAdminScopeConfirmation(client) &&
    !isHistoricalLaunchedClient(client) &&
    scopeHasPublishableContent(client)
  ) {
    const at = client.scopePricingConfirmedAt ?? client.createdAt;
    const revision = 1;
    patch.scopeRevision = revision;
    patch.publishedScopeRevision = revision;
    patch.scopePublishedAt = at;
    patch.publishedScopeSnapshot = buildScopeSnapshot(
      { ...client, ...patch },
      revision,
      at
    );
  }

  return patch;
}

/** @deprecated No longer fabricates customer acceptance — use applyScopeAcceptanceMigration. */
export function backfillLegacyScopePublish(client: Client): Partial<Client> {
  return applyScopeAcceptanceMigration(client);
}
