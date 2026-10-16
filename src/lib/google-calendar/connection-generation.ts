import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDbOk } from "./db-write";

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
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("sync_generation")
    .eq("id", connectionId)
    .single();
  assertDbOk(error, "LOAD_GENERATION");
  const next = Number(data!.sync_generation ?? 0) + 1;
  const { error: updErr } = await admin
    .from("google_calendar_connections")
    .update({
      sync_generation: next,
      sync_cursor: {},
      syncing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
  assertDbOk(updErr, "BUMP_GENERATION");
  return next;
}

export function generationStillValid(
  observed: number,
  expected: number | undefined
): boolean {
  return expected === undefined || observed === expected;
}
