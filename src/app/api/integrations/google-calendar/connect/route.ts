import { NextResponse } from "next/server";
import {
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  getGoogleRedirectUri,
  isGoogleCalendarIntegrationConfigured,
} from "@/lib/google-calendar/config";
import { requireCompanyOwner } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOAuthStateRecord } from "@/lib/google-calendar/oauth-state";
import { connectorCanConnect } from "@/lib/connector-presentation";
import { CONNECTOR_DEFINITIONS } from "@/lib/connector-catalog";

export async function GET(request: Request) {
  if (!isGoogleCalendarIntegrationConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const googleEntry = CONNECTOR_DEFINITIONS.find((c) => c.id === "google-calendar");
  if (!googleEntry || !connectorCanConnect(googleEntry)) {
    return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 503 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();
  const replace = url.searchParams.get("replace") === "1";
  if (!companyId) {
    return NextResponse.json({ error: "MISSING_COMPANY" }, { status: 400 });
  }

  const supabase = await createClient();
  let ctx;
  try {
    ctx = await requireCompanyOwner(supabase, companyId);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = createServiceClient();
  const state = await createOAuthStateRecord(admin, {
    userId: ctx.user.id,
    companyId,
    purpose: replace ? "replace" : "connect",
  });

  const origin = url.origin;
  const redirectUri = getGoogleRedirectUri(origin);
  const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
