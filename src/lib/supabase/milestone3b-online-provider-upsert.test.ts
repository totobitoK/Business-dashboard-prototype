import crypto from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import {
  createMilestone2TestProject,
  deleteMilestone2TestProject,
  readCompanyIdBySlug,
} from "./milestone2-test-fixtures";
import { fingerprintAcmeSharedSeedProjects } from "./milestone3a-disposable-fixture";

const USER_A = "member-a@acme.dev";
const ADMIN = "admin@ravenview.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE3B_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE3B_TESTS=1" };
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

type UpsertResult = {
  ok: boolean;
  payment_id: string;
  idempotent_replay: boolean;
};

describe("Milestone 3B online provider upsert hardening", () => {
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
  let companyBId: string;
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let sharedSeedFingerprint: string;

  beforeAll(async () => {
    admin = await signIn(url, pubKey, ADMIN, seed.users[ADMIN]!);
    userA = await signIn(url, pubKey, USER_A, seed.users[USER_A]!);
    companyAId = await readCompanyIdBySlug(admin, "acme-hvac");
    companyBId = await readCompanyIdBySlug(admin, "beta-retail");
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

  async function newProject(label: string, companyId = companyAId) {
    const id = await createMilestone2TestProject(admin, companyId, label);
    created.push(id);
    return id;
  }

  async function upsertOnline(
    projectId: string,
    externalId: string,
    amount = 250,
    paymentDate = "2026-04-01",
    provider = "stripe"
  ) {
    return admin.rpc("admin_milestone2_test_upsert_online_setup_payment", {
      p_project_id: projectId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_provider_name: provider,
      p_external_transaction_id: externalId,
      p_payment_method: "card",
    });
  }

  it("returns idempotent replay for exact matching provider retries", async () => {
    const projectId = await newProject("m3b-online-idem");
    const ext = "pi_" + crypto.randomUUID();
    const first = await upsertOnline(projectId, ext);
    const second = await upsertOnline(projectId, ext);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const a = first.data as UpsertResult;
    const b = second.data as UpsertResult;
    expect(a.idempotent_replay).toBe(false);
    expect(b.idempotent_replay).toBe(true);
    expect(a.payment_id).toBe(b.payment_id);

    const { data: rows } = await admin
      .from("project_payments")
      .select("id")
      .eq("project_id", projectId)
      .eq("external_transaction_id", ext);
    expect(rows).toHaveLength(1);
  });

  it("rejects provider id reuse with conflicting amount or project", async () => {
    const projectA = await newProject("m3b-online-a");
    const projectB = await newProject("m3b-online-b", companyBId);
    const ext = "pi_" + crypto.randomUUID();

    const ok = await upsertOnline(projectA, ext, 300);
    expect(ok.error).toBeNull();

    const crossProject = await upsertOnline(projectB, ext, 300);
    expect(crossProject.error?.message).toMatch(/PROVIDER_TRANSACTION_CONFLICT/i);

    const conflictAmount = await upsertOnline(projectA, ext, 301);
    expect(conflictAmount.error?.message).toMatch(/PROVIDER_TRANSACTION_CONFLICT/i);

    const conflictDate = await upsertOnline(projectA, ext, 300, "2026-04-02");
    expect(conflictDate.error?.message).toMatch(/PROVIDER_TRANSACTION_CONFLICT/i);
  });

  it("handles concurrent duplicate deliveries with one ledger row", async () => {
    const projectId = await newProject("m3b-online-race");
    const ext = "pi_" + crypto.randomUUID();
    const [a, b] = await Promise.all([
      upsertOnline(projectId, ext, 180),
      upsertOnline(projectId, ext, 180),
    ]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const ids = new Set([
      (a.data as UpsertResult).payment_id,
      (b.data as UpsertResult).payment_id,
    ]);
    expect(ids.size).toBe(1);
    expect(
      (a.data as UpsertResult).idempotent_replay || (b.data as UpsertResult).idempotent_replay
    ).toBe(true);

    const { data: rows } = await admin
      .from("project_payments")
      .select("id, amount")
      .eq("external_transaction_id", ext);
    expect(rows).toHaveLength(1);
    expect(Number(rows![0].amount)).toBe(180);
  });

  it("denies customers and unauthenticated access to test upsert RPC", async () => {
    const projectId = await newProject("m3b-online-deny");
    const member = await userA.rpc("admin_milestone2_test_upsert_online_setup_payment", {
      p_project_id: projectId,
      p_amount: 50,
      p_payment_date: "2026-04-01",
      p_provider_name: "stripe",
      p_external_transaction_id: "pi_denied",
    });
    expect(member.error?.message).toMatch(/FORBIDDEN/i);

    const anon = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const noAuth = await anon.rpc("admin_milestone2_test_upsert_online_setup_payment", {
      p_project_id: projectId,
      p_amount: 50,
      p_payment_date: "2026-04-01",
      p_provider_name: "stripe",
      p_external_transaction_id: "pi_anon",
    });
    expect(noAuth.error).toBeTruthy();
  });

  it("does not expose internal app_private upsert RPC on public API", async () => {
    const projectId = await newProject("m3b-online-internal");
    const internal = await admin.rpc("upsert_online_setup_payment", {
      p_project_id: projectId,
      p_amount: 10,
      p_payment_date: "2026-04-01",
      p_provider_name: "stripe",
      p_external_transaction_id: "pi_internal",
    });
    expect(internal.error).toBeTruthy();
    expect(internal.error?.message.toLowerCase()).toMatch(/could not find|not found|schema cache/i);
  });
});
