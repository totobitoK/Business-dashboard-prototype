import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OAUTH_STATE_TTL_MS } from "./config";

function stateHmacSecret(): string {
  const s = process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!s) throw new Error("Missing OAuth state secret.");
  return s;
}

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
  const { error } = await admin.from("google_calendar_oauth_states").insert({
    state_hash: hashOAuthState(state),
    user_id: params.userId,
    company_id: params.companyId,
    purpose: params.purpose,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return state;
}

export async function consumeOAuthState(
  admin: SupabaseClient,
  state: string
): Promise<{ userId: string; companyId: string; purpose: "connect" | "replace" } | null> {
  const stateHash = hashOAuthState(state);
  const { data, error } = await admin
    .from("google_calendar_oauth_states")
    .select("id, user_id, company_id, purpose, expires_at, consumed_at")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (error || !data || data.consumed_at) return null;
  if (new Date(data.expires_at as string) < new Date()) return null;

  const { error: markErr } = await admin
    .from("google_calendar_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null);

  if (markErr) return null;

  return {
    userId: data.user_id as string,
    companyId: data.company_id as string,
    purpose: data.purpose as "connect" | "replace",
  };
}
