import type { PostgrestError } from "@supabase/supabase-js";

export function assertDbOk(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`${context}:${error.message}`);
  }
}

/** Guarded RPC returned false or reconcile returned -1 — treat as stale/aborted sync work. */
export function abortUnlessSyncGuardApplied(applied: boolean, context: string): void {
  if (!applied) {
    throw new Error(`SYNC_ABORTED:${context}`);
  }
}

export function abortUnlessReconcileApplied(deletedCount: number, context: string): void {
  if (deletedCount < 0) {
    throw new Error(`SYNC_ABORTED:${context}`);
  }
}
