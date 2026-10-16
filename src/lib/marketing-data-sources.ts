import { getPublicMarketingConnectors, getPublicStatusBadge } from "./connector-presentation";

export const marketingConnectionsHref = "#integrations";

/** Public marketing list — empty during private build until connectors are operational. */
export const MARKETING_DATA_SOURCES = getPublicMarketingConnectors().map((c) => ({
  id: c.id,
  label: c.label,
  description: c.shortDescription,
  status: getPublicStatusBadge(c),
}));
