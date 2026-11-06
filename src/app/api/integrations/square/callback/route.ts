import { NextResponse } from "next/server";
import { requireCompanyOwner } from "@/lib/auth/authorization";
import { isSquareConnectAllowed } from "@/lib/square/config";
import { finishSquareOAuth } from "@/lib/square/finish-oauth";
import { assessOAuthCallback } from "@/lib/square/oauth-callback";
import { consumeOAuthState } from "@/lib/square/oauth-state";
import { syncCompanySquare } from "@/lib/square/sync-company";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function settingsRedirect(origin: string, square: string) {
  const url = new URL("/dashboard/settings", origin);
  url.searchParams.set("square", square);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  if (!isSquareConnectAllowed()) return settingsRedirect(origin, "not_configured");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  if (errorParam) return settingsRedirect(origin, "denied");
  if (!code || !state) return settingsRedirect(origin, "invalid_callback");

  const admin = createServiceClient();
  const consumed = await consumeOAuthState(admin, state);
  const supabase = await createClient();
  let sessionUserId: string | null = null;
  let isOwner = false;
  if (consumed) {
    try {
      const ctx = await requireCompanyOwner(supabase, consumed.companyId);
      sessionUserId = ctx.user.id;
      isOwner = true;
    } catch {
      isOwner = false;
    }
  }

  const decision = assessOAuthCallback({
    error: errorParam,
    code,
    state,
    consumed,
    sessionUserId,
    isOwner,
  });
  if (!decision.ok) return settingsRedirect(origin, decision.reason);

  try {
    const finished = await finishSquareOAuth({
      admin,
      companyId: decision.consumed.companyId,
      code: decision.code,
      purpose: decision.consumed.purpose,
    });
    if (finished.selectedCount === 0) return settingsRedirect(origin, "choose_locations");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DIFFERENT_SELLER_REQUIRES_REPLACE") return settingsRedirect(origin, "replace_required");
    if (message === "INVALID_MERCHANT") return settingsRedirect(origin, "invalid_merchant");
    return settingsRedirect(origin, "exchange_failed");
  }

  const synced = await syncCompanySquare(admin, decision.consumed.companyId);
  if (!synced.ok) return settingsRedirect(origin, "connected_sync_failed");
  return settingsRedirect(origin, "connected");
}
