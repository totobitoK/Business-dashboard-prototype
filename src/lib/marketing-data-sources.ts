import { MARKETING_CONNECTORS } from "./connector-catalog";

export const marketingConnectionsHref = "#integrations";

/** Sources shown on marketing — derived from the shared connector catalog. */
export const MARKETING_DATA_SOURCES = MARKETING_CONNECTORS.map((c) => ({
  id: c.id,
  label: c.label,
  status: c.statusLabel,
  description: c.shortDescription,
}));
