/**
 * Central brand configuration.
 * Update this file to rebrand the app — routes, client records, and
 * browser-storage keys are intentionally not derived from these values.
 */
export const branding = {
  name: "RavenView",
  fullName: "RavenView Dashboards",
  tagline: "Your entire business. One clear view.",
  /** Two-part wordmark styling (text-only logo). */
  wordmark: {
    primary: "Raven",
    accent: "View",
  },
  /** Descriptive product area label — separate from the brand name. */
  productArea: "Client Operations",
} as const;

export function getTaglineParts(): { lead: string; accent: string } {
  const splitAt = branding.tagline.indexOf(". ");
  if (splitAt === -1) {
    return { lead: branding.tagline, accent: "" };
  }
  return {
    lead: branding.tagline.slice(0, splitAt + 1),
    accent: branding.tagline.slice(splitAt + 2),
  };
}

export function getMarketingPageTitle(): string {
  return `${branding.fullName} | ${branding.tagline}`;
}

export function getAdminPageTitle(): string {
  return `${branding.name} | ${branding.productArea}`;
}

export function getMarketingDescription(): string {
  return `${branding.name} builds custom business dashboards that bring your key metrics, operations, and data into one clear view.`;
}

export function getAdminDescription(): string {
  return `${branding.name} ${branding.productArea.toLowerCase()} dashboard — demo prototype`;
}
