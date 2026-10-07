import type { Client, ClientStatus } from "./types";

export type ScopeCardStatus = "onboarding" | "active" | "paused";
export type SetupStatus = "not_invoiced" | "invoiced" | "paid";

/** Agent contract — fixed field set for scope-card JSON exports. */
export interface ScopeCard {
  client_id: string;
  name: string;
  owner_email: string;
  status: ScopeCardStatus;
  sources_in: string[] | null;
  sources_out: string[] | null;
  screens: string[] | null;
  dashboard_url: string | null;
  file_url: string | null;
  setup_fee: number;
  setup_status: SetupStatus;
  monthly_fee: number;
  monthly_includes: string | null;
  mrr_start: string | null;
  card_version: number;
  updated_at: string;
}

const STATUS_MAP: Record<ClientStatus, ScopeCardStatus> = {
  pending: "onboarding",
  active: "active",
  archived: "paused",
};

export function mapClientStatusToScopeCard(
  status: ClientStatus
): ScopeCardStatus {
  return STATUS_MAP[status];
}

export function deriveSetupStatus(client: Client): SetupStatus {
  if (client.setupPaidAmount >= client.setupFee && client.setupFee > 0) {
    return "paid";
  }
  return "not_invoiced";
}

function nonEmptyList(values?: string[]): string[] | null {
  if (!values?.length) return null;
  const trimmed = values.map((v) => v.trim()).filter(Boolean);
  return trimmed.length ? trimmed : null;
}

/** Build scope-card projection from CRM client. Does not infer sources or screens. */
export function buildScopeCard(
  client: Client,
  cardVersion: number,
  updatedAt = new Date().toISOString()
): ScopeCard {
  return {
    client_id: client.id,
    name: client.company,
    owner_email: client.email,
    status: mapClientStatusToScopeCard(client.status),
    sources_in: nonEmptyList(client.acceptedSourcesIn),
    sources_out: null,
    screens: nonEmptyList(client.acceptedScreens),
    dashboard_url: client.dashboardUrl ?? null,
    file_url: null,
    setup_fee: client.setupFee,
    setup_status: deriveSetupStatus(client),
    monthly_fee: client.monthlyFee,
    monthly_includes: null,
    mrr_start: null,
    card_version: cardVersion,
    updated_at: updatedAt,
  };
}

/** Compare export payload excluding version and timestamp. */
export function scopeCardContentEquals(a: ScopeCard, b: ScopeCard): boolean {
  return (
    a.client_id === b.client_id &&
    a.name === b.name &&
    a.owner_email === b.owner_email &&
    a.status === b.status &&
    listEqual(a.sources_in, b.sources_in) &&
    listEqual(a.sources_out, b.sources_out) &&
    listEqual(a.screens, b.screens) &&
    a.dashboard_url === b.dashboard_url &&
    a.file_url === b.file_url &&
    a.setup_fee === b.setup_fee &&
    a.setup_status === b.setup_status &&
    a.monthly_fee === b.monthly_fee &&
    a.monthly_includes === b.monthly_includes &&
    a.mrr_start === b.mrr_start
  );
}

function listEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export function sanitizeClientIdForPath(clientId: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(clientId)) return null;
  return clientId;
}
