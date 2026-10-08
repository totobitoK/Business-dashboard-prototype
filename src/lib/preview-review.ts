import type { Client, ClientMilestone } from "./types";

export const DEFAULT_PREVIEW_REVISION = 1;

export function getCurrentPreviewRevision(client: Client): number {
  return client.previewRevisionVersion ?? DEFAULT_PREVIEW_REVISION;
}

export function isPreviewApprovedForCurrentRevision(client: Client): boolean {
  if (!client.previewApprovedAt) return false;
  const approvedRev = client.previewApprovedRevision ?? DEFAULT_PREVIEW_REVISION;
  return approvedRev === getCurrentPreviewRevision(client);
}

export function hasUnresolvedPreviewFeedback(client: Client): boolean {
  return client.previewFeedbackUnresolved === true;
}

export function buildPreviewInvalidationPatch(
  client: Client,
  reason: string
): Partial<Client> {
  const admin = new Set(client.adminCompletedMilestones ?? []);
  admin.delete("client-review" as ClientMilestone);
  return {
    previewApprovedAt: undefined,
    previewApprovedRevision: undefined,
    previewFeedbackUnresolved: true,
    adminCompletedMilestones: [...admin],
    notes: [
      {
        id: `note-${Date.now()}`,
        date: new Date().toISOString(),
        content: reason,
      },
      ...client.notes,
    ],
  };
}
