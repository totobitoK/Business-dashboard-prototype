import { afterEach, beforeAll, describe, expect, it } from "vitest";
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

describe("Milestone 2 scope review publish resolution", () => {
  const check = prereq();
  const created: string[] = [];

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE2_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Scope review resolution DB tests require ${check.reason}.`);
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

  const contact = {
    company_name: "M2 Scope Test Co",
    contact_name: "Alex",
    email: "m2-scope@test.local",
    phone: "555-0100",
    website: "",
  };

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
      .select(
        "scope_pending_material_publish, scope_material_review_required, published_revision"
      )
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

  it(
    "admin confirms review on publish, customer accepts new revision; customer cannot publish",
    async () => {
    const projectId = await newProject("review-resolution");
    const scope = {
      setup_fee: 2700,
      monthly_fee: 270,
      agreed_scope_summary: "Before review resolution",
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
    const oldRevision = (pub as { revision?: number }).revision as number;
    const oldScopeRevisionId = (pub as { scope_revision_id?: string }).scope_revision_id as string;

    await setMilestone2TestAdminScopeDraft(cachedAdmin, projectId, {});
    await setMilestone2TestScopeFlags(cachedAdmin, projectId, false, false);
    await repair(projectId);

    let flags = await readFlags(projectId);
    expect(flags.scope_material_review_required).toBe(true);
    expect(flags.scope_pending_material_publish).toBe(true);

    const blocked = await cachedUserA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: oldRevision,
      p_scope_revision_id: oldScopeRevisionId,
    });
    expect(blocked.error?.message).toMatch(/SCOPE_REVIEW_REQUIRED/i);

    const correctedScope = {
      ...scope,
      agreed_scope_summary: "Admin corrected material terms",
      monthly_fee: 275,
    };
    await cachedAdmin.rpc("admin_save_scope_draft", {
      p_project_id: projectId,
      p_contact: contact,
      p_scope_draft: correctedScope,
    });

    flags = await readFlags(projectId);
    expect(flags.scope_material_review_required).toBe(true);

    const noConfirm = await cachedAdmin.rpc("admin_publish_scope", {
      p_project_id: projectId,
      p_confirm_scope_review: false,
    });
    expect(noConfirm.error?.message).toMatch(/SCOPE_REVIEW_CONFIRMATION_REQUIRED/i);

    flags = await readFlags(projectId);
    expect(flags.scope_material_review_required).toBe(true);
    expect(flags.scope_pending_material_publish).toBe(true);

    const resolved = await cachedAdmin.rpc("admin_publish_scope", {
      p_project_id: projectId,
      p_confirm_scope_review: true,
    });
    expect(resolved.error).toBeNull();
    const newRevision = (resolved.data as { revision?: number }).revision as number;
    const newScopeRevisionId = (resolved.data as { scope_revision_id?: string })
      .scope_revision_id as string;
    expect(newRevision).toBeGreaterThan(oldRevision);

    flags = await readFlags(projectId);
    expect(flags.scope_material_review_required).toBe(false);
    expect(flags.scope_pending_material_publish).toBe(false);
    expect(flags.published_revision).toBe(newRevision);

    const staleAfterPublish = await cachedUserA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: oldRevision,
      p_scope_revision_id: oldScopeRevisionId,
    });
    expect(staleAfterPublish.error?.message).toMatch(/STALE_REVISION|SCOPE_REVIEW/i);

    const accept = await cachedUserA.rpc("customer_accept_scope", {
      p_project_id: projectId,
      p_revision: newRevision,
      p_scope_revision_id: newScopeRevisionId,
    });
    expect(accept.error).toBeNull();

    const customerPublish = await cachedUserA.rpc("admin_publish_scope", {
      p_project_id: projectId,
      p_confirm_scope_review: true,
    });
    expect(customerPublish.error?.message).toMatch(/FORBIDDEN/i);
    },
    15000
  );
});
