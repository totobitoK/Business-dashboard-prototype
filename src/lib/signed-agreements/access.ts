import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import {
  SIGNED_AGREEMENT_BUCKET,
  displayPdfFilename,
  isPdfBytes,
  signedAgreementStoragePath,
} from "./pdf";

export type SignedAgreementRecord = {
  id: string;
  original_filename: string;
  uploaded_at: string;
  is_current: boolean;
};

export type SignedAgreementFailure = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_PDF";

export async function listSignedAgreements(
  userClient: SupabaseClient,
  projectId: string
): Promise<SignedAgreementRecord[]> {
  await requirePlatformAdmin(userClient);
  const { data, error } = await userClient
    .from("signed_agreements")
    .select("id, original_filename, uploaded_at, is_current")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SignedAgreementRecord[];
}

export async function storeSignedAgreementPdf(params: {
  userClient: SupabaseClient;
  service: SupabaseClient;
  projectId: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<{ id: string } | { error: SignedAgreementFailure }> {
  try {
    await requirePlatformAdmin(params.userClient);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: code === "UNAUTHORIZED" ? "UNAUTHORIZED" : "FORBIDDEN" };
  }

  const filename = displayPdfFilename(params.filename);
  if (!filename || !isPdfBytes(params.bytes)) return { error: "INVALID_PDF" };

  const { data: project, error: projectError } = await params.userClient
    .from("client_projects")
    .select("id")
    .eq("id", params.projectId)
    .maybeSingle();
  if (projectError || !project) return { error: "NOT_FOUND" };

  const agreementId = crypto.randomUUID();
  const storagePath = signedAgreementStoragePath(params.projectId, agreementId);
  if (!storagePath) return { error: "INVALID_PDF" };

  const uploaded = await params.service.storage.from(SIGNED_AGREEMENT_BUCKET).upload(storagePath, params.bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);

  const { error: recordError } = await params.userClient.rpc("admin_record_signed_agreement", {
    p_project_id: params.projectId,
    p_agreement_id: agreementId,
    p_original_filename: filename,
    p_byte_size: params.bytes.byteLength,
  });
  if (recordError) {
    await params.service.storage.from(SIGNED_AGREEMENT_BUCKET).remove([storagePath]);
    const message = recordError.message ?? "";
    if (message.includes("NOT_FOUND")) return { error: "NOT_FOUND" };
    if (message.includes("FORBIDDEN")) return { error: "FORBIDDEN" };
    return { error: "INVALID_PDF" };
  }

  return { id: agreementId };
}

export async function readSignedAgreementForAdmin(params: {
  userClient: SupabaseClient;
  service: SupabaseClient;
  projectId: string;
  agreementId: string;
}): Promise<{ bytes: Uint8Array; filename: string } | { error: SignedAgreementFailure }> {
  try {
    await requirePlatformAdmin(params.userClient);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: code === "UNAUTHORIZED" ? "UNAUTHORIZED" : "FORBIDDEN" };
  }

  const { data, error } = await params.userClient
    .from("signed_agreements")
    .select("storage_path, original_filename")
    .eq("id", params.agreementId)
    .eq("project_id", params.projectId)
    .maybeSingle();
  const expectedPath = signedAgreementStoragePath(params.projectId, params.agreementId);
  if (error || !expectedPath || data?.storage_path !== expectedPath || !data.original_filename) {
    return { error: "NOT_FOUND" };
  }

  const downloaded = await params.service.storage.from(SIGNED_AGREEMENT_BUCKET).download(expectedPath);
  if (downloaded.error || !downloaded.data) return { error: "NOT_FOUND" };
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  return { bytes, filename: data.original_filename as string };
}
