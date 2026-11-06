import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSignedAgreementForAdmin, storeSignedAgreementPdf } from "../signed-agreements/access";
import {
  MAX_SIGNED_AGREEMENT_BYTES,
  SIGNED_AGREEMENT_BUCKET,
  signedAgreementStoragePath,
} from "../signed-agreements/pdf";
import {
  createDisposableM4aCompany,
  deleteDisposableM4aCompany,
} from "./milestone4a-test-fixtures";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";

const ADMIN = "admin@ravenview.dev";
const OWNER = "member-a@acme.dev";
const OTHER = "member-b@beta.dev";
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_AGREEMENT_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_AGREEMENT_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "Supabase URL and publishable key" };
  }
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, reason: "SUPABASE_SECRET_KEY" };
  const seed = loadDevSeedCredentials();
  if (!seed?.users[ADMIN] || !seed.users[OWNER] || !seed.users[OTHER]) {
    return { ok: false, reason: ".dev-seed-credentials.json" };
  }
  return { ok: true };
}

async function signIn(email: string) {
  const seed = loadDevSeedCredentials();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: seed!.users[email]!,
  });
  if (error) throw error;
  return client;
}

describe("signed agreement access", () => {
  const check = prereq();
  let service: SupabaseClient;
  let ownerUserId: string;
  let companyId: string | null = null;
  let projectId: string | null = null;

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_AGREEMENT_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Agreement tests require ${check.reason}.`);
      });
    } else {
      it.skip(`skipped — ${check.reason}`, () => {});
    }
    return;
  }

  beforeAll(async () => {
    service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    ownerUserId = users.users.find((user) => user.email === OWNER)?.id ?? "";
    expect(ownerUserId).toBeTruthy();
  });

  afterEach(async () => {
    if (projectId) {
      const { data: rows } = await service
        .from("signed_agreements")
        .select("storage_path")
        .eq("project_id", projectId);
      const paths = (rows ?? []).map((row) => row.storage_path as string);
      if (paths.length > 0) await service.storage.from(SIGNED_AGREEMENT_BUCKET).remove(paths);
    }
    if (companyId) await deleteDisposableM4aCompany(service, companyId);
    companyId = null;
    projectId = null;
  }, 30_000);

  it("lets a platform admin upload and retrieve a PDF, and hides it from other users", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    companyId = disposable.companyId;
    const { data: project, error: projectError } = await service
      .from("client_projects")
      .insert({
        company_id: companyId,
        company_name: "Agreement Fixture",
        contact_name: "Fixture Contact",
        email: "fixture@example.com",
      })
      .select("id, status")
      .single();
    expect(projectError).toBeNull();
    projectId = project!.id as string;
    const statusBefore = project!.status;

    const admin = await signIn(ADMIN);
    const owner = await signIn(OWNER);
    const other = await signIn(OTHER);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const denied = await storeSignedAgreementPdf({
      userClient: owner,
      service,
      projectId,
      filename: "signed.pdf",
      bytes: PDF,
    });
    expect(denied).toEqual({ error: "FORBIDDEN" });

    const stored = await storeSignedAgreementPdf({
      userClient: admin,
      service,
      projectId,
      filename: "Customer agreement.pdf",
      bytes: PDF,
    });
    expect("id" in stored).toBe(true);
    if (!("id" in stored)) return;
    const path = signedAgreementStoragePath(projectId, stored.id);
    expect(path).toBeTruthy();

    const revised = new Uint8Array([...PDF, 0x0a]);
    const second = await storeSignedAgreementPdf({
      userClient: admin,
      service,
      projectId,
      filename: "Customer agreement revised.pdf",
      bytes: revised,
    });
    expect("id" in second).toBe(true);

    const { data: rows } = await admin
      .from("signed_agreements")
      .select("id, original_filename, is_current")
      .eq("project_id", projectId);
    expect(rows).toHaveLength(2);
    expect(rows?.filter((row) => row.is_current)).toHaveLength(1);
    expect(rows?.find((row) => row.is_current)?.original_filename).toBe("Customer agreement revised.pdf");

    const { data: projectAfter } = await service
      .from("client_projects")
      .select("status")
      .eq("id", projectId)
      .single();
    expect(projectAfter?.status).toBe(statusBefore);

    const adminRead = await readSignedAgreementForAdmin({
      userClient: admin,
      service,
      projectId,
      agreementId: stored.id,
    });
    expect("bytes" in adminRead).toBe(true);
    if ("bytes" in adminRead) {
      expect(adminRead.filename).toBe("Customer agreement.pdf");
      expect(Array.from(adminRead.bytes.slice(0, 5))).toEqual(Array.from(PDF.slice(0, 5)));
    }

    const ownerRead = await readSignedAgreementForAdmin({
      userClient: owner,
      service,
      projectId,
      agreementId: stored.id,
    });
    expect(ownerRead).toEqual({ error: "FORBIDDEN" });
    const otherRead = await readSignedAgreementForAdmin({
      userClient: other,
      service,
      projectId,
      agreementId: stored.id,
    });
    expect(otherRead).toEqual({ error: "FORBIDDEN" });

    const ownerRows = await owner.from("signed_agreements").select("id").eq("id", stored.id);
    expect(ownerRows.data ?? []).toEqual([]);
    const otherRows = await other.from("signed_agreements").select("id").eq("id", stored.id);
    expect(otherRows.data ?? []).toEqual([]);
    const anonRows = await anon.from("signed_agreements").select("id").eq("id", stored.id);
    expect(anonRows.data ?? []).toEqual([]);

    const rejected = await storeSignedAgreementPdf({
      userClient: admin,
      service,
      projectId,
      filename: "notes.txt",
      bytes: new TextEncoder().encode("not a pdf"),
    });
    expect(rejected).toEqual({ error: "INVALID_PDF" });
    const oversized = new Uint8Array(MAX_SIGNED_AGREEMENT_BYTES + 1);
    oversized.set(PDF, 0);
    const tooBig = await storeSignedAgreementPdf({
      userClient: admin,
      service,
      projectId,
      filename: "too-big.pdf",
      bytes: oversized,
    });
    expect(tooBig).toEqual({ error: "INVALID_PDF" });

    const { data: afterReject } = await admin
      .from("signed_agreements")
      .select("id, is_current, original_filename")
      .eq("project_id", projectId);
    expect(afterReject).toHaveLength(2);
    expect(afterReject?.find((row) => row.is_current)?.original_filename).toBe(
      "Customer agreement revised.pdf"
    );

    const mismatch = await readSignedAgreementForAdmin({
      userClient: admin,
      service,
      projectId: "33333333-3333-4333-8333-333333333333",
      agreementId: stored.id,
    });
    expect(mismatch).toEqual({ error: "NOT_FOUND" });

    const ownerFile = await owner.storage.from(SIGNED_AGREEMENT_BUCKET).download(path!);
    expect(ownerFile.data).toBeNull();
    const anonFile = await anon.storage.from(SIGNED_AGREEMENT_BUCKET).download(path!);
    expect(anonFile.data).toBeNull();
    const adminDirect = await admin.storage.from(SIGNED_AGREEMENT_BUCKET).download(path!);
    expect(adminDirect.data).toBeNull();

    const { data: status } = await service.from("client_projects").select("status").eq("id", projectId).single();
    expect(status?.status).toBe(statusBefore);
  }, 30_000);
});
