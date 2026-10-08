/** Demo workspace IDs — each maps 1:1 to a CRM client record. */
export const WORKSPACE_ALPINE_HVAC = "ws-alpine-hvac";
export const WORKSPACE_MERIDIAN_RETAIL = "ws-meridian-retail";

export interface CustomerWorkspaceMeta {
  id: string;
  label: string;
  clientId: string;
  description: string;
}

export const CUSTOMER_DEMO_WORKSPACES: CustomerWorkspaceMeta[] = [
  {
    id: WORKSPACE_ALPINE_HVAC,
    label: "Alpine Comfort HVAC",
    clientId: "client-8",
    description: "QuickBooks Online + Google Calendar — preview-ready demo",
  },
  {
    id: WORKSPACE_MERIDIAN_RETAIL,
    label: "Meridian Home Goods",
    clientId: "client-9",
    description: "Google Sheets + HubSpot — guided setup demo",
  },
];

export function getWorkspaceById(id: string): CustomerWorkspaceMeta | undefined {
  return CUSTOMER_DEMO_WORKSPACES.find((w) => w.id === id);
}

export function getWorkspaceForClientId(clientId: string): CustomerWorkspaceMeta | undefined {
  return CUSTOMER_DEMO_WORKSPACES.find((w) => w.clientId === clientId);
}

export function isValidWorkspaceId(id: string): boolean {
  return CUSTOMER_DEMO_WORKSPACES.some((w) => w.id === id);
}

export function getDefaultWorkspaceId(): string {
  return WORKSPACE_ALPINE_HVAC;
}
