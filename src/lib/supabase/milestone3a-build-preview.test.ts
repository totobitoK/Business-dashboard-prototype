import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WORKSPACE_ALPINE_HVAC, WORKSPACE_MERIDIAN_RETAIL } from "../customer-workspaces";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
} from "./milestone2-test-fixtures";
import {
  createM3aNonTestDisposableProject,
  deleteM3aNonTestDisposableProject,
  fingerprintAcmeSharedSeedProjects,
} from "./milestone3a-disposable-fixture";

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
  const disposableCreated: string[] = [];

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
  let sharedSeedFingerprint: string;

  beforeAll(async () => {
    admin = await signIn(url, pubKey, ADMIN, seed.users[ADMIN]!);
    userA = await signIn(url, pubKey, USER_A, seed.users[USER_A]!);
    userB = await signIn(url, pubKey, USER_B, seed.users[USER_B]!);
    companyAId = await readCompanyIdBySlug(admin, "acme-hvac");
    companyBId = await readCompanyIdBySlug(admin, "beta-retail");
    sharedSeedFingerprint = await fingerprintAcmeSharedSeedProjects(admin, companyAId);
  });

  afterEach(async () => {
    while (disposableCreated.length) {
      await deleteM3aNonTestDisposableProject(admin, disposableCreated.pop()!);
    }
    while (created.length) {
      await deleteMilestone2TestProject(admin, created.pop()!);
    }
  });

  afterAll(async () => {
    const after = await fingerprintAcmeSharedSeedProjects(admin, companyAId);
    expect(after).toBe(sharedSeedFingerprint);
  });

  async function newProject(label: string) {
    const id = await createMilestone2TestProject(admin, companyAId, label);
    created.push(id);
    return id;
  }

  async function publishScopeAccepted(
    projectId: string,
    contact: Omit<typeof scopeContact, "email"> & { email?: string } = scopeContact
  ) {
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
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

  async function newNonTestDisposable(label: string) {
    const id = await createM3aNonTestDisposableProject(admin, companyAId, label);
    disposableCreated.push(id);
    return id;
  }

  /** Omit email so admin_save_scope_draft preserves the disposable fixture address. */
  const nonTestFixtureScopeContact = {
    company_name: "M3A Fixture Scope Co",
    contact_name: "Alex",
    phone: "555-0100",
    website: "",
  };

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
  }, 15000);

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

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["unknown", "ws-unknown"],
  ])("rejects %s workspace mapping on publish", async (_label, demoWorkspaceId) => {
    const projectId = await newProject(`m3a-bad-ws-${_label}`);
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const bad = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: demoWorkspaceId,
    });
    expect(bad.error?.message).toMatch(/INVALID_DEMO_WORKSPACE/i);
  });

  it("rejects null workspace mapping on publish", async () => {
    const projectId = await newProject("m3a-bad-ws-null");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const bad = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: null,
    });
    expect(bad.error?.message).toMatch(/INVALID_DEMO_WORKSPACE/i);
  });

  it("accepts valid workspace mappings on publish", async () => {
    const projectId = await newProject("m3a-good-ws");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const meridian = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_MERIDIAN_RETAIL,
    });
    expect(meridian.error).toBeNull();
  });

  it("rejects invalid workspace mapping on approval", async () => {
    const projectId = await newProject("m3a-bad-ws-approve");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    await admin.rpc("admin_milestone3a_test_set_preview_workspace", {
      p_preview_revision_id: pub.preview_revision_id,
      p_demo_workspace_id: "  ",
    });
    const blocked = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: pub.preview_revision_id,
    });
    expect(blocked.error?.message).toMatch(/INVALID_DEMO_WORKSPACE/i);
  });

  it("allows platform admin to mutate preview workspace on M2 test fixtures", async () => {
    const projectId = await newProject("m3a-test-rpc-ok");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    const ok = await admin.rpc("admin_milestone3a_test_set_preview_workspace", {
      p_preview_revision_id: pub.preview_revision_id,
      p_demo_workspace_id: WORKSPACE_MERIDIAN_RETAIL,
    });
    expect(ok.error).toBeNull();
    const row = await admin
      .from("preview_revisions")
      .select("demo_workspace_id")
      .eq("id", pub.preview_revision_id)
      .single();
    expect(row.data?.demo_workspace_id).toBe(WORKSPACE_MERIDIAN_RETAIL);
  });

  it("denies test workspace RPC on non-test projects and leaves preview and approvals unchanged", async () => {
    const projectId = await newNonTestDisposable("rpc-deny-non-test");
    await publishScopeAccepted(projectId, nonTestFixtureScopeContact);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    expect(
      (
        await userA.rpc("customer_approve_preview", {
          p_project_id: projectId,
          p_preview_revision_id: pub.preview_revision_id,
        })
      ).error
    ).toBeNull();

    const previewBefore = await admin
      .from("preview_revisions")
      .select("demo_workspace_id, status")
      .eq("id", pub.preview_revision_id)
      .single();
    const approvalsBefore = await admin
      .from("preview_revision_approvals")
      .select("id")
      .eq("preview_revision_id", pub.preview_revision_id);

    const denied = await admin.rpc("admin_milestone3a_test_set_preview_workspace", {
      p_preview_revision_id: pub.preview_revision_id,
      p_demo_workspace_id: "ws-evil-mapping",
    });
    expect(denied.error).not.toBeNull();
    expect(denied.error!.message).toMatch(/FORBIDDEN/i);

    const previewAfter = await admin
      .from("preview_revisions")
      .select("demo_workspace_id, status")
      .eq("id", pub.preview_revision_id)
      .single();
    const approvalsAfter = await admin
      .from("preview_revision_approvals")
      .select("id")
      .eq("preview_revision_id", pub.preview_revision_id);

    expect(previewAfter.data).toEqual(previewBefore.data);
    expect(approvalsAfter.data?.length).toBe(approvalsBefore.data?.length);
  });

  it("denies customer invocation of test workspace RPC without mutating preview", async () => {
    const projectId = await newProject("m3a-test-rpc-customer");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);

    const previewBefore = await admin
      .from("preview_revisions")
      .select("demo_workspace_id, status")
      .eq("id", pub.preview_revision_id)
      .single();

    const denied = await userA.rpc("admin_milestone3a_test_set_preview_workspace", {
      p_preview_revision_id: pub.preview_revision_id,
      p_demo_workspace_id: "ws-evil-mapping",
    });
    expect(denied.error).not.toBeNull();
    expect(denied.error!.message).toMatch(/FORBIDDEN/i);

    const previewAfter = await admin
      .from("preview_revisions")
      .select("demo_workspace_id, status")
      .eq("id", pub.preview_revision_id)
      .single();
    expect(previewAfter.data).toEqual(previewBefore.data);
  });

  it("blocks preview publish when material scope edits are unpublished", async () => {
    const projectId = await newProject("m3a-pending-material");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: { ...scopeDraft, monthly_fee: 499 },
    });
    const blocked = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_ALPINE_HVAC,
    });
    expect(blocked.error?.message).toMatch(/UNPUBLISHED_MATERIAL/i);
  });

  it("material draft edit invalidates ready preview before scope republish", async () => {
    const projectId = await newProject("m3a-draft-invalidate");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const preview = await publishPreview(projectId);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: { ...scopeDraft, monthly_fee: 499 },
    });
    const row = await admin
      .from("client_projects")
      .select("current_ready_preview_id, preview_feedback_unresolved")
      .eq("id", projectId)
      .single();
    expect(row.data?.current_ready_preview_id).toBeNull();
    expect(row.data?.preview_feedback_unresolved).toBe(true);

    const staleApprove = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: preview.preview_revision_id,
    });
    expect(staleApprove.error?.message).toMatch(/STALE_PREVIEW|UNPUBLISHED_MATERIAL/i);
  });

  it("contact-only draft save preserves preview eligibility", async () => {
    const projectId = await newProject("m3a-contact-only");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const preview = await publishPreview(projectId);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: { ...scopeContact, contact_name: "Alex Updated" },
      p_scope_draft: scopeDraft,
    });
    const row = await admin
      .from("client_projects")
      .select("current_ready_preview_id, scope_pending_material_publish")
      .eq("id", projectId)
      .single();
    expect(row.data?.current_ready_preview_id).toBe(preview.preview_revision_id);
    expect(row.data?.scope_pending_material_publish).toBe(false);

    const approve = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: preview.preview_revision_id,
    });
    expect(approve.error).toBeNull();
  });

  it("requires discovery and guided setup before preview publish", async () => {
    const projectId = await newProject("m3a-build-pre");
    await publishScopeAccepted(projectId);
    const blocked = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_ALPINE_HVAC,
    });
    expect(blocked.error?.message).toMatch(/BUILD_PREREQUISITES_INCOMPLETE/i);
  });

  it("rejects approval when guided setup is cleared after preview is ready", async () => {
    const projectId = await newProject("m3a-clear-guided-approve");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_guided_setup_complete: false,
    });
    const blocked = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: pub.preview_revision_id,
    });
    expect(blocked.error?.message).toMatch(/BUILD_PREREQUISITES_INCOMPLETE|STALE_PREVIEW/i);
    const row = await admin
      .from("client_projects")
      .select("current_ready_preview_id")
      .eq("id", projectId)
      .single();
    expect(row.data?.current_ready_preview_id).toBeNull();
  });

  it("invalidates current eligibility when discovery is cleared after approval", async () => {
    const projectId = await newProject("m3a-clear-discovery");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    expect(
      (
        await userA.rpc("customer_approve_preview", {
          p_project_id: projectId,
          p_preview_revision_id: pub.preview_revision_id,
        })
      ).error
    ).toBeNull();

    const approvalsBefore = await admin
      .from("preview_revision_approvals")
      .select("id")
      .eq("project_id", projectId);
    expect(approvalsBefore.data?.length).toBe(1);

    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_discovery_complete: false,
    });

    const project = await admin
      .from("client_projects")
      .select("current_ready_preview_id, preview_feedback_unresolved")
      .eq("id", projectId)
      .single();
    expect(project.data?.current_ready_preview_id).toBeNull();
    expect(project.data?.preview_feedback_unresolved).toBe(true);

    const approvalsAfter = await admin
      .from("preview_revision_approvals")
      .select("id")
      .eq("project_id", projectId);
    expect(approvalsAfter.data?.length).toBe(1);
  });

  it("progress-note-only build updates preserve preview eligibility", async () => {
    const projectId = await newProject("m3a-note-only");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_customer_progress_note: "Still building — no prerequisite change.",
    });
    const row = await admin
      .from("client_projects")
      .select("current_ready_preview_id")
      .eq("id", projectId)
      .single();
    expect(row.data?.current_ready_preview_id).toBe(pub.preview_revision_id);

    const approve = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: pub.preview_revision_id,
    });
    expect(approve.error).toBeNull();
  });

  it("requires new preview approval after prerequisites are restored", async () => {
    const projectId = await newProject("m3a-restore-pre");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const v1 = await publishPreview(projectId);
    await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v1.preview_revision_id,
    });

    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_guided_setup_complete: false,
    });

    await admin.rpc("admin_update_build_progress", {
      p_project_id: projectId,
      p_guided_setup_complete: true,
    });

    const stale = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v1.preview_revision_id,
    });
    expect(stale.error?.message).toMatch(/STALE_PREVIEW|PREVIEW_NOT_READY|BUILD_PREREQUISITES/i);

    await markBuildReady(projectId);
    const v2 = await publishPreview(projectId);
    expect(v2.preview_revision).toBeGreaterThan(v1.preview_revision);

    const fresh = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: v2.preview_revision_id,
    });
    expect(fresh.error).toBeNull();

    const approvals = await admin
      .from("preview_revision_approvals")
      .select("preview_revision_id")
      .eq("project_id", projectId);
    expect(approvals.data?.length).toBe(2);
  }, 15000);

  it("concurrent prerequisite revocation and approval leave no current eligibility", async () => {
    const projectId = await newProject("m3a-concurrent-revoke");
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);

    await Promise.all([
      admin.rpc("admin_update_build_progress", {
        p_project_id: projectId,
        p_discovery_complete: false,
      }),
      userA.rpc("customer_approve_preview", {
        p_project_id: projectId,
        p_preview_revision_id: pub.preview_revision_id,
      }),
    ]);

    const project = await admin
      .from("client_projects")
      .select("current_ready_preview_id")
      .eq("id", projectId)
      .single();
    expect(project.data?.current_ready_preview_id).toBeNull();

    const ready = await admin
      .from("preview_revisions")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "ready");
    expect(ready.data?.length ?? 0).toBe(0);
  }, 15000);
});
