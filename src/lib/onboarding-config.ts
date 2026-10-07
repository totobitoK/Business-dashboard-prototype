/** Default discovery call booking (override with NEXT_PUBLIC_DISCOVERY_SCHEDULING_URL). */
export const DEFAULT_DISCOVERY_SCHEDULING_URL =
  "https://calendly.com/bookwithravenview";

/**
 * Client onboarding configuration (non-brand).
 * Set NEXT_PUBLIC_DISCOVERY_SCHEDULING_URL to override the default Calendly link.
 */
export function getDiscoverySchedulingUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DISCOVERY_SCHEDULING_URL?.trim();
  return fromEnv || DEFAULT_DISCOVERY_SCHEDULING_URL;
}
