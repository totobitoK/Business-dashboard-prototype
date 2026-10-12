import { getCustomerFacingScope } from "./scope-acceptance";
import type { Client } from "./types";

/** Customer-visible open requests — only when recorded on the client. */
export function getOutstandingCustomerRequests(client: Client): string[] {
  const items: string[] = [];
  if (client.previewFeedbackUnresolved && client.previewChangeRequest?.trim()) {
    items.push(client.previewChangeRequest.trim());
  }
  if (client.scopeChangeRequestAt && client.scopeChangeRequestNote?.trim()) {
    items.push(client.scopeChangeRequestNote.trim());
  }
  return items;
}

export function getAgreedScopeToolLabels(client: Client): string[] {
  const published = getCustomerFacingScope(client);
  if (published?.acceptedSourcesIn?.length) {
    return published.acceptedSourcesIn;
  }
  return client.acceptedSourcesIn ?? [];
}
