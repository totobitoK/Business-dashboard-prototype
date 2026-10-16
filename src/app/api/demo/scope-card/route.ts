import { NextResponse } from "next/server";
import {
  assertFilesystemScopeExportAllowed,
  resolveScopeCardWrite,
} from "@/lib/scope-card-writer";
import type { ScopeCard } from "@/lib/scope-card";

/** Demo-only scope card export → clients/demo/ (development only). */
export async function POST(request: Request) {
  try {
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

    const result = await resolveScopeCardWrite(body.card, "demo");

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
