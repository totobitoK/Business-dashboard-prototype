const REALM_ID = /^[0-9]{1,20}$/;

export type OAuthCallbackFailure =
  | "denied"
  | "invalid_callback"
  | "invalid_state"
  | "forbidden"
  | "invalid_realm";

export type ConsumedOAuthState = {
  userId: string;
  companyId: string;
  purpose: "connect" | "replace";
};

export function assessOAuthCallback(input: {
  error: string | null;
  code: string | null;
  state: string | null;
  realmId: string | null;
  consumed: ConsumedOAuthState | null;
  sessionUserId: string | null;
  isOwner: boolean;
}):
  | { ok: true; code: string; realmId: string; consumed: ConsumedOAuthState }
  | { ok: false; reason: OAuthCallbackFailure } {
  if (input.error) return { ok: false, reason: "denied" };
  if (!input.code || !input.state) return { ok: false, reason: "invalid_callback" };
  if (!input.realmId || !REALM_ID.test(input.realmId)) return { ok: false, reason: "invalid_realm" };
  if (!input.consumed) return { ok: false, reason: "invalid_state" };
  if (!input.sessionUserId || input.sessionUserId !== input.consumed.userId || !input.isOwner) {
    return { ok: false, reason: "forbidden" };
  }
  return {
    ok: true,
    code: input.code,
    realmId: input.realmId,
    consumed: input.consumed,
  };
}
