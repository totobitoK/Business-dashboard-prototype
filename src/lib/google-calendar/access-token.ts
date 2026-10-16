import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "./google-api";
import { loadSecrets, upsertSecrets } from "./connection-store";

export async function getValidAccessToken(
  admin: SupabaseClient,
  connectionId: string,
  companyId: string
): Promise<string> {
  const secrets = await loadSecrets(admin, connectionId);
  if (!secrets?.refreshToken) {
    throw new Error("RECONNECT_REQUIRED");
  }

  const skewMs = 60_000;
  if (
    secrets.accessToken &&
    secrets.expiresAt &&
    secrets.expiresAt.getTime() - skewMs > Date.now()
  ) {
    return secrets.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshed = await refreshAccessToken({
    refreshToken: secrets.refreshToken,
    clientId,
    clientSecret,
  });

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  const refreshToken = refreshed.refresh_token ?? secrets.refreshToken;

  await upsertSecrets(admin, {
    connectionId,
    companyId,
    refreshToken,
    accessToken: refreshed.access_token,
    accessTokenExpiresAt: expiresAt,
  });

  return refreshed.access_token;
}

export async function markReconnectRequired(
  admin: SupabaseClient,
  connectionId: string,
  code: string
): Promise<void> {
  await admin
    .from("google_calendar_connections")
    .update({
      status: "reconnect_required",
      last_sync_error_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}
