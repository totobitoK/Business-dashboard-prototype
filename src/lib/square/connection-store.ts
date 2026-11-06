import type { SupabaseClient } from "@supabase/supabase-js";
import type { SquareEnvironment } from "./config";
import { assertDbOk } from "./db-write";
import { decryptToken } from "./token-crypto";

export type SquareConnectionRecord = {
  id: string;
  companyId: string;
  environment: SquareEnvironment;
  merchantId: string | null;
  merchantName: string | null;
  status: string;
  reportingTimezone: string;
  syncGeneration: number;
  disconnectedAt: string | null;
  locationsConfirmedAt: string | null;
};

export type SquareSecrets = {
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  updatedAt: string | null;
};

export async function loadConnectionByCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<SquareConnectionRecord | null> {
  const { data, error } = await admin
    .from("square_connections")
    .select(
      "id, company_id, square_environment, merchant_id, merchant_name, status, reporting_timezone, sync_generation, disconnected_at, locations_confirmed_at"
    )
    .eq("company_id", companyId)
    .maybeSingle();
  assertDbOk(error, "LOAD_CONNECTION");
  if (!data) return null;
  return {
    id: data.id as string,
    companyId: data.company_id as string,
    environment: data.square_environment as SquareEnvironment,
    merchantId: (data.merchant_id as string | null) ?? null,
    merchantName: (data.merchant_name as string | null) ?? null,
    status: data.status as string,
    reportingTimezone: data.reporting_timezone as string,
    syncGeneration: Number(data.sync_generation),
    disconnectedAt: (data.disconnected_at as string | null) ?? null,
    locationsConfirmedAt: (data.locations_confirmed_at as string | null) ?? null,
  };
}

export async function loadSecrets(admin: SupabaseClient, connectionId: string): Promise<SquareSecrets | null> {
  const { data, error } = await admin
    .from("square_connection_secrets")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at, updated_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  assertDbOk(error, "LOAD_SECRETS");
  if (!data) return null;
  return {
    refreshToken: decryptToken(data.refresh_token_enc as string),
    accessToken: data.access_token_enc ? decryptToken(data.access_token_enc as string) : null,
    accessTokenExpiresAt: (data.access_token_expires_at as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

export async function listSelectedLocationIds(admin: SupabaseClient, connectionId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("square_locations")
    .select("square_location_id")
    .eq("connection_id", connectionId)
    .eq("selected", true);
  assertDbOk(error, "LOAD_LOCATIONS");
  return (data ?? []).map((row) => row.square_location_id as string);
}
