import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
} from "./milestone2-test-fixtures";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";
const ADMIN = "admin@ravenview.dev";

const createdProjectIds: string[] = [];

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

function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    company: "Test Co",
    contactName: "Alex",
    email: "m2-submit@test.local",
    phone: "555-0100",
    businessDescription: "We install HVAC systems.",
    dashboardGoals: "Track jobs and revenue.",
    selectedTools: ["quickbooks"],
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

function minimalDraft(company: string) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return {
    company,
    contactName: "Alex",
    email: `m2-${suffix}@test.local`,
    phone: "555-0100",
    answers: { businessDescription: "Test" },
    updatedAt: new Date().toISOString(),
  };
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

async function createOwnedTestProject(
  admin: SupabaseClient,
  companyId: string,
  label: string
): Promise<string> {
  const id = await createMilestone2TestProject(admin, companyId, label);
  createdProjectIds.push(id);
  return id;
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

  let companyAId: string;
  let companyBId: string;
  let seedProjectAId: string;
  let cachedAdmin: SupabaseClient;
  let cachedUserA: SupabaseClient;
  let cachedUserB: SupabaseClient;

  beforeAll(async () => {
    cachedAdmin = await signIn(url, key, ADMIN, seed.users[ADMIN]!);
    cachedUserA = await signIn(url, key, USER_A, seed.users[USER_A]!);
    cachedUserB = await signIn(url, key, USER_B, seed.users[USER_B]!);
    companyAId = await readCompanyIdBySlug(cachedAdmin, "acme-hvac");
    companyBId = await readCompanyIdBySlug(cachedAdmin, "beta-retail");
    const { data: seedA } = await cachedUserA
      .from("client_projects")
      .select("id")
      .limit(1)
      .single();
    seedProjectAId = seedA!.id as string;
  });

  afterEach(async () => {
    while (createdProjectIds.length > 0) {
      const id = createdProjectIds.pop()!;
      await deleteMilestone2TestProject(cachedAdmin, id);
    }
  });

  function adminClient() {
    return cachedAdmin;
  }

  const scopeContact = {
    company_name: "M2 Scope Test Co",
    contact_name: "Alex",
    email: "m2-scope@test.local",
    phone: "555-0100",
    website: "",
  };

  it("customer cannot read admin scope draft table", async () => {
    const client = cachedUserA;
    const { data, error } = await client
      .from("admin_project_scope_drafts")
      .select("scope_draft")
      .eq("project_id", seedProjectAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("admin can read admin scope draft table", async () => {
    const admin = cachedAdmin;
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "admin-draft-read");
    const { error } = await admin
      .from("admin_project_scope_drafts")
      .select("project_id")
      .eq("project_id", projectId)
      .maybeSingle();
    expect(error).toBeNull();
  });

  it("rejects empty and invalid intake submissions without partial writes", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyBId, "invalid-submit");
    const customer = cachedUserB;
    const before = await customer
      .from("client_projects")
      .select("company_name")
      .eq("id", projectId)
      .single();

    const empty = await customer.rpc("customer_submit_intake", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_submission: { company: "", contactName: "", email: "bad", selectedTools: [] },
    });
    expect(empty.error?.message).toMatch(/INTAKE_VALIDATION/i);

    const after = await customer
      .from("client_projects")
      .select("company_name")
      .eq("id", projectId)
      .single();
    expect(after.data?.company_name).toBe(before.data?.company_name);

    const intake = await customer
      .from("project_intake")
      .select("form_status")
      .eq("project_id", projectId)
      .maybeSingle();
    expect(intake.data).toBeNull();
  });

  it("rejects malformed intake draft payloads", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyBId, "malformed-draft");
    const customer = cachedUserB;
    const { error } = await customer.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "9",
      p_draft: { selectedTools: "not-an-array" },
    });
    expect(error?.message).toMatch(/INTAKE_VALIDATION/i);
  });

  it("customer saves intake draft on own project", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "draft-save");
    const { data, error } = await cachedUserA.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "1",
      p_draft: minimalDraft("Acme HVAC"),
    });
    expect(error).toBeNull();
    expect((data as { draft_version?: number })?.draft_version).toBe(1);
  });

  it("concurrent first saves: only one wins and stale tab cannot overwrite", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "concurrent-first-save");
    const tabA = cachedUserA;
    const tabB = cachedUserA;

    const [saveA, saveB] = await Promise.all([
      tabA.rpc("customer_save_intake_draft", {
        p_project_id: projectId,
        p_expected_version: 0,
        p_current_step: "1",
        p_draft: minimalDraft("Tab A wins"),
      }),
      tabB.rpc("customer_save_intake_draft", {
        p_project_id: projectId,
        p_expected_version: 0,
        p_current_step: "1",
        p_draft: minimalDraft("Tab B loses"),
      }),
    ]);

    const results = [saveA, saveB];
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.error?.message).toMatch(/VERSION_CONFLICT/i);

    const { data: intake } = await tabA
      .from("project_intake")
      .select("draft, draft_version")
      .eq("project_id", projectId)
      .single();
    expect(intake!.draft_version).toBe(1);
    const savedCompany = (intake!.draft as { company?: string }).company;
    expect(savedCompany === "Tab A wins" || savedCompany === "Tab B loses").toBe(true);

    const stale = await tabB.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "2",
      p_draft: minimalDraft("Stale overwrite attempt"),
    });
    expect(stale.error?.message).toMatch(/VERSION_CONFLICT/i);
    const { data: afterStale } = await tabA
      .from("project_intake")
      .select("draft")
      .eq("project_id", projectId)
      .single();
    expect((afterStale!.draft as { company?: string }).company).toBe(savedCompany);
  });

  it("denies cross-company intake save", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyBId, "cross-company");
    const client = cachedUserA;
    const { error } = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "1",
      p_draft: { company: "Hack" },
    });
    expect(error?.message).toMatch(/FORBIDDEN/i);
  });

  it("rejects stale intake draft version", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyBId, "stale-version");
    const client = cachedUserB;

    const first = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "1",
      p_draft: minimalDraft("Fresh save"),
    });
    expect(first.error).toBeNull();

    const { error } = await client.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_current_step: "2",
      p_draft: minimalDraft("Stale tab"),
    });
    expect(error?.message).toMatch(/VERSION_CONFLICT/i);
  });

  it("denies direct customer UPDATE on client_projects fees", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "fee-update");
    const client = cachedUserA;
    const attempt = await client
      .from("client_projects")
      .update({ setup_fee: 123456 })
      .eq("id", projectId)
      .select("id");
    expect(attempt.error || attempt.data?.length === 0).toBeTruthy();
  });

  it("denies customer admin scope draft RPC", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "admin-rpc-deny");
    const client = cachedUserA;
    const { error } = await client.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: { company_name: "X" },
      p_scope_draft: { setup_fee: 9999 },
    });
    expect(error?.message).toMatch(/FORBIDDEN/i);
  });

  it("blocks scope acceptance while unpublished material edits exist", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "unpublished-material");
    const admin = cachedAdmin;
    const scope = {
      setup_fee: 5000,
      monthly_fee: 400,
      agreed_scope_summary: "Pending publish block test",
      dashboard_scope: "Ops",
      accepted_sources_in: ["QuickBooks"],
      accepted_screens: ["Overview"],
    };
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: scope,
    });
    const { data: pub } = await admin.rpc("admin_publish_scope", { p_project_id: projectId });
    const pubRow = pub as { revision?: number; scope_revision_id?: string };
    expect(pubRow.revision).toBeDefined();
    expect(pubRow.scope_revision_id).toBeDefined();
    const revision = pubRow.revision as number;
    const scopeRevisionId = pubRow.scope_revision_id as string;

    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: { ...scope, setup_fee: 5100 },
    });

    const customer = cachedUserA;
    const blocked = await customer.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(blocked.error?.message).toMatch(/UNPUBLISHED_MATERIAL/i);

    const { data: pub2, error: pub2Err } = await admin.rpc("admin_publish_scope", {
      p_project_id: projectId,
    });
    expect(pub2Err).toBeNull();
    const pub2Row = pub2 as { revision?: number; scope_revision_id?: string };
    const rev2 = pub2Row.revision as number;
    const id2 = pub2Row.scope_revision_id as string;
    const accept = await customer.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: rev2,
      p_scope_revision_id: id2,
    });
    expect(accept.error).toBeNull();
  });

  it("contact-only admin edits do not block acceptance of current published revision", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "contact-only");
    const admin = cachedAdmin;
    const scope = {
      setup_fee: 3300,
      monthly_fee: 275,
      agreed_scope_summary: "Contact-only test",
      dashboard_scope: "KPIs",
      accepted_sources_in: ["Stripe"],
      accepted_screens: ["Home"],
    };
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: scope,
    });
    const { data: pub } = await admin.rpc("admin_publish_scope", { p_project_id: projectId });
    const pubRow = pub as { revision?: number; scope_revision_id?: string };
    const revision = pubRow.revision as number;
    const scopeRevisionId = pubRow.scope_revision_id as string;

    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: { ...scopeContact, contact_name: "Alex Updated", phone: "555-0199" },
      p_scope_draft: scope,
    });

    const customer = cachedUserA;
    const accept = await customer.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(accept.error).toBeNull();
  });

  it("admin publishes scope and customer accepts revision", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "publish-accept");
    const admin = cachedAdmin;
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
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
      p_project_id: projectId,
    });
    expect(publishError).toBeNull();
    const revision = (publishData as { revision?: number })?.revision;
    const scopeRevisionId = (publishData as { scope_revision_id?: string })?.scope_revision_id;
    expect(revision).toBeGreaterThan(0);
    expect(scopeRevisionId).toBeTruthy();

    const customer = cachedUserA;
    const accept = await customer.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(accept.error).toBeNull();

    const stale = await customer.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision! - 1,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(stale.error?.message).toMatch(/STALE_REVISION/i);
  });

  it("customer records scope change request (not admin notes)", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyAId, "scope-change-req");
    const admin = cachedAdmin;
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: {
        setup_fee: 3000,
        monthly_fee: 250,
        agreed_scope_summary: "Change request test",
        dashboard_scope: "Ops",
        accepted_sources_in: ["QuickBooks"],
        accepted_screens: ["Overview"],
      },
    });
    const { data: pub } = await admin.rpc("admin_publish_scope", { p_project_id: projectId });
    const rev = (pub as { revision?: number }).revision as number;

    const customer = cachedUserA;
    const direct = await customer.from("scope_change_requests").insert({
      project_id: projectId,
      company_id: "00000000-0000-0000-0000-000000000000",
      revision: rev,
      note: "hack",
      requested_by: "00000000-0000-0000-0000-000000000000",
    });
    expect(direct.error).toBeTruthy();

    const notes = await customer.from("admin_project_notes").select("id").limit(1);
    expect(notes.error).toBeTruthy();

    const { error } = await customer.rpc("customer_request_scope_changes", {
      p_project_id: projectId,
      p_revision: rev,
      p_note: "Please adjust monthly fee.",
    });
    expect(error).toBeNull();
  });

  it("blocks draft saves after intake submission", async () => {
    const projectId = await createOwnedTestProject(adminClient(), companyBId, "post-submit-block");
    const customer = cachedUserB;

    const submit = await customer.rpc("customer_submit_intake", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_submission: validSubmission({
        selectedTools: ["other"],
        otherToolExplanation: "Legacy spreadsheet",
      }),
    });
    expect(submit.error).toBeNull();

    const draft = await customer.rpc("customer_save_intake_draft", {
      p_project_id: projectId,
      p_expected_version: 1,
      p_current_step: "1",
      p_draft: minimalDraft("After submit"),
    });
    expect(draft.error?.message).toMatch(/INTAKE_SUBMITTED/i);
  });
});
