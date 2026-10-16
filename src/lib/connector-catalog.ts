import type { DataSourceTool } from "./types";

/** Live OAuth/connect is only offered when availability is `available`. */
export type ConnectorAvailability = "available" | "in_development" | "planned";

export interface ConnectorCatalogEntry {
  id: DataSourceTool;
  label: string;
  shortDescription: string;
  availability: ConnectorAvailability;
  /** Short badge for marketing and settings lists */
  statusLabel: string;
  includeInMarketing: boolean;
  includeInOnboarding: boolean;
}

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    id: "google-calendar",
    label: "Google Calendar",
    shortDescription: "Schedules and appointments for operations views.",
    availability: "in_development",
    statusLabel: "In development",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "quickbooks",
    label: "QuickBooks Online",
    shortDescription: "Accounting, invoices, and financial summaries.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "google-sheets",
    label: "Google Sheets",
    shortDescription: "Spreadsheets and shared workbooks.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "square",
    label: "Square",
    shortDescription: "In-person and online payments from Square.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    shortDescription: "CRM, pipeline, and marketing contacts.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "google-ads",
    label: "Google Ads",
    shortDescription: "Paid search and campaign performance.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    shortDescription: "Facebook and Instagram advertising metrics.",
    availability: "planned",
    statusLabel: "Coming soon",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "excel-csv",
    label: "Excel / CSV",
    shortDescription: "File-based imports when a direct API is not the right fit.",
    availability: "planned",
    statusLabel: "Planned fallback",
    includeInMarketing: true,
    includeInOnboarding: true,
  },
  {
    id: "other",
    label: "Other",
    shortDescription: "Another system not listed here.",
    availability: "planned",
    statusLabel: "Tell us in notes",
    includeInMarketing: false,
    includeInOnboarding: true,
  },
];

/** Legacy intake values — still displayed when present in saved submissions. */
const LEGACY_TOOL_LABELS: Partial<Record<DataSourceTool, string>> = {
  stripe: "Stripe (your business — not RavenView billing)",
};

export const MARKETING_CONNECTORS = CONNECTOR_CATALOG.filter((c) => c.includeInMarketing);

export const ONBOARDING_CONNECTORS = CONNECTOR_CATALOG.filter((c) => c.includeInOnboarding);

export function getConnectorById(id: string): ConnectorCatalogEntry | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}

export function connectorCanConnect(availability: ConnectorAvailability): boolean {
  return availability === "available";
}

export function buildToolLabels(): Record<DataSourceTool, string> {
  const labels = Object.fromEntries(CONNECTOR_CATALOG.map((c) => [c.id, c.label])) as Record<
    string,
    string
  >;
  labels.stripe = LEGACY_TOOL_LABELS.stripe ?? "Stripe";
  return labels as Record<DataSourceTool, string>;
}

export const CONNECTOR_TOOL_LABELS = buildToolLabels();
