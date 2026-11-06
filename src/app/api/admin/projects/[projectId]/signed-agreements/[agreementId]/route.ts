import { NextResponse } from "next/server";
import { readSignedAgreementForAdmin } from "@/lib/signed-agreements/access";
import { contentDisposition } from "@/lib/signed-agreements/pdf";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; agreementId: string }> }
) {
  const { projectId, agreementId } = await context.params;
  const result = await readSignedAgreementForAdmin({
    userClient: await createClient(),
    service: createServiceClient(),
    projectId,
    agreementId,
  });
  if ("error" in result) {
    const status = result.error === "UNAUTHORIZED" ? 401 : result.error === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(disposition, result.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
