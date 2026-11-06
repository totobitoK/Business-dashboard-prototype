import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntuitEnvironment } from "./config";
import { assertDbOk } from "./db-write";
import { decryptToken } from "./token-crypto";

export type QuickBooksConnectionRow = {
  id: string;
  companyId: string;
  environment: IntuitEnvironment;
  realmId: string | null;
  companyName: string | null;
  status: string;
  reportingTimezone: string;
  reportingTimezoneSource: "quickbooks" | "configured" | "utc_default";
  reportingDate: string | null;
  syncGeneration: number;
  disconnectedAt: string | null;
};

function mapConnection(row: Record<string, unknown>): QuickBooksConnectionRow {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    environment: row.intuit_environment as IntuitEnvironment,
    realmId: (row.realm_id as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    status: String(row.status),
    reportingTimezone: String(row.reporting_timezone ?? "America/New_York"),
    reportingTimezoneSource: (row.reporting_timezone_source as QuickBooksConnectionRow["reportingTimezoneSource"]) ?? "utc_default",
    reportingDate: (row.reporting_date as string | null) ?? null,
    syncGeneration: Number(row.sync_generation ?? 0),
    disconnectedAt: (row.disconnected_at as string | null) ?? null,
  };
}

export async function loadConnectionByCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<QuickBooksConnectionRow | null> {
  const { data, error } = await admin
    .from("quickbooks_connections")
    .select(
      "id, company_id, intuit_environment, realm_id, company_name, status, reporting_timezone, reporting_timezone_source, reporting_date, sync_generation, disconnected_at"
    )
    .eq("company_id", companyId)
    .maybeSingle();
  assertDbOk(error, "LOAD_CONNECTION");
  if (!data) return null;
  return mapConnection(data as Record<string, unknown>);
}

export async function loadSecrets(
  admin: SupabaseClient,
  connectionId: string
): Promise<{
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
} | null> {
  const { data, error } = await admin
    .from("quickbooks_connection_secrets")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  assertDbOk(error, "LOAD_SECRETS");
  if (!data?.refresh_token_enc) return null;
  return {
    refreshToken: decryptToken(data.refresh_token_enc as string),
    accessToken: data.access_token_enc ? decryptToken(data.access_token_enc as string) : null,
    accessTokenExpiresAt: data.access_token_expires_at
      ? new Date(data.access_token_expires_at as string)
      : null,
  };
}
