import { NextResponse } from "next/server";
import { requireCompanyOwner } from "@/lib/auth/authorization";
import { finishQuickBooksOAuth } from "@/lib/quickbooks/finish-oauth";
import { assessOAuthCallback } from "@/lib/quickbooks/oauth-callback";
import { consumeOAuthState } from "@/lib/quickbooks/oauth-state";
import { isQuickBooksConnectAllowed } from "@/lib/quickbooks/config";
import { syncCompanyQuickBooks } from "@/lib/quickbooks/sync-company";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function settingsRedirect(origin: string, quickbooks: string) {
  const url = new URL("/dashboard/connections", origin);
  url.searchParams.set("quickbooks", quickbooks);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  if (!isQuickBooksConnectAllowed()) {
    return settingsRedirect(origin, "not_configured");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const errorParam = url.searchParams.get("error");
  if (errorParam) return settingsRedirect(origin, "denied");
  if (!code || !state || !realmId) return settingsRedirect(origin, "invalid_callback");

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
    realmId,
    consumed,
    sessionUserId,
    isOwner,
  });
  if (!decision.ok) return settingsRedirect(origin, decision.reason);

  try {
    await finishQuickBooksOAuth({
      admin,
      companyId: decision.consumed.companyId,
      code: decision.code,
      realmId: decision.realmId,
      origin,
      purpose: decision.consumed.purpose,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DIFFERENT_COMPANY_REQUIRES_REPLACE") {
      return settingsRedirect(origin, "replace_required");
    }
    return settingsRedirect(origin, "exchange_failed");
  }

  const synced = await syncCompanyQuickBooks(admin, decision.consumed.companyId);
  if (!synced.ok) return settingsRedirect(origin, "connected_sync_failed");
  return settingsRedirect(origin, "connected");
}
