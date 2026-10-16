import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WORKSPACE_ALPINE_HVAC } from "../customer-workspaces";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
} from "./milestone2-test-fixtures";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";
const ADMIN = "admin@ravenview.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE3A_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE3A_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "Supabase URL and publishable key" };
  }
  const seed = loadDevSeedCredentials();
  if (!seed?.users[USER_A] || !seed?.users[USER_B] || !seed?.users[ADMIN]) {
    return { ok: false, reason: ".dev-seed-credentials.json (run npm run seed:dev)" };
  }
  return { ok: true };
}

async function signIn(url: string, key: string, email: string, password: string) {
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const scopeContact = {
  company_name: "M2 Scope Test Co",
  contact_name: "Alex",
  email: "m2-scope@test.local",
  phone: "555-0100",
  website: "",
};

const scopeDraft = {
  setup_fee: 3100,
  monthly_fee: 310,
  agreed_scope_summary: "M3A preview test scope",
  dashboard_scope: "Ops KPIs",
  accepted_sources_in: ["QuickBooks"],
  accepted_screens: ["Overview"],
};

describe("Milestone 3A build progress and preview review", () => {
  const check = prereq();
  const created: string[] = [];

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE3A_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Milestone 3A DB tests require ${check.reason}.`);
      });
    } else {
      it.skip(`skipped — ${check.reason}`, () => {});
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const seed = loadDevSeedCredentials()!;

  let companyAId: string;
  let companyBId: string;
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  beforeAll(async () => {
    admin = await signIn(url, pubKey, ADMIN, seed.users[ADMIN]!);
    userA = await signIn(url, pubKey, USER_A, seed.users[USER_A]!);
    userB = await signIn(url, pubKey, USER_B, seed.users[USER_B]!);
    companyAId = await readCompanyIdBySlug(admin, "acme-hvac");
    companyBId = await readCompanyIdBySlug(admin, "beta-retail");
  });

  afterEach(async () => {
    while (created.length) {
      await deleteMilestone2TestProject(admin, created.pop()!);
    }
  });

  async function newProject(label: string) {
    const id = await createMilestone2TestProject(admin, companyAId, label);
    created.push(id);
    return id;
  }

  async function publishScopeAccepted(projectId: string) {
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: scopeDraft,
    });
    const { data: pub, error: pubErr } = await admin.rpc("admin_publish_scope", {
      p_project_id: projectId,
    });
    expect(pubErr).toBeNull();
    const revision = (pub as { revision: number }).revision;
    const scopeRevisionId = (pub as { scope_revision_id: string }).scope_revision_id;
    const accept = await userA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(accept.error).toBeNull();
    return { revision, scopeRevisionId };
  }

  async function markBuildReady(projectId: string) {
    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_discovery_complete: true,
      p_guided_setup_complete: true,
      p_building_active: true,
      p_customer_progress_note: "Building sample layout",
    });
  }

  async function publishPreview(projectId: string) {
    const { data, error } = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_ALPINE_HVAC,
    });
    expect(error).toBeNull();
    return data as { preview_revision_id: string; preview_revision: number };
  }

  it("admin publishes preview → customer approves; payments and status unchanged", async () => {
    const projectId = await newProject("m3a-approve");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);

    const paymentsBefore = await admin
      .from("project_payments")
      .select("id")
      .eq("project_id", projectId);
    expect(paymentsBefore.error).toBeNull();

    const approve = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: pub.preview_revision_id,
    });
    expect(approve.error).toBeNull();

    const project = await admin
      .from("client_projects")
      .select("status, preview_feedback_unresolved")
      .eq("id", projectId)
      .single();
    expect(project.data?.status).toBe("pending");
    expect(project.data?.preview_feedback_unresolved).toBe(false);

    const paymentsAfter = await admin
      .from("project_payments")
      .select("id")
      .eq("project_id", projectId);
    expect(paymentsAfter.data?.length).toBe(paymentsBefore.data?.length);
  });

  it("feedback blocks approval until revised preview is published", async () => {
    const projectId = await newProject("m3a-feedback");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const v1 = await publishPreview(projectId);

    const feedback = await userA.rpc("customer_submit_preview_feedback", {
      p_project_id: projectId,
      p_preview_revision_id: v1.preview_revision_id,
      p_feedback: "Please adjust the revenue chart layout.",
    });
    expect(feedback.error).toBeNull();

    const blocked = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v1.preview_revision_id,
    });
    expect(blocked.error?.message).toMatch(/UNRESOLVED_FEEDBACK|PREVIEW_NOT_READY/i);

    const v2 = await publishPreview(projectId);
    expect(v2.preview_revision).toBeGreaterThan(v1.preview_revision);

    const approve = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v2.preview_revision_id,
    });
    expect(approve.error).toBeNull();
  });

  it("rejects approval of stale preview revision", async () => {
    const projectId = await newProject("m3a-stale");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const v1 = await publishPreview(projectId);
    const v2 = await publishPreview(projectId);

    const stale = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v1.preview_revision_id,
    });
    expect(stale.error?.message).toMatch(/STALE_PREVIEW/i);

    const ok = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v2.preview_revision_id,
    });
    expect(ok.error).toBeNull();
  });

  it("material scope publish and build reopen invalidate approval eligibility", async () => {
    const projectId = await newProject("m3a-invalidate");
    const { revision } = await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const preview = await publishPreview(projectId);
    expect(
      (
        await userA.rpc("customer_approve_preview", {
          p_project_id: projectId,
          p_preview_revision_id: preview.preview_revision_id,
        })
      ).error
    ).toBeNull();

    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: { ...scopeDraft, monthly_fee: 399 },
    });
    const { data: scopePub2 } = await admin.rpc("admin_publish_scope", { p_project_id: projectId });
    const rev2 = (scopePub2 as { revision: number }).revision;
    const scopeRev2Id = (scopePub2 as { scope_revision_id: string }).scope_revision_id;
    const accept2 = await userA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: rev2,
      p_scope_revision_id: scopeRev2Id,
    });
    expect(accept2.error).toBeNull();

    const afterScope = await admin
      .from("client_projects")
      .select("preview_feedback_unresolved, current_ready_preview_id")
      .eq("id", projectId)
      .single();
    expect(afterScope.data?.preview_feedback_unresolved).toBe(true);

    await markBuildReady(projectId);
    const preview2 = await publishPreview(projectId);
    expect(preview2.preview_revision).toBeGreaterThan(preview.preview_revision);

    const approveNew = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: preview2.preview_revision_id,
    });
    expect(approveNew.error).toBeNull();
    expect(revision).toBeGreaterThan(0);

    const project2 = await newProject("m3a-reopen");
    await publishScopeAccepted(project2);
    await markBuildReady(project2);
    const p = await publishPreview(project2);
    await userA.rpc("customer_approve_preview", {
      p_project_id: project2,
      p_preview_revision_id: p.preview_revision_id,
    });
    await admin.rpc("admin_reopen_build", { p_project_id: project2 });
    const blocked = await userA.rpc("customer_approve_preview", {
      p_project_id: project2,
      p_preview_revision_id: p.preview_revision_id,
    });
    expect(blocked.error?.message).toMatch(/STALE_PREVIEW|UNRESOLVED/i);
  });

  it("denies cross-company access and customer admin preview operations", async () => {
    const projectId = await newProject("m3a-isolation");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);

    const otherCompanyProject = await createMilestone2TestProject(admin, companyBId, "m3a-other");
    created.push(otherCompanyProject);

    const crossRead = await userB
      .from("preview_revisions")
      .select("id")
      .eq("project_id", projectId);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data?.length ?? 0).toBe(0);

    const crossApprove = await userB.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: pub.preview_revision_id,
    });
    expect(crossApprove.error?.message).toMatch(/FORBIDDEN/i);

    const customerAdmin = await userA.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_ALPINE_HVAC,
    });
    expect(customerAdmin.error?.message).toMatch(/FORBIDDEN/i);
  });
});
