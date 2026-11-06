import { NextResponse } from "next/server";
import { requireCompanyOwner } from "@/lib/auth/authorization";
import { buildSquareAuthorizeUrl, getSquareCredentials, isSquareConnectAllowed } from "@/lib/square/config";
import { createOAuthStateRecord } from "@/lib/square/oauth-state";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!isSquareConnectAllowed()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  const credentials = getSquareCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
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
  const authUrl = buildSquareAuthorizeUrl({
    clientId: credentials.clientId,
    state,
    environment: credentials.environment,
  });
  return NextResponse.redirect(authUrl.toString());
}
