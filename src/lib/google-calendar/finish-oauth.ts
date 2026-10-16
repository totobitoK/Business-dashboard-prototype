import type { SupabaseClient } from "@supabase/supabase-js";
import { exchangeCodeForTokens, fetchGoogleUserEmail } from "./google-api";
import { getGoogleRedirectUri } from "./config";
import { loadSecrets, upsertSecrets } from "./connection-store";
import { purgeGoogleCalendarImportData } from "./disconnect";
import { assertDbOk } from "./db-write";
import { upsertCalendarListPreservingSelection } from "./calendar-list";

export async function finishGoogleCalendarOAuth(params: {
  admin: SupabaseClient;
  companyId: string;
  code: string;
  origin: string;
  purpose: "connect" | "replace";
}): Promise<{ connectionId: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = getGoogleRedirectUri(params.origin);

  const tokens = await exchangeCodeForTokens({
    code: params.code,
    clientId,
    clientSecret,
    redirectUri,
  });

  const profile = await fetchGoogleUserEmail(tokens.access_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const { data: existing } = await params.admin
    .from("google_calendar_connections")
    .select("id, google_sub, status, disconnected_at, sync_generation")
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (
    existing &&
    !existing.disconnected_at &&
    existing.google_sub &&
    existing.google_sub !== profile.sub &&
    params.purpose !== "replace"
  ) {
    throw new Error("DIFFERENT_ACCOUNT_REQUIRES_REPLACE");
  }

  let connectionId: string;
  let refreshToken = tokens.refresh_token;

  if (existing) {
    connectionId = existing.id as string;
    const accountChanging =
      params.purpose === "replace" ||
      (existing.google_sub && existing.google_sub !== profile.sub);
    if (accountChanging) {
      if (!refreshToken) throw new Error("MISSING_REFRESH_TOKEN");
      await purgeGoogleCalendarImportData(params.admin, params.companyId, connectionId);
    } else if (!refreshToken) {
      const secrets = await loadSecrets(params.admin, connectionId);
      if (!secrets?.refreshToken) throw new Error("MISSING_REFRESH_TOKEN");
      refreshToken = secrets.refreshToken;
    }

    const updatePayload: Record<string, unknown> = {
      google_sub: profile.sub,
      google_email: profile.email,
      status: "connected",
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_sync_error_code: null,
      syncing_started_at: null,
      updated_at: new Date().toISOString(),
    };
    if (accountChanging) {
      updatePayload.sync_generation = Number(existing.sync_generation ?? 0) + 1;
      updatePayload.sync_cursor = {};
    }
    const { error: updErr } = await params.admin
      .from("google_calendar_connections")
      .update(updatePayload)
      .eq("id", connectionId);
    assertDbOk(updErr, "UPDATE_CONNECTION");
  } else {
    if (!refreshToken) throw new Error("MISSING_REFRESH_TOKEN");
    const { data: inserted, error: insErr } = await params.admin
      .from("google_calendar_connections")
      .insert({
        company_id: params.companyId,
        google_sub: profile.sub,
        google_email: profile.email,
        status: "connected",
        connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assertDbOk(insErr, "INSERT_CONNECTION");
    connectionId = inserted!.id as string;
  }

  await upsertSecrets(params.admin, {
    connectionId,
    companyId: params.companyId,
    refreshToken: refreshToken!,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: expiresAt,
  });

  await upsertCalendarListPreservingSelection(params.admin, {
    connectionId,
    companyId: params.companyId,
    accessToken: tokens.access_token,
  });

  return { connectionId };
}
