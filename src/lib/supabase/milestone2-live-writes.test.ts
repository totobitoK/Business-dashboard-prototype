import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";
const ADMIN = "admin@ravenview.dev";

function milestonePrerequisites(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE2_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE2_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" };
  }
  const seed = loadDevSeedCredentials();
  if (!seed?.users[USER_A] || !seed?.users[USER_B] || !seed?.users[ADMIN]) {
    return { ok: false, reason: ".dev-seed-credentials.json (run npm run seed:dev)" };
  }
  return { ok: true };
}

async function signIn(
  url: string,
  key: string,
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe("Milestone 2 live writes (RPC + RLS)", () => {
  const prereq = milestonePrerequisites();

  if (!prereq.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE2_TESTS === "1") {
      it(`missing milestone2 prerequisites (${prereq.reason})`, () => {
        throw new Error(`Milestone 2 DB tests require ${prereq.reason}.`);
      });
    } else {
      it.skip(`skipped — ${prereq.reason}`, () => {});
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const seed = loadDevSeedCredentials()!;

  let projectAId: string;
  let projectBId: string;

  beforeAll(async () => {
    const clientA = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const { data, error } = await clientA.from("client_projects").select("id").limit(1);
    if (error || !data?.[0]) throw new Error("Seed project A missing.");
    projectAId = data[0].id as string;

    const clientB = await signIn(url, key, USER_B, seed.users[USER_B]!);
    const b = await clientB.from("client_projects").select("id").limit(1);
    if (b.error || !b.data?.[0]) throw new Error("Seed project B missing.");
    projectBId = b.data[0].id as string;
  });

  it("customer saves intake draft on own project", async () => {
    const client = await signIn(url, key, USER_B, seed.users[USER_B]!);
    const { data, error } = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectBId,
      p_expected_version: 1,
      p_current_step: "1",
      p_draft: {
        company: "Acme HVAC",
        contactName: "Alex",
        email: "alex@acme.dev",
        phone: "555-0100",
        answers: { businessDescription: "Test" },
        updatedAt: new Date().toISOString(),
      },
    });
    expect(error).toBeNull();
    expect((data as { draft_version?: number })?.draft_version).toBeGreaterThanOrEqual(1);
  });

  it("denies cross-company intake save", async () => {
    const client = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const { error } = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectBId,
      p_expected_version: 1,
      p_current_step: "1",
      p_draft: { company: "Hack" },
    });
    expect(error?.message).toMatch(/FORBIDDEN/i);
  });

  it("rejects stale intake draft version", async () => {
    const client = await signIn(url, key, USER_B, seed.users[USER_B]!);
    const { data: intake } = await client
      .from("project_intake")
      .select("draft_version, form_status")
      .eq("project_id", projectBId)
      .maybeSingle();
    if (intake?.form_status === "submitted") {
      const blocked = await client.rpc("customer_save_intake_draft", {
        p_project_id: projectBId,
        p_expected_version: (intake.draft_version as number) ?? 1,
        p_current_step: "1",
        p_draft: { company: "After submit" },
      });
      expect(blocked.error?.message).toMatch(/INTAKE_SUBMITTED/i);
      return;
    }

    const current = (intake?.draft_version as number) ?? 1;
    await client.rpc("customer_save_intake_draft", {
      p_project_id: projectBId,
      p_expected_version: current,
      p_current_step: "1",
      p_draft: { company: "Fresh save" },
    });
    const after = await client
      .from("project_intake")
      .select("draft_version")
      .eq("project_id", projectBId)
      .single();
    const latest = after.data!.draft_version as number;

    const { error } = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectBId,
      p_expected_version: Math.max(1, latest - 1),
      p_current_step: "2",
      p_draft: { company: "Stale tab" },
    });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/VERSION_CONFLICT/i);
  });

  it("denies direct customer UPDATE on client_projects fees", async () => {
    const client = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const attempt = await client
      .from("client_projects")
      .update({ setup_fee: 123456 })
      .eq("id", projectAId)
      .select("id");
    expect(attempt.error || attempt.data?.length === 0).toBeTruthy();
  });

  it("denies customer admin scope draft RPC", async () => {
    const client = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const { error } = await client.rpc("admin_save_scope_draft", {
      p_project_id: projectAId,
      p_contact: { company_name: "X" },
      p_scope_draft: { setup_fee: 9999 },
    });
    expect(error?.message).toMatch(/FORBIDDEN/i);
  });

  it("admin publishes scope and customer accepts revision", async () => {
    const admin = await signIn(url, key, ADMIN, seed.users[ADMIN]!);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectAId,
      p_contact: {
        company_name: "Acme HVAC",
        contact_name: "Alex",
        email: "alex@acme.dev",
        phone: "555-0100",
        website: "",
      },
      p_scope_draft: {
        setup_fee: 4200,
        monthly_fee: 350,
        agreed_scope_summary: "Test scope summary",
        dashboard_scope: "Revenue + jobs",
        accepted_sources_in: ["QuickBooks"],
        accepted_screens: ["Overview"],
      },
    });

    const { data: publishData, error: publishError } = await admin.rpc("admin_publish_scope", {
      p_project_id: projectAId,
    });
    expect(publishError).toBeNull();
    const revision = (publishData as { revision?: number })?.revision;
    const scopeRevisionId = (publishData as { scope_revision_id?: string })?.scope_revision_id;
    expect(revision).toBeGreaterThan(0);
    expect(scopeRevisionId).toBeTruthy();

    const customer = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const accept = await customer.rpc("customer_accept_scope", {
      p_project_id: projectAId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(accept.error).toBeNull();

    const stale = await customer.rpc("customer_accept_scope", {
      p_project_id: projectAId,
      p_revision: revision! - 1,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(stale.error?.message).toMatch(/STALE_REVISION/i);
  });

  it("customer records scope change request (not admin notes)", async () => {
    const customer = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const { data: project } = await customer
      .from("client_projects")
      .select("published_revision")
      .eq("id", projectAId)
      .single();
    const rev = project!.published_revision as number;
    expect(rev).toBeGreaterThan(0);

    const direct = await customer.from("scope_change_requests").insert({
      project_id: projectAId,
      company_id: "00000000-0000-0000-0000-000000000000",
      revision: rev,
      note: "hack",
      requested_by: "00000000-0000-0000-0000-000000000000",
    });
    expect(direct.error).toBeTruthy();

    const notes = await customer.from("admin_project_notes").select("id").limit(1);
    expect(notes.error).toBeTruthy();

    const { error } = await customer.rpc("customer_request_scope_changes", {
      p_project_id: projectAId,
      p_revision: rev,
      p_note: "Please adjust monthly fee.",
    });
    expect(error).toBeNull();
  });

  it("blocks draft saves after intake submission", async () => {
    const customer = await signIn(url, key, USER_B, seed.users[USER_B]!);
    const { data: intake } = await customer
      .from("project_intake")
      .select("draft_version, form_status")
      .eq("project_id", projectBId)
      .maybeSingle();

    const version = (intake?.draft_version as number) ?? 1;
    if (intake?.form_status !== "submitted") {
      const submit = await customer.rpc("customer_submit_intake", {
        p_project_id: projectBId,
        p_expected_version: version,
        p_submission: {
          company: "Acme HVAC",
          contactName: "Alex",
          email: "alex@acme.dev",
          phone: "555-0100",
          businessDescription: "Done",
          dashboardGoals: "Goals",
          selectedTools: ["other"],
          submittedAt: new Date().toISOString(),
        },
      });
      expect(submit.error).toBeNull();
    }

    const draft = await customer.rpc("customer_save_intake_draft", {
      p_project_id: projectBId,
      p_expected_version: version + 1,
      p_current_step: "1",
      p_draft: { company: "After submit" },
    });
    expect(draft.error?.message).toMatch(/INTAKE_SUBMITTED/i);
  });
});
