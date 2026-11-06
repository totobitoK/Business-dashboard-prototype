import { INTUIT_REVOKE_URL, INTUIT_TOKEN_URL } from "./config";

export class IntuitOAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type IntuitTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshTokenExpiresIn: number | null;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  error?: string;
};

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function postToken(
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch
): Promise<IntuitTokenSet> {
  const response = await fetchImpl(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || payload.error || !payload.access_token) {
    throw new IntuitOAuthError(payload.error || "token_request_failed", response.status);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? "",
    expiresIn: payload.expires_in ?? 3600,
    refreshTokenExpiresIn:
      typeof payload.x_refresh_token_expires_in === "number"
        ? payload.x_refresh_token_expires_in
        : null,
  };
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<IntuitTokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const tokens = await postToken(
    body,
    params.clientId,
    params.clientSecret,
    params.fetchImpl ?? fetch
  );
  if (!tokens.refreshToken) {
    throw new IntuitOAuthError("missing_refresh_token", 200);
  }
  return tokens;
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<IntuitTokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const tokens = await postToken(
    body,
    params.clientId,
    params.clientSecret,
    params.fetchImpl ?? fetch
  );
  if (!tokens.refreshToken) {
    tokens.refreshToken = params.refreshToken;
  }
  return tokens;
}

export function isInvalidGrant(error: unknown): boolean {
  return error instanceof IntuitOAuthError && error.code === "invalid_grant";
}

export function isTransientOAuthError(error: unknown): boolean {
  if (!(error instanceof IntuitOAuthError)) return false;
  return error.status === 429 || error.status >= 500;
}

export async function revokeRefreshToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = params.fetchImpl ?? fetch;
  await fetchImpl(INTUIT_REVOKE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: basicAuth(params.clientId, params.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: params.refreshToken }),
  });
}
