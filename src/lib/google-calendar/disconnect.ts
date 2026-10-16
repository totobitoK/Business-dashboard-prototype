import type { SupabaseClient } from "@supabase/supabase-js";
import { rpcDisconnectCompany, rpcPurgeImportData } from "./sync-rpc";

/** Removes credentials, stops sync, and clears imported events for the company. */
export async function disconnectGoogleCalendar(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  await rpcDisconnectCompany(admin, connectionId, companyId);
}

/** Clears imported data before linking a different Google account (explicit replace). */
export async function purgeGoogleCalendarImportData(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  await rpcPurgeImportData(admin, connectionId, companyId);
}
