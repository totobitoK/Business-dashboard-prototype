import { TOKEN_EXPIRY_SKEW_MS, TOKEN_RENEW_AFTER_MS } from "./config";

/** Renew when the stored token is 7 days old, or sooner when it is near expiry. */
export function shouldRefreshSquareToken(input: {
  updatedAt: string | null;
  expiresAt: string | null;
  now: Date;
}): boolean {
  const expires = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  if (!input.expiresAt || Number.isNaN(expires) || expires - input.now.getTime() <= TOKEN_EXPIRY_SKEW_MS) {
    return true;
  }
  const updated = input.updatedAt ? Date.parse(input.updatedAt) : Number.NaN;
  if (!input.updatedAt || Number.isNaN(updated)) return true;
  return input.now.getTime() - updated >= TOKEN_RENEW_AFTER_MS;
}
