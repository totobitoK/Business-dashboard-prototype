import {
  TOKEN_REFRESH_BASE_BACKOFF_MS,
  TOKEN_REFRESH_MAX_ATTEMPTS,
  TOKEN_REFRESH_SKEW_MS,
  getQuickBooksCredentials,
} from "./config";
import { isInvalidGrant, isTransientOAuthError, refreshAccessToken } from "./intuit-oauth";
import { withBoundedBackoff } from "./retry";

export type StoredQuickBooksTokens = {
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshToken: string;
};

export type PersistedQuickBooksTokens = {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string | null;
};

export async function resolveAccessToken(params: {
  secrets: StoredQuickBooksTokens;
  now?: Date;
  forceRefresh?: boolean;
  refresh?: typeof refreshAccessToken;
  persist: (tokens: PersistedQuickBooksTokens) => Promise<boolean>;
}): Promise<string> {
  const now = params.now ?? new Date();
  const secrets = params.secrets;
  if (
    !params.forceRefresh &&
    secrets.accessToken &&
    secrets.accessTokenExpiresAt &&
    secrets.accessTokenExpiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > now.getTime()
  ) {
    return secrets.accessToken;
  }

  const credentials = getQuickBooksCredentials();
  if (!credentials) throw new Error("NOT_CONFIGURED");
  const refresh = params.refresh ?? refreshAccessToken;

  let refreshed;
  try {
    refreshed = await withBoundedBackoff(
      () =>
        refresh({
          refreshToken: secrets.refreshToken,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
        }),
      {
        attempts: TOKEN_REFRESH_MAX_ATTEMPTS,
        baseMs: TOKEN_REFRESH_BASE_BACKOFF_MS,
        retry: (error) => isTransientOAuthError(error),
      }
    );
  } catch (error) {
    if (isInvalidGrant(error)) throw new Error("RECONNECT_REQUIRED");
    if (isTransientOAuthError(error)) throw error;
    throw error;
  }

  const accessTokenExpiresAt = new Date(now.getTime() + refreshed.expiresIn * 1000).toISOString();
  const refreshTokenExpiresAt =
    refreshed.refreshTokenExpiresIn === null
      ? null
      : new Date(now.getTime() + refreshed.refreshTokenExpiresIn * 1000).toISOString();
  const persisted = await params.persist({
    refreshToken: refreshed.refreshToken,
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  });
  if (!persisted) throw new Error("SYNC_ABORTED");
  return refreshed.accessToken;
}
