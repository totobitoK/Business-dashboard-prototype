import type { Client, PublishedScopeSnapshot } from "./types";

/** Demo seed: published customer scope snapshot (optional acceptance). */
export function demoCustomerScopePublish(
  client: Pick<
    Client,
    | "setupFee"
    | "monthlyFee"
    | "acceptedSourcesIn"
    | "acceptedScreens"
    | "agreedScopeSummary"
    | "dashboardScope"
  >,
  publishedAt: string,
  customerAccepted: boolean
): Partial<Client> {
  const revision = 1;
  const snapshot: PublishedScopeSnapshot = {
    revision,
    publishedAt,
    setupFee: client.setupFee,
    monthlyFee: client.monthlyFee,
    acceptedSourcesIn: [...(client.acceptedSourcesIn ?? [])],
    acceptedScreens: [...(client.acceptedScreens ?? [])],
    agreedScopeSummary: client.agreedScopeSummary,
    dashboardScope: client.dashboardScope,
  };
  return {
    scopeRevision: revision,
    publishedScopeRevision: revision,
    scopePublishedAt: publishedAt,
    publishedScopeSnapshot: snapshot,
    scopeMigrationVersion: 1,
    ...(customerAccepted
      ? {
          scopeCustomerAcceptedAt: publishedAt,
          scopeCustomerAcceptedRevision: revision,
          scopeCustomerAcceptanceSource: "customer" as const,
        }
      : {}),
  };
}
