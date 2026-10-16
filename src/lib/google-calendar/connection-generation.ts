import type { SupabaseClient } from "@supabase/supabase-js";
import { rpcBumpSyncGeneration } from "./sync-rpc";

export type ConnectionSyncState = {
  id: string;
  sync_generation: number;
  sync_cursor: Record<string, unknown>;
  status: string;
  disconnected_at: string | null;
};

export async function loadConnectionSyncState(
  admin: SupabaseClient,
  companyId: string
): Promise<ConnectionSyncState | null> {
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("id, sync_generation, sync_cursor, status, disconnected_at")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as ConnectionSyncState | null;
}

export async function bumpConnectionSyncGeneration(
  admin: SupabaseClient,
  connectionId: string
): Promise<number> {
  return rpcBumpSyncGeneration(admin, connectionId);
}

export function generationStillValid(
  observed: number,
  expected: number | undefined
): boolean {
  return expected === undefined || observed === expected;
}
