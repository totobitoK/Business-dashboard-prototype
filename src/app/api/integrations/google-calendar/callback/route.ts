import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCompanyOwner } from "@/lib/auth/authorization";
import { consumeOAuthState } from "@/lib/google-calendar/oauth-state";
import { finishGoogleCalendarOAuth } from "@/lib/google-calendar/finish-oauth";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import {
  releaseSyncLock,
  syncCompanyGoogleCalendar,
  tryAcquireSyncLock,
} from "@/lib/google-calendar/sync-company";

function settingsRedirect(origin: string, params: Record<string, string>) {
  const u = new URL("/dashboard/settings", origin);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return settingsRedirect(origin, { google: "denied" });
  }

  if (!isGoogleCalendarIntegrationConfigured()) {
    return settingsRedirect(origin, { google: "not_configured" });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return settingsRedirect(origin, { google: "invalid_callback" });
  }

  const admin = createServiceClient();
  const consumed = await consumeOAuthState(admin, state);
  if (!consumed) {
    return settingsRedirect(origin, { google: "invalid_state" });
  }

  const supabase = await createClient();
  try {
    const ctx = await requireCompanyOwner(supabase, consumed.companyId);
    if (ctx.user.id !== consumed.userId) {
      return settingsRedirect(origin, { google: "forbidden" });
    }
  } catch {
    return settingsRedirect(origin, { google: "forbidden" });
  }

  try {
    await finishGoogleCalendarOAuth({
      admin,
      companyId: consumed.companyId,
      code,
      origin,
      purpose: consumed.purpose,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "DIFFERENT_ACCOUNT_REQUIRES_REPLACE") {
      return settingsRedirect(origin, { google: "replace_required" });
    }
    return settingsRedirect(origin, { google: "exchange_failed" });
  }

  const workerId = `oauth-${Date.now()}`;
  if (await tryAcquireSyncLock(admin, consumed.companyId, workerId)) {
    try {
      await syncCompanyGoogleCalendar(admin, consumed.companyId);
    } finally {
      await releaseSyncLock(admin, consumed.companyId);
    }
  }

  return settingsRedirect(origin, { google: "connected" });
}
