/**
 * QuickBooks Online connector.
 *
 * OAuth endpoints confirmed from Intuit's discovery documents (same for sandbox
 * and production; only the userinfo host differs):
 * - https://developer.api.intuit.com/.well-known/openid_sandbox_configuration
 * - https://developer.api.intuit.com/.well-known/openid_configuration
 * authorization_endpoint: https://appcenter.intuit.com/connect/oauth2
 * token_endpoint: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 * revocation_endpoint: https://developer.api.intuit.com/v2/oauth2/tokens/revoke
 *
 * Accounting data hosts are separate from those OAuth URLs:
 * - sandbox: https://sandbox-quickbooks.api.intuit.com
 * - production: https://quickbooks.api.intuit.com
 *
 * Scope is Accounting only. This milestone issues GET requests to the Accounting
 * API. Token exchange, refresh, and revoke use the OAuth endpoints above.
 * Intuit refresh tokens rotate; persist every new refresh token.
 * Access tokens last about 60 minutes (expires_in). Refresh tokens carry
 * x_refresh_token_expires_in (about 100 days) and must be used before then.
 */

export type IntuitEnvironment = "sandbox" | "production";

export const QUICKBOOKS_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";

export const INTUIT_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const INTUIT_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export const QUICKBOOKS_MINOR_VERSION = "75";
export const QBO_INVOICE_PAGE_SIZE = 1000;
export const QBO_MAX_INVOICE_PAGES = 100;

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const SYNC_LOCK_TTL_SECONDS = 300;
export const TOKEN_REFRESH_SKEW_MS = 60_000;
export const TOKEN_REFRESH_MAX_ATTEMPTS = 3;
export const TOKEN_REFRESH_BASE_BACKOFF_MS = 400;
export const STALE_SUCCESSFUL_SYNC_MS = 24 * 60 * 60 * 1000;
export const SYNC_STUCK_MS = 10 * 60 * 1000;

const SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com";
const PRODUCTION_API_BASE = "https://quickbooks.api.intuit.com";

export function getQuickBooksEnvironment(): IntuitEnvironment | null {
  const raw = process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  return null;
}

export function quickBooksApiBase(environment: IntuitEnvironment): string {
  return environment === "sandbox" ? SANDBOX_API_BASE : PRODUCTION_API_BASE;
}

export type QuickBooksCredentials = {
  environment: IntuitEnvironment;
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
};

export function getQuickBooksCredentials(): QuickBooksCredentials | null {
  const environment = getQuickBooksEnvironment();
  if (!environment) return null;
  const prefix = environment === "sandbox" ? "QUICKBOOKS_SANDBOX" : "QUICKBOOKS_PRODUCTION";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim() ?? "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim() ?? "";
  const encryptionKey = process.env[`${prefix}_TOKEN_ENCRYPTION_KEY`]?.trim() ?? "";
  if (!clientId || !clientSecret || encryptionKey.length < 32) return null;
  return { environment, clientId, clientSecret, encryptionKey };
}

/** Customer connect. Stays closed until this deployment is explicitly verified. */
export function isQuickBooksCustomerConnectAllowed(): boolean {
  return (
    process.env.QUICKBOOKS_INTEGRATION_ENABLED === "true" &&
    process.env.QUICKBOOKS_CONNECTOR_VERIFIED === "true" &&
    getQuickBooksCredentials() !== null
  );
}

/**
 * Sandbox QA only. Ignored unless QUICKBOOKS_ENVIRONMENT=sandbox.
 * This does not mark the connector verified and does not change the public catalog.
 */
export function isQuickBooksSandboxQaAllowed(): boolean {
  return (
    getQuickBooksEnvironment() === "sandbox" &&
    process.env.QUICKBOOKS_SANDBOX_QA === "true" &&
    getQuickBooksCredentials() !== null
  );
}

/** Connect for a verified customer deployment, or for an explicit sandbox QA session. */
export function isQuickBooksConnectAllowed(): boolean {
  return isQuickBooksCustomerConnectAllowed() || isQuickBooksSandboxQaAllowed();
}

export function getQuickBooksRedirectUri(origin: string): string {
  const configured = process.env.QUICKBOOKS_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/integrations/quickbooks/callback`;
}

export function stateHmacSecret(): string {
  const dedicated = process.env.QUICKBOOKS_OAUTH_STATE_SECRET?.trim();
  if (dedicated) return dedicated;
  const credentials = getQuickBooksCredentials();
  if (!credentials) throw new Error("Missing OAuth state secret.");
  return credentials.encryptionKey;
}

export function buildQuickBooksAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): URL {
  const url = new URL(INTUIT_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QUICKBOOKS_ACCOUNTING_SCOPE);
  url.searchParams.set("state", params.state);
  return url;
}
