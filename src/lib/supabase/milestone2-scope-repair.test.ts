import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
  setMilestone2TestAdminScopeDraft,
  setMilestone2TestScopeFlags,
} from "./milestone2-test-fixtures";

const USER_A = "member-a@acme.dev";
const ADMIN = "admin@ravenview.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE2_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE2_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "Supabase URL and publishable key" };
  }
  const seed = loadDevSeedCredentials();
  if (!seed?.users[USER_A] || !seed?.users[ADMIN]) {
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

describe("Milestone 2 scope publish-state repair", () => {
  const check = prereq();
  const created: string[] = [];

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE2_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Scope repair DB tests require ${check.reason}.`);
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
  let cachedAdmin: SupabaseClient;
  let cachedUserA: SupabaseClient;

  beforeAll(async () => {
    cachedAdmin = await signIn(url, pubKey, ADMIN, seed.users[ADMIN]!);
    cachedUserA = await signIn(url, pubKey, USER_A, seed.users[USER_A]!);
    companyAId = await readCompanyIdBySlug(cachedAdmin, "acme-hvac");
  });

  afterEach(async () => {
    while (created.length) {
      await deleteMilestone2TestProject(cachedAdmin, created.pop()!);
    }
  });

  async function newProject(label: string) {
    const id = await createMilestone2TestProject(cachedAdmin, companyAId, label);
    created.push(id);
    return id;
  }

  async function readFlags(projectId: string) {
    const { data, error } = await cachedAdmin
      .from("client_projects")
      .select("scope_pending_material_publish, scope_material_review_required")
      .eq("id", projectId)
      .single();
    if (error) throw error;
    return data!;
  }

  async function repair(projectId: string) {
    const { error } = await cachedAdmin.rpc("admin_repair_scope_publish_state", {
      p_project_id: projectId,
    });
    expect(error).toBeNull();
  }

  const contact = {
    company_name: "M2 Scope Test Co",
    contact_name: "Alex",
    email: "m2-scope@test.local",
    phone: "555-0100",
    website: "",
  };

  it("published scope with unchanged draft: pending false", async () => {
    const projectId = await newProject("repair-unchanged");
    const scope = {
      setup_fee: 2100,
      monthly_fee: 210,
      agreed_scope_summary: "Unchanged draft",
      dashboard_scope: "Ops",
      accepted_sources_in: ["QuickBooks"],
      accepted_screens: ["Overview"],
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: scope,
    });
    await cachedAdmin.rpc("admin_publish_scope", { p_project_id: projectId });
    await repair(projectId);
    const flags = await readFlags(projectId);
    expect(flags.scope_pending_material_publish).toBe(false);
    expect(flags.scope_material_review_required).toBe(false);
  });

  it("material fee change after publish: pending true", async () => {
    const projectId = await newProject("repair-material-diff");
    const scope = {
      setup_fee: 2200,
      monthly_fee: 220,
      agreed_scope_summary: "Material diff",
      dashboard_scope: "Ops",
      accepted_sources_in: ["Stripe"],
      accepted_screens: ["Home"],
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: scope,
    });
    await cachedAdmin.rpc("admin_publish_scope", { p_project_id: projectId });
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: { ...scope, monthly_fee: 299 },
    });
    await setMilestone2TestScopeFlags(cachedAdmin, projectId, false, false);
    await repair(projectId);
    const flags = await readFlags(projectId);
    expect(flags.scope_pending_material_publish).toBe(true);
    expect(flags.scope_material_review_required).toBe(false);
  });

  it("contact-only edits: pending false after repair", async () => {
    const projectId = await newProject("repair-contact-only");
    const scope = {
      setup_fee: 2300,
      monthly_fee: 230,
      agreed_scope_summary: "Contact only repair",
      dashboard_scope: "KPIs",
      accepted_sources_in: ["Square"],
      accepted_screens: ["Dash"],
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: scope,
    });
    await cachedAdmin.rpc("admin_publish_scope", { p_project_id: projectId });
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: { ...contact, contact_name: "Alex Updated" },
      p_scope_draft: scope,
    });
    await repair(projectId);
    const flags = await readFlags(projectId);
    expect(flags.scope_pending_material_publish).toBe(false);
  });

  it("no published scope: pending false", async () => {
    const projectId = await newProject("repair-no-publish");
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: {
        setup_fee: 2400,
        monthly_fee: 240,
        agreed_scope_summary: "Draft only",
        dashboard_scope: "Ops",
        accepted_sources_in: ["QuickBooks"],
        accepted_screens: ["Overview"],
      },
    });
    await repair(projectId);
    const flags = await readFlags(projectId);
    expect(flags.scope_pending_material_publish).toBe(false);
    expect(flags.scope_material_review_required).toBe(false);
  });

  it("ambiguous legacy draft flags review and blocks acceptance", async () => {
    const projectId = await newProject("repair-ambiguous");
    const scope = {
      setup_fee: 2500,
      monthly_fee: 250,
      agreed_scope_summary: "Ambiguous legacy",
      dashboard_scope: "Ops",
      accepted_sources_in: ["QuickBooks"],
      accepted_screens: ["Overview"],
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: scope,
    });
    const { data: pub } = await cachedAdmin.rpc("admin_publish_scope", { p_project_id: projectId });
    const revision = (pub as { revision?: number }).revision as number;
    const scopeRevisionId = (pub as { scope_revision_id?: string }).scope_revision_id as string;

    await setMilestone2TestAdminScopeDraft(cachedAdmin, projectId, {});
    await setMilestone2TestScopeFlags(cachedAdmin, projectId, false, false);

    await repair(projectId);
    const flags = await readFlags(projectId);
    expect(flags.scope_material_review_required).toBe(true);
    expect(flags.scope_pending_material_publish).toBe(true);

    const blocked = await cachedUserA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: revision,
      p_scope_revision_id: scopeRevisionId,
    });
    expect(blocked.error?.message).toMatch(/SCOPE_REVIEW_REQUIRED/i);
  });

  it("repair is idempotent when run twice", async () => {
    const projectId = await newProject("repair-repeat");
    const scope = {
      setup_fee: 2600,
      monthly_fee: 260,
      agreed_scope_summary: "Repeat repair",
      dashboard_scope: "Ops",
      accepted_sources_in: ["HubSpot"],
      accepted_screens: ["Reports"],
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: scope,
    });
    await cachedAdmin.rpc("admin_publish_scope", { p_project_id: projectId });
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: { ...scope, accepted_screens: ["Reports", "Settings"] },
    });
    await setMilestone2TestScopeFlags(cachedAdmin, projectId, false, false);

    await repair(projectId);
    const once = await readFlags(projectId);
    await repair(projectId);
    const twice = await readFlags(projectId);
    expect(twice).toEqual(once);
    expect(twice.scope_pending_material_publish).toBe(true);
  });
});
