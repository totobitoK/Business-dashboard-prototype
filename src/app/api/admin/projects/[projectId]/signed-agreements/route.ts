import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { storeSignedAgreementPdf } from "@/lib/signed-agreements/access";
import { MAX_SIGNED_AGREEMENT_BYTES } from "@/lib/signed-agreements/pdf";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const userClient = await createClient();
  try {
    await requirePlatformAdmin(userClient);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const unauthorized = code === "UNAUTHORIZED";
    return NextResponse.json(
      { error: unauthorized ? "UNAUTHORIZED" : "FORBIDDEN" },
      { status: unauthorized ? 401 : 403 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIGNED_AGREEMENT_BYTES) {
    return NextResponse.json({ error: "INVALID_PDF" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let result;
  try {
    result = await storeSignedAgreementPdf({
      userClient,
      service: createServiceClient(),
      projectId,
      filename: file.name,
      bytes,
    });
  } catch {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
  if ("error" in result) {
    const status =
      result.error === "UNAUTHORIZED" ? 401 : result.error === "FORBIDDEN" ? 403 : result.error === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ id: result.id });
}
