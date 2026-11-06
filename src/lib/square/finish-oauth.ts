import type { SupabaseClient } from "@supabase/supabase-js";
import { EASTERN_TIME_ZONE } from "@/lib/company-time-zone";
import { isValidIanaTimeZone } from "@/lib/quickbooks/reporting-date";
import { getSquareCredentials, getSquareEnvironment, type SquareEnvironment } from "./config";
import { assertDbOk } from "./db-write";
import { isSquareMerchantId } from "./oauth-callback";
import { exchangeAuthorizationCode } from "./square-api";
import { readSellerProfile } from "./square-read";
import { persistTokens, replaceLocations } from "./sync-rpc";
import { encryptToken } from "./token-crypto";

export async function finishSquareOAuth(params: {
  admin: SupabaseClient;
  companyId: string;
  code: string;
  purpose: "connect" | "replace";
}): Promise<{ connectionId: string; selectedCount: number }> {
  const environment = getSquareEnvironment();
  const credentials = getSquareCredentials();
  if (!environment || !credentials) throw new Error("NOT_CONFIGURED");

  const { data: existing, error: loadError } = await params.admin
    .from("square_connections")
    .select("id, merchant_id, square_environment, disconnected_at, sync_generation")
    .eq("company_id", params.companyId)
    .maybeSingle();
  assertDbOk(loadError, "LOAD_CONNECTION");

  const tokens = await exchangeAuthorizationCode({
    environment,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    code: params.code,
  });
  if (!isSquareMerchantId(tokens.merchantId)) throw new Error("INVALID_MERCHANT");

  const merchantChanging = Boolean(existing?.merchant_id && existing.merchant_id !== tokens.merchantId);
  const environmentChanging = Boolean(existing && existing.square_environment !== environment);
  if ((merchantChanging || environmentChanging) && params.purpose !== "replace") {
    throw new Error("DIFFERENT_SELLER_REQUIRES_REPLACE");
  }

  const { data: companyRow } = await params.admin
    .from("companies")
    .select("timezone")
    .eq("id", params.companyId)
    .maybeSingle();
  const reportingTimeZone =
    typeof companyRow?.timezone === "string" && isValidIanaTimeZone(companyRow.timezone)
      ? companyRow.timezone
      : EASTERN_TIME_ZONE;

  let connectionId: string;
  let generation: number;
  if (!existing) {
    const { data: inserted, error } = await params.admin
      .from("square_connections")
      .insert({
        company_id: params.companyId,
        square_environment: environment,
        merchant_id: tokens.merchantId,
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
    if (merchantChanging || environmentChanging) {
      const { data: resetGen, error: resetError } = await params.admin.rpc("square_reset_import_for_replace", {
        p_connection_id: connectionId,
        p_company_id: params.companyId,
      });
      assertDbOk(resetError, "RESET_IMPORT");
      generation = Number(resetGen);
    } else {
      generation = Number(existing.sync_generation);
    }
    const updatePayload: Record<string, unknown> = {
      square_environment: environment satisfies SquareEnvironment,
      merchant_id: tokens.merchantId,
      status: "connected",
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_sync_error_code: null,
      updated_at: new Date().toISOString(),
    };
    if (merchantChanging || environmentChanging) {
      updatePayload.reporting_timezone = reportingTimeZone;
      updatePayload.reporting_timezone_source = "configured";
    }
    const { error: updateError } = await params.admin
      .from("square_connections")
      .update(updatePayload)
      .eq("id", connectionId)
      .eq("company_id", params.companyId);
    assertDbOk(updateError, "UPDATE_CONNECTION");
  }

  const persisted = await persistTokens(params.admin, {
    connectionId,
    companyId: params.companyId,
    expectedGeneration: generation,
    refreshTokenEnc: encryptToken(tokens.refreshToken),
    accessTokenEnc: encryptToken(tokens.accessToken),
    accessTokenExpiresAt: tokens.expiresAt,
  });
  if (!persisted) throw new Error("OAUTH_CONNECTION_STALE");

  const profile = await readSellerProfile({
    environment,
    accessToken: tokens.accessToken,
    merchantId: tokens.merchantId,
  });
  const replaced = await replaceLocations(params.admin, {
    connectionId,
    companyId: params.companyId,
    locations: profile.locations,
  });
  if (!replaced) throw new Error("LOCATIONS_FAILED");
  if (profile.merchantName) {
    const { error } = await params.admin
      .from("square_connections")
      .update({ merchant_name: profile.merchantName, updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("company_id", params.companyId);
    assertDbOk(error, "UPDATE_MERCHANT_NAME");
  }

  const { count, error: countError } = await params.admin
    .from("square_locations")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .eq("selected", true);
  assertDbOk(countError, "COUNT_LOCATIONS");
  return { connectionId, selectedCount: count ?? 0 };
}
