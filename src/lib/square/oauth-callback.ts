export type OAuthCallbackFailure = "denied" | "invalid_callback" | "invalid_state" | "forbidden";

export type ConsumedOAuthState = {
  userId: string;
  companyId: string;
  purpose: "connect" | "replace";
};

export function assessOAuthCallback(input: {
  error: string | null;
  code: string | null;
  state: string | null;
  consumed: ConsumedOAuthState | null;
  sessionUserId: string | null;
  isOwner: boolean;
}):
  | { ok: true; code: string; consumed: ConsumedOAuthState }
  | { ok: false; reason: OAuthCallbackFailure } {
  if (input.error) return { ok: false, reason: "denied" };
  if (!input.code || !input.state) return { ok: false, reason: "invalid_callback" };
  if (!input.consumed) return { ok: false, reason: "invalid_state" };
  if (!input.sessionUserId || input.sessionUserId !== input.consumed.userId || !input.isOwner) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, code: input.code, consumed: input.consumed };
}

const MERCHANT_ID = /^[A-Za-z0-9]{1,64}$/;

export function isSquareMerchantId(value: string | null | undefined): value is string {
  return typeof value === "string" && MERCHANT_ID.test(value);
}
