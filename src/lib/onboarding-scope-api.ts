import type { Client } from "@/lib/types";

export type OnboardingScopeApi = {
  acceptCustomerScopePricing: (
    projectId: string,
    expectedPublishedRevision: number,
    scopeRevisionRowId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  requestCustomerScopeChanges: (
    projectId: string,
    revision: number,
    note: string
  ) => Promise<{ ok: boolean; error?: string }>;
};

type DemoScopeStore = {
  acceptCustomerScopePricing: (
    id: string,
    expectedPublishedRevision: number
  ) => { ok: boolean; error?: string };
  requestCustomerScopeChanges: (
    id: string,
    note: string
  ) => { ok: boolean; error?: string };
};

export function createDemoScopeApi(store: DemoScopeStore): OnboardingScopeApi {
  return {
    async acceptCustomerScopePricing(id, rev) {
      return store.acceptCustomerScopePricing(id, rev);
    },
    async requestCustomerScopeChanges(id, _rev, note) {
      return store.requestCustomerScopeChanges(id, note);
    },
  };
}

export function scopeRevisionRowIdFromClient(client: Client): string | undefined {
  return client.publishedScopeSnapshot?.revisionRowId;
}
