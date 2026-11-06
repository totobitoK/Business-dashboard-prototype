/**
 * Square connector.
 *
 * OAuth and the data API share a host, and sandbox is a different host
 * from production. Confirmed from Square's OAuth overview:
 * - sandbox: https://connect.squareupsandbox.com
 * - production: https://connect.squareup.com
 * Authorize: {host}/oauth2/authorize
 * Token: {host}/oauth2/token
 * Revoke: {host}/oauth2/revoke
 *
 * The seller redirect URL is registered on the Square application. Sandbox
 * accepts http://localhost. This milestone requests only
 * MERCHANT_PROFILE_READ and PAYMENTS_READ, and it only GETs locations,
 * payments, and refunds. Token exchange, refresh, and revoke are the
 * exceptions. Code-flow refresh tokens do not expire and are returned
 * unchanged. Access tokens last about 30 days. Square asks apps to renew
 * them at least every 7 days.
 *
 * Square-Version 2026-09-16 is the version on the current Locations and
 * Refunds examples.
 */

export type SquareEnvironment = "sandbox" | "production";

export const SQUARE_SCOPES = "MERCHANT_PROFILE_READ PAYMENTS_READ";
export const SQUARE_VERSION = "2026-09-16";
export const SQUARE_PAGE_SIZE = 100;
export const SQUARE_MAX_PAGES = 50;
export const SQUARE_IMPORT_LOOKBACK_DAYS = 366;

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const SYNC_LOCK_TTL_SECONDS = 300;
export const TOKEN_RENEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const TOKEN_EXPIRY_SKEW_MS = 24 * 60 * 60 * 1000;
export const STALE_SUCCESSFUL_SYNC_MS = 24 * 60 * 60 * 1000;
export const SYNC_STUCK_MS = 10 * 60 * 1000;

const SANDBOX_HOST = "https://connect.squareupsandbox.com";
const PRODUCTION_HOST = "https://connect.squareup.com";

export function getSquareEnvironment(): SquareEnvironment | null {
  const raw = process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  return null;
}

export function squareHost(environment: SquareEnvironment): string {
  return environment === "sandbox" ? SANDBOX_HOST : PRODUCTION_HOST;
}

export type SquareCredentials = {
  environment: SquareEnvironment;
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
};

export function getSquareCredentials(): SquareCredentials | null {
  const environment = getSquareEnvironment();
  if (!environment) return null;
  const prefix = environment === "sandbox" ? "SQUARE_SANDBOX" : "SQUARE_PRODUCTION";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim() ?? "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim() ?? "";
  const encryptionKey = process.env[`${prefix}_TOKEN_ENCRYPTION_KEY`]?.trim() ?? "";
  if (!clientId || !clientSecret || encryptionKey.length < 32) return null;
  return { environment, clientId, clientSecret, encryptionKey };
}

/** Customer connect. Stays closed until this deployment is explicitly verified. */
export function isSquareCustomerConnectAllowed(): boolean {
  return (
    process.env.SQUARE_INTEGRATION_ENABLED === "true" &&
    process.env.SQUARE_CONNECTOR_VERIFIED === "true" &&
    getSquareCredentials() !== null
  );
}

/**
 * Sandbox QA only. Ignored unless SQUARE_ENVIRONMENT=sandbox.
 * This does not mark the connector verified and does not change the public catalog.
 */
export function isSquareSandboxQaAllowed(): boolean {
  return (
    getSquareEnvironment() === "sandbox" &&
    process.env.SQUARE_SANDBOX_QA === "true" &&
    getSquareCredentials() !== null
  );
}

export function isSquareConnectAllowed(): boolean {
  return isSquareCustomerConnectAllowed() || isSquareSandboxQaAllowed();
}

export function getSquareRedirectUri(origin: string): string {
  const configured = process.env.SQUARE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/integrations/square/callback`;
}

export function stateHmacSecret(): string {
  const dedicated = process.env.SQUARE_OAUTH_STATE_SECRET?.trim();
  if (dedicated) return dedicated;
  const credentials = getSquareCredentials();
  if (!credentials) throw new Error("Missing OAuth state secret.");
  return credentials.encryptionKey;
}

export function buildSquareAuthorizeUrl(params: { clientId: string; state: string; environment: SquareEnvironment }): URL {
  const url = new URL("/oauth2/authorize", squareHost(params.environment));
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("scope", SQUARE_SCOPES);
  url.searchParams.set("state", params.state);
  return url;
}
