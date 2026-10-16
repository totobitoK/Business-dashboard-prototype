import type { SupabaseClient } from "@supabase/supabase-js";
import {
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
  listCalendars,
} from "./google-api";
import { getGoogleRedirectUri } from "./config";
import { upsertSecrets } from "./connection-store";
import { purgeGoogleCalendarImportData } from "./disconnect";

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
  if (!tokens.refresh_token) {
    throw new Error("MISSING_REFRESH_TOKEN");
  }

  const profile = await fetchGoogleUserEmail(tokens.access_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const { data: existing } = await params.admin
    .from("google_calendar_connections")
    .select("id, google_sub, status, disconnected_at")
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

  if (existing) {
    connectionId = existing.id as string;
    if (params.purpose === "replace" || existing.google_sub !== profile.sub) {
      await purgeGoogleCalendarImportData(params.admin, params.companyId, connectionId);
    }
    const { error: updErr } = await params.admin
      .from("google_calendar_connections")
      .update({
        google_sub: profile.sub,
        google_email: profile.email,
        status: "connected",
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    if (updErr) throw updErr;
  } else {
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
    if (insErr) throw insErr;
    connectionId = inserted.id as string;
  }

  await upsertSecrets(params.admin, {
    connectionId,
    companyId: params.companyId,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: expiresAt,
  });

  const calendars = await listCalendars(tokens.access_token);
  if (calendars.length > 0) {
    const rows = calendars.map((c) => ({
      connection_id: connectionId,
      company_id: params.companyId,
      google_calendar_id: c.id,
      summary: c.summary || c.id,
      selected: false,
      updated_at: new Date().toISOString(),
    }));
    const { error: calErr } = await params.admin
      .from("google_calendar_selected_calendars")
      .upsert(rows, { onConflict: "connection_id,google_calendar_id" });
    if (calErr) throw calErr;
  }

  return { connectionId };
}
