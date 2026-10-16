import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./token-crypto";

export type ConnectionRow = {
  id: string;
  company_id: string;
  google_sub: string | null;
  google_email: string | null;
  status: string;
  disconnected_at: string | null;
};

export async function loadConnectionByCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<ConnectionRow | null> {
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("id, company_id, google_sub, google_email, status, disconnected_at")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as ConnectionRow | null;
}

export async function loadSecrets(
  admin: SupabaseClient,
  connectionId: string
): Promise<{ refreshToken: string; accessToken: string | null; expiresAt: Date | null } | null> {
  const { data, error } = await admin
    .from("google_calendar_connection_secrets")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    refreshToken: decryptToken(data.refresh_token_enc as string),
    accessToken: data.access_token_enc
      ? decryptToken(data.access_token_enc as string)
      : null,
    expiresAt: data.access_token_expires_at
      ? new Date(data.access_token_expires_at as string)
      : null,
  };
}

export async function upsertSecrets(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    refreshToken: string;
    accessToken: string;
    accessTokenExpiresAt: Date;
  }
): Promise<void> {
  const { error } = await admin.from("google_calendar_connection_secrets").upsert(
    {
      connection_id: params.connectionId,
      company_id: params.companyId,
      refresh_token_enc: encryptToken(params.refreshToken),
      access_token_enc: encryptToken(params.accessToken),
      access_token_expires_at: params.accessTokenExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" }
  );
  if (error) throw error;
}

export async function updateAccessTokenOnly(
  admin: SupabaseClient,
  connectionId: string,
  accessToken: string,
  expiresAt: Date,
  existingRefreshEnc: string
): Promise<void> {
  const { error } = await admin
    .from("google_calendar_connection_secrets")
    .update({
      access_token_enc: encryptToken(accessToken),
      access_token_expires_at: expiresAt.toISOString(),
      refresh_token_enc: existingRefreshEnc,
      updated_at: new Date().toISOString(),
    })
    .eq("connection_id", connectionId);
  if (error) throw error;
}
