import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "./google-api";
import { loadSecrets } from "./connection-store";
import { encryptToken } from "./token-crypto";
import { TOKEN_REFRESH_BASE_BACKOFF_MS, TOKEN_REFRESH_MAX_ATTEMPTS } from "./config";
import { isPermanentAuthError, isTransientGoogleError } from "./google-errors";
import { withBoundedBackoff } from "./retry";
import { assertDbOk } from "./db-write";
import { generationStillValid } from "./connection-generation";
import { rpcPersistTokens } from "./sync-rpc";

export async function getValidAccessToken(
  admin: SupabaseClient,
  connectionId: string,
  companyId: string,
  expectedGeneration?: number
): Promise<string> {
  const { data: connRow, error: connErr } = await admin
    .from("google_calendar_connections")
    .select("sync_generation, disconnected_at, status")
    .eq("id", connectionId)
    .maybeSingle();
  assertDbOk(connErr, "TOKEN_CONN");
  if (
    !connRow ||
    connRow.disconnected_at ||
    connRow.status === "disconnected" ||
    !generationStillValid(Number(connRow.sync_generation), expectedGeneration)
  ) {
    throw new Error("SYNC_ABORTED");
  }

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
  const generation = Number(connRow.sync_generation);

  const refreshed = await withBoundedBackoff(
    async () => {
      try {
        return await refreshAccessToken({
          refreshToken: secrets.refreshToken,
          clientId,
          clientSecret,
        });
      } catch (e) {
        if (isTransientGoogleError(e)) throw e;
        if (isPermanentAuthError(e)) throw new Error("RECONNECT_REQUIRED");
        throw e;
      }
    },
    { attempts: TOKEN_REFRESH_MAX_ATTEMPTS, baseMs: TOKEN_REFRESH_BASE_BACKOFF_MS }
  );

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  const refreshToken = refreshed.refresh_token ?? secrets.refreshToken;

  const persisted = await rpcPersistTokens(admin, {
    connectionId,
    companyId,
    expectedGeneration: expectedGeneration ?? generation,
    refreshTokenEnc: encryptToken(refreshToken),
    accessTokenEnc: encryptToken(refreshed.access_token),
    accessTokenExpiresAt: expiresAt.toISOString(),
  });
  if (!persisted) {
    throw new Error("SYNC_ABORTED");
  }

  return refreshed.access_token;
}

export async function markReconnectRequired(
  admin: SupabaseClient,
  connectionId: string,
  code: string,
  expectedGeneration?: number
): Promise<void> {
  let q = admin
    .from("google_calendar_connections")
    .update({
      status: "reconnect_required",
      last_sync_error_code: code,
      syncing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
  if (expectedGeneration !== undefined) {
    q = q.eq("sync_generation", expectedGeneration);
  }
  const { error } = await q;
  assertDbOk(error, "MARK_RECONNECT");
}
