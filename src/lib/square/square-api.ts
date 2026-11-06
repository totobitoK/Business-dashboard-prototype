import { SQUARE_VERSION, squareHost, type SquareEnvironment } from "./config";
import { withBoundedBackoff } from "./retry";

export class SquareApiError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(code);
    this.name = "SquareApiError";
  }
}

export type SquareTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  merchantId: string;
};

type ErrorBody = { errors?: Array<{ code?: string }> };

function errorCode(status: number, body: ErrorBody | null): string {
  return body?.errors?.[0]?.code || `HTTP_${status}`;
}

export function isTransientSquareError(error: unknown): boolean {
  if (!(error instanceof SquareApiError)) return false;
  return error.status === 429 || error.status >= 500;
}

export function isSquareAuthError(error: unknown): boolean {
  if (!(error instanceof SquareApiError)) return false;
  return (
    error.status === 401 ||
    error.code === "UNAUTHORIZED" ||
    error.code === "ACCESS_TOKEN_EXPIRED" ||
    error.code === "ACCESS_TOKEN_REVOKED"
  );
}

async function readError(response: Response): Promise<SquareApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new SquareApiError(response.status, errorCode(response.status, body));
}

export async function exchangeAuthorizationCode(params: {
  environment: SquareEnvironment;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<SquareTokenSet> {
  return obtainToken(params.environment, {
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(params: {
  environment: SquareEnvironment;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<SquareTokenSet> {
  return withBoundedBackoff(
    () =>
      obtainToken(params.environment, {
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: "refresh_token",
      }),
    { attempts: 3, baseMs: 400, retry: isTransientSquareError }
  );
}

async function obtainToken(
  environment: SquareEnvironment,
  body: Record<string, string>
): Promise<SquareTokenSet> {
  const response = await fetch(new URL("/oauth2/token", squareHost(environment)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response);
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    merchant_id?: string;
  };
  if (!json.access_token || !json.refresh_token || !json.expires_at || !json.merchant_id) {
    throw new SquareApiError(response.status, "TOKEN_RESPONSE_INCOMPLETE");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
    merchantId: json.merchant_id,
  };
}

export async function revokeAccessToken(params: {
  environment: SquareEnvironment;
  clientId: string;
  clientSecret: string;
  accessToken: string;
}): Promise<void> {
  const response = await fetch(new URL("/oauth2/revoke", squareHost(params.environment)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      Authorization: `Client ${params.clientSecret}`,
    },
    body: JSON.stringify({
      client_id: params.clientId,
      access_token: params.accessToken,
    }),
  });
  if (!response.ok && response.status !== 404) throw await readError(response);
}

export async function squareGet(params: {
  environment: SquareEnvironment;
  accessToken: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<unknown> {
  const url = new URL(params.path, squareHost(params.environment));
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw await readError(response);
  return response.json();
}
