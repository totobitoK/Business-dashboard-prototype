import { NextResponse } from "next/server";
import { resolveScopeCardWrite } from "@/lib/scope-card-writer";
import type { ScopeCard } from "@/lib/scope-card";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { card?: ScopeCard };
    if (!body.card?.client_id) {
      return NextResponse.json(
        { error: "Missing scope card payload." },
        { status: 400 }
      );
    }

    const result = await resolveScopeCardWrite(body.card);

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
