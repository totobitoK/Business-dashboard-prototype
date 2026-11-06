import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OAUTH_STATE_TTL_MS, stateHmacSecret } from "./config";
import { assertDbOk } from "./db-write";

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOAuthState(state: string): string {
  return crypto.createHmac("sha256", stateHmacSecret()).update(state).digest("hex");
}

export async function createOAuthStateRecord(
  admin: SupabaseClient,
  params: {
    userId: string;
    companyId: string;
    purpose: "connect" | "replace";
  }
): Promise<string> {
  const state = generateOAuthState();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
  const { error } = await admin.from("quickbooks_oauth_states").insert({
    state_hash: hashOAuthState(state),
    user_id: params.userId,
    company_id: params.companyId,
    purpose: params.purpose,
    expires_at: expiresAt.toISOString(),
  });
  assertDbOk(error, "OAUTH_STATE_INSERT");
  return state;
}

export async function consumeOAuthState(
  admin: SupabaseClient,
  state: string
): Promise<{ userId: string; companyId: string; purpose: "connect" | "replace" } | null> {
  const stateHash = hashOAuthState(state);
  const { data, error } = await admin.rpc("quickbooks_consume_oauth_state", {
    p_state_hash: stateHash,
  });
  assertDbOk(error, "OAUTH_STATE_CONSUME");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    userId: row.user_id as string,
    companyId: row.company_id as string,
    purpose: row.purpose as "connect" | "replace",
  };
}
