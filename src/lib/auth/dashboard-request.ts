import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, type AuthContext } from "@/lib/auth/authorization";

/**
 * One identity read for the dashboard server render.
 * The layout and the page share it, so a single load does not ask twice.
 */
export const getDashboardRequest = cache(
  async (): Promise<{ supabase: SupabaseClient; ctx: AuthContext | null }> => {
    const supabase = await createClient();
    const ctx = await getAuthContext(supabase);
    return { supabase, ctx };
  }
);
