import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getQuickBooksCredentials,
  getQuickBooksEnvironment,
  getQuickBooksRedirectUri,
  type IntuitEnvironment,
} from "./config";
import { assertDbOk } from "./db-write";
import { exchangeAuthorizationCode } from "./intuit-oauth";
import { selectReportingTimeZone } from "./reporting-date";
import { persistTokens } from "./sync-rpc";
import { encryptToken } from "./token-crypto";

export async function finishQuickBooksOAuth(params: {
  admin: SupabaseClient;
  companyId: string;
  code: string;
  realmId: string;
  origin: string;
  purpose: "connect" | "replace";
}): Promise<{ connectionId: string }> {
  const environment = getQuickBooksEnvironment();
  const credentials = getQuickBooksCredentials();
  if (!environment || !credentials) throw new Error("NOT_CONFIGURED");

  const { data: existing, error: loadError } = await params.admin
    .from("quickbooks_connections")
    .select("id, realm_id, intuit_environment, disconnected_at, sync_generation")
    .eq("company_id", params.companyId)
    .maybeSingle();
  assertDbOk(loadError, "LOAD_CONNECTION");

  const realmChanging = Boolean(existing?.realm_id && existing.realm_id !== params.realmId);
  const environmentChanging = Boolean(
    existing && existing.intuit_environment !== environment
  );
  if ((realmChanging || environmentChanging) && params.purpose !== "replace") {
    throw new Error("DIFFERENT_COMPANY_REQUIRES_REPLACE");
  }

  const tokens = await exchangeAuthorizationCode({
    code: params.code,
    redirectUri: getQuickBooksRedirectUri(params.origin),
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  });

  const { data: companyRow } = await params.admin
    .from("companies")
    .select("timezone")
    .eq("id", params.companyId)
    .maybeSingle();
  const reportingTimeZone = selectReportingTimeZone(
    typeof companyRow?.timezone === "string" ? companyRow.timezone : null
  );
  let connectionId: string;
  let generation: number;

  if (!existing) {
    const { data: inserted, error } = await params.admin
      .from("quickbooks_connections")
      .insert({
        company_id: params.companyId,
        intuit_environment: environment,
        realm_id: params.realmId,
        status: "connected",
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        reporting_timezone: reportingTimeZone,
        reporting_timezone_source: "configured",
      })
      .select("id, sync_generation")
      .single();
    assertDbOk(error, "INSERT_CONNECTION");
    connectionId = inserted!.id as string;
    generation = Number(inserted!.sync_generation);
  } else {
    connectionId = existing.id as string;
    if (realmChanging || environmentChanging) {
      const { data: resetGen, error: resetError } = await params.admin.rpc(
        "quickbooks_reset_import_for_replace",
        { p_connection_id: connectionId, p_company_id: params.companyId }
      );
      assertDbOk(resetError, "RESET_IMPORT");
      generation = Number(resetGen);
    } else {
      generation = Number(existing.sync_generation);
    }

    const updatePayload: Record<string, unknown> = {
      intuit_environment: environment satisfies IntuitEnvironment,
      realm_id: params.realmId,
      status: "connected",
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_sync_error_code: null,
      updated_at: new Date().toISOString(),
    };
    if (realmChanging || environmentChanging) {
      updatePayload.reporting_timezone = reportingTimeZone;
      updatePayload.reporting_timezone_source = "configured";
    }
    const { error: updateError } = await params.admin
      .from("quickbooks_connections")
      .update(updatePayload)
      .eq("id", connectionId)
      .eq("company_id", params.companyId);
    assertDbOk(updateError, "UPDATE_CONNECTION");
  }

  const refreshExpiresAt =
    tokens.refreshTokenExpiresIn === null
      ? null
      : new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000).toISOString();
  const persisted = await persistTokens(params.admin, {
    connectionId,
    companyId: params.companyId,
    expectedGeneration: generation,
    refreshTokenEnc: encryptToken(tokens.refreshToken),
    accessTokenEnc: encryptToken(tokens.accessToken),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    refreshTokenExpiresAt: refreshExpiresAt,
  });
  if (!persisted) throw new Error("OAUTH_CONNECTION_STALE");
  return { connectionId };
}
