import crypto from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WORKSPACE_ALPINE_HVAC } from "../customer-workspaces";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
} from "./milestone2-test-fixtures";
import { fingerprintAcmeSharedSeedProjects } from "./milestone3a-disposable-fixture";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";
const ADMIN = "admin@ravenview.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE3B_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE3B_TESTS=1" };
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
  setup_fee: 1000,
  monthly_fee: 310,
  agreed_scope_summary: "M3B activation test scope",
  dashboard_scope: "Ops KPIs",
  accepted_sources_in: ["QuickBooks"],
  accepted_screens: ["Overview"],
};

const intakeSubmission = {
  company: "Test Co",
  contactName: "Alex",
  email: "m2-m3b-submit@test.local",
  phone: "555-0100",
  businessDescription: "We install HVAC systems.",
  dashboardGoals: "Track jobs and revenue.",
  selectedTools: ["quickbooks"],
  submittedAt: new Date().toISOString(),
};

describe("Milestone 3B setup payments and activation", () => {
  const check = prereq();
  const created: string[] = [];

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE3B_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Milestone 3B DB tests require ${check.reason}.`);
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
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let sharedSeedFingerprint: string;

  beforeAll(async () => {
    admin = await signIn(url, pubKey, ADMIN, seed.users[ADMIN]!);
    userA = await signIn(url, pubKey, USER_A, seed.users[USER_A]!);
    userB = await signIn(url, pubKey, USER_B, seed.users[USER_B]!);
    companyAId = await readCompanyIdBySlug(admin, "acme-hvac");
    sharedSeedFingerprint = await fingerprintAcmeSharedSeedProjects(admin, companyAId);
  });

  afterEach(async () => {
    while (created.length) {
      await deleteMilestone2TestProject(admin, created.pop()!);
    }
  });

  afterAll(async () => {
    const after = await fingerprintAcmeSharedSeedProjects(admin, companyAId);
    expect(after).toBe(sharedSeedFingerprint);
  });

  async function newProject(label: string, setupFee = 1000) {
    const id = await createMilestone2TestProject(admin, companyAId, label);
    created.push(id);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: id,
      p_contact: scopeContact,
      p_scope_draft: { ...scopeDraft, setup_fee: setupFee },
    });
    return id;
  }

  async function submitIntake(projectId: string) {
    const submit = await userA.rpc("customer_submit_intake", {
      p_project_id: projectId,
      p_expected_version: 0,
      p_submission: intakeSubmission,
    });
    expect(submit.error).toBeNull();
  }

  async function publishScopeAccepted(projectId: string) {
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
    });
  }

  async function publishPreview(projectId: string) {
    const { data, error } = await admin.rpc("admin_publish_preview_ready", {
      p_project_id: projectId,
      p_demo_workspace_id: WORKSPACE_ALPINE_HVAC,
    });
    expect(error).toBeNull();
    return data as { preview_revision_id: string };
  }

  async function approvePreview(projectId: string, previewRevisionId: string) {
    const approve = await userA.rpc("customer_approve_preview", {
      p_project_id: projectId,
      p_preview_revision_id: previewRevisionId,
    });
    expect(approve.error).toBeNull();
  }

  async function recordPayment(
    projectId: string,
    amount: number,
    idempotencyKey?: string
  ) {
    return admin.rpc("admin_record_setup_payment", {
      p_project_id: projectId,
      p_amount: amount,
      p_payment_date: "2026-03-01",
      p_payment_method: "Check",
      p_method_reference: "test",
      p_idempotency_key: idempotencyKey ?? null,
    });
  }

  async function qualifyForActivation(projectId: string, setupFee = 1000) {
    await submitIntake(projectId);
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    await approvePreview(projectId, pub.preview_revision_id);
    if (setupFee > 0) {
      const pay = await recordPayment(projectId, setupFee);
      expect(pay.error).toBeNull();
    }
    return pub;
  }

  it("customer cannot record setup payments; cross-tenant denied", async () => {
    const projectId = await newProject("m3b-deny-pay");
    const customerPay = await userA.rpc("admin_record_setup_payment", {
      p_project_id: projectId,
      p_amount: 100,
      p_payment_date: "2026-03-01",
      p_payment_method: "Check",
    });
    expect(customerPay.error?.message).toMatch(/FORBIDDEN/i);

    const other = await createMilestone2TestProject(admin, companyAId, "m3b-other");
    created.push(other);
    const cross = await userB.rpc("admin_record_setup_payment", {
      p_project_id: projectId,
      p_amount: 100,
      p_payment_date: "2026-03-01",
      p_payment_method: "Check",
    });
    expect(cross.error?.message).toMatch(/FORBIDDEN/i);
  });

  it("supports partial, full, zero-fee, and overpayment totals", async () => {
    const zeroId = await newProject("m3b-zero", 0);
    await publishScopeAccepted(zeroId);
    let summary = await userA.rpc("member_get_setup_payment_summary", {
      p_project_id: zeroId,
    });
    expect(summary.error).toBeNull();
    expect((summary.data as { fully_paid: boolean }).fully_paid).toBe(true);

    const partialId = await newProject("m3b-partial", 1000);
    await recordPayment(partialId, 400);
    summary = await userA.rpc("member_get_setup_payment_summary", { p_project_id: partialId });
    expect(Number((summary.data as { remaining: number }).remaining)).toBe(600);

    await recordPayment(partialId, 600);
    summary = await userA.rpc("member_get_setup_payment_summary", { p_project_id: partialId });
    expect(Number((summary.data as { remaining: number }).remaining)).toBe(0);

    const overId = await newProject("m3b-over", 500);
    await recordPayment(overId, 650);
    summary = await userA.rpc("member_get_setup_payment_summary", { p_project_id: overId });
    expect(Number((summary.data as { overpayment: number }).overpayment)).toBe(150);
    expect((summary.data as { fully_paid: boolean }).fully_paid).toBe(true);
  });

  it("deduplicates payment creation via idempotency key", async () => {
    const projectId = await newProject("m3b-idem");
    const key = "idem-key-" + crypto.randomUUID();
    const first = await recordPayment(projectId, 250, key);
    const second = await recordPayment(projectId, 250, key);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect((second.data as { idempotent_replay: boolean }).idempotent_replay).toBe(true);
    expect((first.data as { payment_id: string }).payment_id).toBe(
      (second.data as { payment_id: string }).payment_id
    );
  });

  it("voids payment with reason and optional replacement; preserves voided row", async () => {
    const projectId = await newProject("m3b-void");
    const recorded = await recordPayment(projectId, 500);
    const paymentId = (recorded.data as { payment_id: string }).payment_id;
    const voided = await admin.rpc("admin_void_setup_payment", {
      p_payment_id: paymentId,
      p_void_reason: "Wrong amount entered",
      p_replacement_amount: 450,
      p_replacement_date: "2026-03-02",
      p_replacement_method: "Wire",
    });
    expect(voided.error).toBeNull();
    const rows = await admin.from("project_payments").select("*").eq("project_id", projectId);
    expect(rows.data?.length).toBe(2);
    const original = rows.data?.find((r) => r.id === paymentId);
    expect(original?.voided_at).toBeTruthy();
    expect(original?.void_reason).toMatch(/Wrong amount/i);
  });

  it("blocks activation until eligible; idempotent when already active", async () => {
    const projectId = await newProject("m3b-activate");
    const blocked = await admin.rpc("admin_activate_project", { p_project_id: projectId });
    expect(blocked.error?.message).toMatch(/ACTIVATION_BLOCKED/i);

    await qualifyForActivation(projectId, 1000);
    const ok = await admin.rpc("admin_activate_project", { p_project_id: projectId });
    expect(ok.error).toBeNull();
    const row = await admin
      .from("client_projects")
      .select("status, activated_at, activated_by")
      .eq("id", projectId)
      .single();
    expect(row.data?.status).toBe("active");
    expect(row.data?.activated_at).toBeTruthy();

    const again = await admin.rpc("admin_activate_project", { p_project_id: projectId });
    expect(again.error).toBeNull();
    expect((again.data as { already_active: boolean }).already_active).toBe(true);
  });

  it("payment and preview approval do not auto-activate", async () => {
    const projectId = await newProject("m3b-no-auto");
    await submitIntake(projectId);
    await publishScopeAccepted(projectId);
    await markBuildReady(projectId);
    const pub = await publishPreview(projectId);
    await approvePreview(projectId, pub.preview_revision_id);
    let row = await admin.from("client_projects").select("status").eq("id", projectId).single();
    expect(row.data?.status).toBe("pending");
    await recordPayment(projectId, 1000);
    row = await admin.from("client_projects").select("status").eq("id", projectId).single();
    expect(row.data?.status).toBe("pending");
  });

  it("rejects activation when preview approval is stale after scope change", async () => {
    const projectId = await newProject("m3b-stale-preview");
    await qualifyForActivation(projectId, 1000);
    await admin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: scopeContact,
      p_scope_draft: { ...scopeDraft, monthly_fee: 399 },
    });
    const blocked = await admin.rpc("admin_activate_project", { p_project_id: projectId });
    expect(blocked.error?.message).toMatch(/ACTIVATION_BLOCKED/i);
  });

  it("void after activation does not deactivate project", async () => {
    const projectId = await newProject("m3b-post-act-void");
    await qualifyForActivation(projectId, 1000);
    await admin.rpc("admin_activate_project", { p_project_id: projectId });
    const payments = await admin
      .from("project_payments")
      .select("id")
      .eq("project_id", projectId)
      .is("voided_at", null);
    const paymentId = payments.data![0]!.id as string;
    const voidRes = await admin.rpc("admin_void_setup_payment", {
      p_payment_id: paymentId,
      p_void_reason: "Post-activation correction visible in audit",
    });
    expect(voidRes.error).toBeNull();
    const row = await admin.from("client_projects").select("status").eq("id", projectId).single();
    expect(row.data?.status).toBe("active");
  });
});
