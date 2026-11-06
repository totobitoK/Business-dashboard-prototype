import crypto from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashOAuthState } from "../square/oauth-state";
import {
  createDisposableM4aCompany,
  deleteDisposableM4aCompany,
} from "./milestone4a-test-fixtures";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_SQUARE_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_SQUARE_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "Supabase URL and publishable key" };
  }
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, reason: "SUPABASE_SECRET_KEY" };
  const seed = loadDevSeedCredentials();
  if (!seed?.users[USER_A] || !seed.users[USER_B]) {
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

describe("Square tenant isolation and collection rules", () => {
  const check = prereq();
  let service: SupabaseClient;
  let ownerUserId: string;
  let disposableCompanyId: string | null = null;

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_SQUARE_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Square DB tests require ${check.reason}.`);
      });
    } else {
      it.skip(`skipped — ${check.reason}`, () => {});
    }
    return;
  }

  beforeAll(async () => {
    process.env.SQUARE_OAUTH_STATE_SECRET = "square-state-secret-at-least-32-chars";
    service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: users } = await service.auth.admin.listUsers();
    ownerUserId = users.users.find((user) => user.email === USER_A)?.id ?? "";
    expect(ownerUserId).toBeTruthy();
  });

  afterEach(async () => {
    if (disposableCompanyId) {
      await deleteDisposableM4aCompany(service, disposableCompanyId);
      disposableCompanyId = null;
    }
  }, 30_000);

  it("hides another company's collections and keeps partial refunds on the reporting date", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    const { data: connection, error: connectionError } = await service
      .from("square_connections")
      .insert({
        company_id: disposableCompanyId,
        square_environment: "sandbox",
        merchant_id: "MERCHANT1",
        merchant_name: "Sandbox Seller",
        status: "connected",
        reporting_timezone: "America/New_York",
        reporting_timezone_source: "configured",
      })
      .select("id, sync_generation")
      .single();
    expect(connectionError).toBeNull();
    const connectionId = connection!.id as string;
    const generation = Number(connection!.sync_generation);

    const duplicate = await service.from("square_connections").insert({
      company_id: disposableCompanyId,
      square_environment: "sandbox",
      status: "connected",
    });
    expect(duplicate.error).toBeTruthy();

    await service.from("square_connection_secrets").insert({
      connection_id: connectionId,
      company_id: disposableCompanyId,
      refresh_token_enc: "enc-refresh",
      access_token_enc: "enc-access",
    });

    const replaced = await service.rpc("square_replace_locations", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_locations: [
        { square_location_id: "LOC1", name: "Main", status: "ACTIVE", currency: "USD" },
        { square_location_id: "LOC2", name: "Closed", status: "INACTIVE", currency: "USD" },
      ],
    });
    expect(replaced.data).toBe(true);

    const saved = await service.rpc("square_save_location_selection", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_location_ids: ["LOC1", "LOC2"],
    });
    expect(saved.data).toBe(1);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const seed = loadDevSeedCredentials()!;
    const owner = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const other = await signIn(url, key, USER_B, seed.users[USER_B]!);

    const secrets = await owner.from("square_connection_secrets").select("*");
    expect(secrets.error?.message ?? "no access").toMatch(/permission|denied|schema/i);

    const otherList = await other.rpc("member_list_square_transactions", {
      p_company_id: disposableCompanyId,
    });
    expect(otherList.error?.message ?? "").toMatch(/FORBIDDEN/);

    const otherRows = await other
      .from("square_transactions")
      .select("id")
      .eq("company_id", disposableCompanyId);
    expect(otherRows.data ?? []).toHaveLength(0);

    const workerId = "worker-square";
    const lease = await service.rpc("square_acquire_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: workerId,
      p_ttl_seconds: 300,
    });
    expect(lease.data).toBe(true);

    const syncRunId = crypto.randomUUID();
    const payment = {
      kind: "payment",
      square_id: "pay_1",
      location_id: "LOC1",
      location_name: "Main",
      created_at: "2026-11-07T03:30:00Z",
      reporting_date: "2026-11-06",
      currency: "USD",
      amount_minor: "1000",
      source_type: "CARD",
    };
    const wrongCompany = await service.rpc("square_upsert_transactions", {
      p_connection_id: connectionId,
      p_company_id: crypto.randomUUID(),
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_transactions: [payment],
    });
    expect(wrongCompany.data).toBe(false);

    const wrote = await service.rpc("square_upsert_transactions", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_transactions: [
        payment,
        payment,
        {
          kind: "refund",
          square_id: "ref_partial",
          location_id: "LOC1",
          created_at: "2026-11-06T18:00:00Z",
          reporting_date: "2026-11-06",
          currency: "USD",
          amount_minor: "250",
        },
        {
          kind: "refund",
          square_id: "ref_yesterday",
          location_id: "LOC1",
          created_at: "2026-11-05T18:00:00Z",
          reporting_date: "2026-11-05",
          currency: "USD",
          amount_minor: "100",
        },
        {
          kind: "payment",
          square_id: "pay_other",
          location_id: "LOC2",
          created_at: "2026-11-06T18:00:00Z",
          reporting_date: "2026-11-06",
          currency: "USD",
          amount_minor: "900",
        },
      ],
    });
    expect(wrote.error).toBeNull();
    expect(wrote.data).toBe(true);

    const again = await service.rpc("square_upsert_transactions", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_transactions: [payment],
    });
    expect(again.data).toBe(true);

    const finalized = await service.rpc("square_finalize_transactions", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_reporting_date: "2026-11-06",
      p_reporting_timezone: "America/New_York",
      p_merchant_name: "Sandbox Seller",
    });
    expect(finalized.data).toBe(0);

    const status = await owner.rpc("member_get_square_status", { p_company_id: disposableCompanyId });
    const totals = status.data.currency_totals as Array<{
      currency: string;
      payments_minor: number;
      refunds_minor: number;
    }>;
    expect(totals).toEqual([{ currency: "USD", payments_minor: 1000, refunds_minor: 250 }]);

    const list = await owner.rpc("member_list_square_transactions", { p_company_id: disposableCompanyId });
    const rows = (list.data ?? []) as Array<{ square_id: string }>;
    expect(rows.map((row) => row.square_id).sort()).toEqual(["pay_1", "ref_partial", "ref_yesterday"]);

    const nextRun = crypto.randomUUID();
    const replacedRun = await service.rpc("square_upsert_transactions", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: nextRun,
      p_transactions: [payment],
    });
    expect(replacedRun.data).toBe(true);
    const removed = await service.rpc("square_finalize_transactions", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: nextRun,
      p_reporting_date: "2026-11-06",
      p_reporting_timezone: "America/New_York",
      p_merchant_name: "Sandbox Seller",
    });
    expect(Number(removed.data)).toBe(2);
    const after = await owner.rpc("member_get_square_status", { p_company_id: disposableCompanyId });
    expect(after.data.currency_totals).toEqual([{ currency: "USD", payments_minor: 1000, refunds_minor: 0 }]);

    const failedCommit = await service.rpc("square_commit_import", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: crypto.randomUUID(),
      p_transactions: [{ ...payment, square_id: "pay_should_roll_back", amount_minor: "5000" }],
      p_reporting_date: null,
      p_reporting_timezone: "America/New_York",
      p_merchant_name: "Sandbox Seller",
    });
    expect(failedCommit.error).toBeTruthy();
    const surviving = await service
      .from("square_transactions")
      .select("square_id")
      .eq("company_id", disposableCompanyId);
    expect((surviving.data ?? []).map((row) => row.square_id)).not.toContain("pay_should_roll_back");
    const preserved = await owner.rpc("member_get_square_status", { p_company_id: disposableCompanyId });
    expect(preserved.data.currency_totals).toEqual([{ currency: "USD", payments_minor: 1000, refunds_minor: 0 }]);
    expect(preserved.data.last_successful_sync_at).toBe(after.data.last_successful_sync_at);

    const zero = await service.from("square_transactions").insert({
      company_id: disposableCompanyId,
      connection_id: connectionId,
      square_environment: "sandbox",
      merchant_id: "MERCHANT1",
      kind: "payment",
      square_id: "pay_zero",
      location_id: "LOC1",
      created_at: "2026-11-06T12:00:00Z",
      reporting_date: "2026-11-06",
      currency: "USD",
      amount_minor: 0,
      sync_run_id: nextRun,
    });
    expect(zero.error).toBeTruthy();

    const state = crypto.randomBytes(16).toString("hex");
    const insertedState = await service.from("square_oauth_states").insert({
      state_hash: hashOAuthState(state),
      user_id: ownerUserId,
      company_id: disposableCompanyId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(insertedState.error).toBeNull();
    const first = await service.rpc("square_consume_oauth_state", { p_state_hash: hashOAuthState(state) });
    expect(first.data?.[0]?.company_id ?? first.data?.company_id).toBe(disposableCompanyId);
    const second = await service.rpc("square_consume_oauth_state", { p_state_hash: hashOAuthState(state) });
    const replay = Array.isArray(second.data) ? second.data : second.data ? [second.data] : [];
    expect(replay).toHaveLength(0);
  }, 30_000);
});
