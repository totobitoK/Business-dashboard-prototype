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

/** Re-run full window sync when anchor is older than this (advances rolling window). */
export const IMPORT_WINDOW_ROLL_MS = 24 * 60 * 60 * 1000;

export const SYNC_RUN_TIME_BUDGET_MS = 50_000;
export const STALE_SYNCING_RECOVERY_MS = 10 * 60 * 1000;
export const TOKEN_REFRESH_MAX_ATTEMPTS = 3;
export const TOKEN_REFRESH_BASE_BACKOFF_MS = 400;

/** Vercel cron: see vercel.json (default every 15 minutes). */
export const SYNC_CRON_INTERVAL_MINUTES = 15;
export const SYNC_CRON_MAX_COMPANIES_PER_RUN = 5;

/**
 * Scheduled refresh capacity (approximate):
 * At most SYNC_CRON_MAX_COMPANIES_PER_RUN companies complete a sync pass per cron tick.
 * With a 15-minute cron, each company is refreshed about every (N / 5) × 15 minutes
 * when N companies have selected calendars and healthy connections.
 */
export function estimatedSyncRefreshMinutes(connectedCompaniesWithSelection: number): number {
  if (connectedCompaniesWithSelection <= 0) return 0;
  const batches = Math.ceil(connectedCompaniesWithSelection / SYNC_CRON_MAX_COMPANIES_PER_RUN);
  return batches * SYNC_CRON_INTERVAL_MINUTES;
}

/** Internal QA only — customers stay on in_development until OAuth verification. */
export function isGoogleCalendarInternalConnectEnabled(): boolean {
  return process.env.GOOGLE_CALENDAR_INTERNAL_CONNECT_ENABLED === "true";
}

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
