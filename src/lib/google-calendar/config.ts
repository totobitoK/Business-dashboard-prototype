/**
 * Google Calendar integration (Milestone 4A).
 *
 * OAuth (verify against current Google docs):
 * - Scopes: calendar.readonly (calendar list + events read), openid, email, profile
 * - access_type=offline, prompt=consent on first connect for refresh token
 *
 * Testing mode (Google Cloud OAuth consent screen):
 * - Refresh tokens may expire after 7 days while app is unverified.
 * - Production verification required for unrestricted refresh token lifetime.
 * - Google may revoke access; customers must reconnect when refresh fails permanently.
 *
 * Incremental sync: events.list with syncToken must not combine timeMin/timeMax (API restriction).
 * HTTP 410 on syncToken → full resync for that calendar within the configured import window.
 */

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/** Rolling import window for full sync / 410 recovery (days). */
export const IMPORT_WINDOW_PAST_DAYS = 30;
export const IMPORT_WINDOW_FUTURE_DAYS = 180;

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const SYNC_LOCK_TTL_MS = 5 * 60 * 1000;

export function isGoogleCalendarIntegrationConfigured(): boolean {
  return (
    process.env.GOOGLE_CALENDAR_INTEGRATION_ENABLED === "true" &&
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)
  );
}

export function getGoogleRedirectUri(origin: string): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
}
