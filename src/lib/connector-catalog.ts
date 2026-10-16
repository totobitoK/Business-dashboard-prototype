import type { DataSourceTool } from "./types";

/**
 * Internal engineering status — not shown on public marketing during private build.
 * Before implementing any provider, verify official API docs (data, OAuth scopes,
 * production approval, quotas, pricing). Do not infer support from name/logo alone.
 */
export type ConnectorImplementationStatus =
  | "candidate"
  | "in_development"
  | "configured"
  | "operational";

/** Launch-only public teaser when not yet operational (opt-in per connector). */
export type ConnectorPublicTeaser = "hidden" | "coming_soon";

export interface ConnectorDefinition {
  id: DataSourceTool;
  label: string;
  shortDescription: string;
  implementationStatus: ConnectorImplementationStatus;
  /** Lower = earlier build priority (Google Calendar = 1). */
  implementationPriority: number;
  publicTeaser: ConnectorPublicTeaser;
  includeInOnboarding: boolean;
  /**
   * Platform app review / production access can take weeks — start early where applicable.
   * Does not imply API integration is complete.
   */
  earlyExternalApproval?: boolean;
}

/** Seven researched data providers (+ file fallback and other). None are operational yet. */
export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    id: "google-calendar",
    label: "Google Calendar",
    shortDescription: "Schedules and appointments for operations views.",
    implementationStatus: "operational",
    implementationPriority: 1,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "quickbooks",
    label: "QuickBooks Online",
    shortDescription: "Accounting, invoices, and financial summaries.",
    implementationStatus: "candidate",
    implementationPriority: 2,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "google-sheets",
    label: "Google Sheets",
    shortDescription: "Spreadsheets and shared workbooks.",
    implementationStatus: "candidate",
    implementationPriority: 3,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "square",
    label: "Square",
    shortDescription: "In-person and online payments from Square.",
    implementationStatus: "candidate",
    implementationPriority: 4,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    shortDescription: "CRM, pipeline, and marketing contacts.",
    implementationStatus: "candidate",
    implementationPriority: 5,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "google-ads",
    label: "Google Ads",
    shortDescription: "Paid search and campaign performance.",
    implementationStatus: "candidate",
    implementationPriority: 6,
    publicTeaser: "hidden",
    includeInOnboarding: true,
    earlyExternalApproval: true,
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    shortDescription: "Facebook and Instagram advertising metrics.",
    implementationStatus: "candidate",
    implementationPriority: 7,
    publicTeaser: "hidden",
    includeInOnboarding: true,
    earlyExternalApproval: true,
  },
  {
    id: "excel-csv",
    label: "Excel / CSV",
    shortDescription: "File-based imports when a direct API is not the right fit.",
    implementationStatus: "candidate",
    implementationPriority: 8,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
  {
    id: "other",
    label: "Other",
    shortDescription: "Another system not listed here.",
    implementationStatus: "candidate",
    implementationPriority: 99,
    publicTeaser: "hidden",
    includeInOnboarding: true,
  },
];

/** @deprecated Use CONNECTOR_DEFINITIONS — kept for tests migrating off old export name. */
export const CONNECTOR_CATALOG = CONNECTOR_DEFINITIONS;

/** Legacy intake values — still displayed when present in saved submissions. */
const LEGACY_TOOL_LABELS: Partial<Record<DataSourceTool, string>> = {
  stripe: "Stripe (your business — not RavenView billing)",
};

export function getConnectorById(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_DEFINITIONS.find((c) => c.id === id);
}

export function connectorsPendingEarlyExternalApproval(): ConnectorDefinition[] {
  return CONNECTOR_DEFINITIONS.filter((c) => c.earlyExternalApproval);
}

export function buildToolLabels(): Record<DataSourceTool, string> {
  const labels = Object.fromEntries(CONNECTOR_DEFINITIONS.map((c) => [c.id, c.label])) as Record<
    string,
    string
  >;
  labels.stripe = LEGACY_TOOL_LABELS.stripe ?? "Stripe";
  return labels as Record<DataSourceTool, string>;
}

export const CONNECTOR_TOOL_LABELS = buildToolLabels();

/** Illustration-only labels for marketing previews — not the operational connector catalog. */
export const MARKETING_ILLUSTRATION_SOURCE_LABELS = [
  "Accounting (example)",
  "Calendar (example)",
  "CRM (example)",
] as const;
