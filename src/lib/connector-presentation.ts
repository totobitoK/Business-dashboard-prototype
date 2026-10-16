import {
  CONNECTOR_DEFINITIONS,
  type ConnectorDefinition,
  type ConnectorImplementationStatus,
} from "./connector-catalog";
import { isGoogleCalendarIntegrationConfigured } from "./google-calendar/config";

/** Customer-facing site phase — separate from internal engineering status. */
export type ConnectorPublicPhase = "private_build" | "launch";

export function getConnectorPublicPhase(): ConnectorPublicPhase {
  const raw = process.env.NEXT_PUBLIC_CONNECTOR_PUBLIC_PHASE?.trim().toLowerCase();
  return raw === "launch" ? "launch" : "private_build";
}

/** Connect when engineering status is operational and runtime env is configured (per provider). */
export function connectorCanConnect(entry: ConnectorDefinition): boolean {
  if (entry.implementationStatus !== "operational") return false;
  if (entry.id === "google-calendar") {
    return isGoogleCalendarIntegrationConfigured();
  }
  return true;
}

/**
 * Marketing / hero / integrations: during private build, hide all candidates.
 * At launch, show operational connectors only, plus optional deliberate "coming soon" teasers.
 */
export function getPublicMarketingConnectors(
  phase: ConnectorPublicPhase = getConnectorPublicPhase()
): ConnectorDefinition[] {
  if (phase === "private_build") {
    return [];
  }
  return CONNECTOR_DEFINITIONS.filter((c) => {
    if (c.implementationStatus === "operational") return true;
    return c.publicTeaser === "coming_soon";
  });
}

/** Onboarding interest capture — internal candidates, no public status badges. */
export function getOnboardingConnectorChoices(): ConnectorDefinition[] {
  return CONNECTOR_DEFINITIONS.filter((c) => c.includeInOnboarding);
}

/** Public status chip — suppressed during private build; at launch only for deliberate teasers. */
export function getPublicStatusBadge(
  entry: ConnectorDefinition,
  phase: ConnectorPublicPhase = getConnectorPublicPhase()
): string | null {
  if (phase === "private_build") return null;
  if (entry.implementationStatus === "operational") return null;
  if (entry.publicTeaser === "coming_soon") return "Coming soon";
  return null;
}

export function shouldShowPublicConnectorCatalog(
  phase: ConnectorPublicPhase = getConnectorPublicPhase()
): boolean {
  return getPublicMarketingConnectors(phase).length > 0;
}

export function isInternalCandidate(status: ConnectorImplementationStatus): boolean {
  return status === "candidate" || status === "in_development" || status === "configured";
}
