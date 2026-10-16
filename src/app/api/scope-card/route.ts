export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import {
  assertFilesystemScopeExportAllowed,
  resolveScopeCardWrite,
} from "@/lib/scope-card-writer";
import type { ScopeCard } from "@/lib/scope-card";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    try {
      await requirePlatformAdmin(supabase);
    } catch {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    try {
      assertFilesystemScopeExportAllowed();
    } catch {
      return NextResponse.json(
        { error: "Scope-card filesystem export is disabled outside development." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { card?: ScopeCard };
    if (!body.card?.client_id) {
      return NextResponse.json(
        { error: "Missing scope card payload." },
        { status: 400 }
      );
    }

    const result = await resolveScopeCardWrite(body.card, "live");

    return NextResponse.json({
      ok: true,
      card: result.card,
      created: result.created,
      versionChanged: result.versionChanged,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scope card write failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
