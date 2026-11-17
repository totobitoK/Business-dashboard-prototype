/**
 * Jobber scheduling connection. Not enabled until a test account confirms the
 * query, scopes, and API version in GraphiQL.
 *
 * Public docs checked on 2026-11-16, not against a RavenView account:
 * - GraphQL POST https://api.getjobber.com/api/graphql
 * - Every request needs Authorization and X-JOBBER-GRAPHQL-VERSION.
 *   The docs example uses 2025-04-16. Confirm the active version before sync.
 * - Access tokens expire after 60 minutes.
 * - When the refresh response includes a new refresh token, store that one
 *   and discard the previous token.
 * - OAuth scope identifiers and a visit web URL were not confirmed.
 */

export const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
export const JOBBER_OAUTH_AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
export const JOBBER_OAUTH_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";

export function isJobberIntegrationConfigured(): boolean {
  return (
    process.env.JOBBER_INTEGRATION_ENABLED === "true" &&
    Boolean(process.env.JOBBER_CLIENT_ID) &&
    Boolean(process.env.JOBBER_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.JOBBER_TOKEN_ENCRYPTION_KEY)
  );
}

export function jobberGraphqlVersion(): string | null {
  const version = process.env.JOBBER_GRAPHQL_VERSION?.trim();
  return version || null;
}

/** Scope string from the Developer Center app. Empty until GraphiQL confirms the minimum read set. */
export function jobberReadScopes(): string {
  return process.env.JOBBER_OAUTH_SCOPES?.trim() ?? "";
}

export type JobberTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

/** Jobber rotates refresh tokens. Keep the newest one. */
export function nextJobberRefreshToken(previous: string, response: JobberTokenResponse): string {
  const rotated = response.refresh_token?.trim();
  return rotated || previous;
}
