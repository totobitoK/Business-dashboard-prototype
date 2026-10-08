import type { DataSourceTool } from "./types";

export const marketingConnectionsHref = "#integrations";

/** Sources shown on marketing — aligned with onboarding tool options. */
export const MARKETING_DATA_SOURCES: {
  id: DataSourceTool | "csv-import";
  label: string;
  status: string;
}[] = [
  { id: "quickbooks", label: "QuickBooks Online", status: "In development" },
  { id: "google-calendar", label: "Google Calendar", status: "In development" },
  { id: "excel-csv", label: "Excel / CSV", status: "Planned fallback" },
  { id: "google-sheets", label: "Google Sheets", status: "As agreed in scope" },
  { id: "hubspot", label: "HubSpot", status: "As agreed in scope" },
];
