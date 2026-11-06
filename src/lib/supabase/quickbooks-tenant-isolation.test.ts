import crypto from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashOAuthState } from "../quickbooks/oauth-state";
import {
  createDisposableM4aCompany,
  deleteDisposableM4aCompany,
} from "./milestone4a-test-fixtures";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_QUICKBOOKS_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_QUICKBOOKS_TESTS=1" };
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

describe("QuickBooks tenant isolation and invoice rules", () => {
  const check = prereq();
  let service: SupabaseClient;
  let ownerUserId: string;
  let disposableCompanyId: string | null = null;

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_QUICKBOOKS_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`QuickBooks DB tests require ${check.reason}.`);
      });
    } else {
      it.skip(`skipped — ${check.reason}`, () => {});
    }
    return;
  }

  beforeAll(async () => {
    process.env.QUICKBOOKS_OAUTH_STATE_SECRET = "quickbooks-state-secret-32-characters";
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
  });

  it("hides another company's invoices and secrets, and keeps partial, voided, and overdue rules", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    const { data: connection, error: connectionError } = await service
      .from("quickbooks_connections")
      .insert({
        company_id: disposableCompanyId,
        intuit_environment: "sandbox",
        realm_id: "1234567890",
        company_name: "Sandbox Co",
        status: "connected",
        reporting_timezone: "America/Chicago",
        reporting_timezone_source: "configured",
      })
      .select("id, sync_generation")
      .single();
    expect(connectionError).toBeNull();
    const connectionId = connection!.id as string;
    const generation = Number(connection!.sync_generation);

    const duplicate = await service.from("quickbooks_connections").insert({
      company_id: disposableCompanyId,
      intuit_environment: "sandbox",
      status: "connected",
    });
    expect(duplicate.error).toBeTruthy();

    await service.from("quickbooks_connection_secrets").insert({
      connection_id: connectionId,
      company_id: disposableCompanyId,
      refresh_token_enc: "enc-refresh",
      access_token_enc: "enc-access",
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const seed = loadDevSeedCredentials()!;
    const owner = await signIn(url, key, USER_A, seed.users[USER_A]!);
    const other = await signIn(url, key, USER_B, seed.users[USER_B]!);

    const secrets = await owner.from("quickbooks_connection_secrets").select("*");
    expect(secrets.error?.message ?? "no access").toMatch(/permission|denied|schema/i);

    const otherList = await other.rpc("member_list_quickbooks_invoices", {
      p_company_id: disposableCompanyId,
    });
    expect(otherList.error?.message ?? "").toMatch(/FORBIDDEN/);

    const otherRows = await other
      .from("quickbooks_invoices")
      .select("id")
      .eq("company_id", disposableCompanyId);
    expect(otherRows.data ?? []).toHaveLength(0);

    const workerId = "worker-qbo";
    const lease = await service.rpc("quickbooks_acquire_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: workerId,
      p_ttl_seconds: 300,
    });
    expect(lease.data).toBe(true);

    const wrongCompany = await service.rpc("quickbooks_upsert_open_invoices", {
      p_connection_id: connectionId,
      p_company_id: crypto.randomUUID(),
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: crypto.randomUUID(),
      p_invoices: [{ qbo_invoice_id: "9", remaining_balance: "10.00", voided: "false" }],
    });
    expect(wrongCompany.data).toBe(false);

    const syncRunId = crypto.randomUUID();
    const reportingDate = "2026-11-01";
    const wrote = await service.rpc("quickbooks_upsert_open_invoices", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_invoices: [
        {
          qbo_invoice_id: "1",
          doc_number: "1001",
          customer_name: "Ada",
          txn_date: "2026-10-01",
          due_date: "2026-11-03",
          total_amount: "100.00",
          remaining_balance: "40.00",
          voided: "false",
        },
        {
          qbo_invoice_id: "2",
          due_date: "2026-10-31",
          total_amount: "15.00",
          remaining_balance: "15.00",
          voided: "false",
        },
        {
          qbo_invoice_id: "3",
          total_amount: "5.00",
          remaining_balance: "5.00",
          voided: "false",
        },
        {
          qbo_invoice_id: "4",
          due_date: "2026-10-01",
          remaining_balance: "80.00",
          voided: "true",
        },
      ],
    });
    expect(wrote.error).toBeNull();
    expect(wrote.data).toBe(true);

    const finalized = await service.rpc("quickbooks_finalize_open_invoices", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: syncRunId,
      p_reporting_date: reportingDate,
      p_reporting_timezone: "America/Chicago",
      p_reporting_timezone_source: "configured",
      p_company_name: "Sandbox Co",
    });
    expect(finalized.data).toBe(0);

    const status = await owner.rpc("member_get_quickbooks_status", {
      p_company_id: disposableCompanyId,
    });
    expect(Number(status.data.open_balance)).toBe(60);
    expect(Number(status.data.overdue_balance)).toBe(15);

    const list = await owner.rpc("member_list_quickbooks_invoices", {
      p_company_id: disposableCompanyId,
    });
    const rows = (list.data ?? []) as Array<{
      doc_number: string | null;
      due_date: string | null;
      remaining_balance: string | number;
      overdue: boolean;
    }>;
    const partial = rows.find((row) => row.doc_number === "1001");
    expect(Number(partial?.remaining_balance)).toBe(40);
    expect(partial?.overdue).toBe(false);
    const missingDue = rows.find((row) => Number(row.remaining_balance) === 5);
    expect(missingDue?.due_date).toBeNull();
    expect(missingDue?.overdue).toBe(false);
    const pastDue = rows.find((row) => Number(row.remaining_balance) === 15);
    expect(pastDue?.overdue).toBe(true);

    const nextRun = crypto.randomUUID();
    const replaced = await service.rpc("quickbooks_upsert_open_invoices", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: nextRun,
      p_invoices: [
        {
          qbo_invoice_id: "1",
          doc_number: "1001",
          due_date: "2026-11-03",
          total_amount: "100.00",
          remaining_balance: "40.00",
          voided: "false",
        },
      ],
    });
    expect(replaced.data).toBe(true);
    const removed = await service.rpc("quickbooks_finalize_open_invoices", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_worker_id: workerId,
      p_sync_run_id: nextRun,
      p_reporting_date: reportingDate,
      p_reporting_timezone: "America/Chicago",
      p_reporting_timezone_source: "configured",
      p_company_name: "Sandbox Co",
    });
    expect(Number(removed.data)).toBe(2);
    const after = await owner.rpc("member_get_quickbooks_status", { p_company_id: disposableCompanyId });
    expect(Number(after.data.open_balance)).toBe(40);
    expect(Number(after.data.overdue_balance)).toBe(0);

    const zero = await service.from("quickbooks_invoices").insert({
      company_id: disposableCompanyId,
      connection_id: connectionId,
      intuit_environment: "sandbox",
      realm_id: "1234567890",
      qbo_invoice_id: "paid",
      remaining_balance: 0,
      sync_run_id: nextRun,
    });
    expect(zero.error).toBeTruthy();

    const state = crypto.randomBytes(16).toString("hex");
    const insertedState = await service.from("quickbooks_oauth_states").insert({
      state_hash: hashOAuthState(state),
      user_id: ownerUserId,
      company_id: disposableCompanyId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(insertedState.error).toBeNull();
    const first = await service.rpc("quickbooks_consume_oauth_state", {
      p_state_hash: hashOAuthState(state),
    });
    expect(first.data?.[0]?.company_id ?? first.data?.company_id).toBe(disposableCompanyId);
    const second = await service.rpc("quickbooks_consume_oauth_state", {
      p_state_hash: hashOAuthState(state),
    });
    const replay = Array.isArray(second.data) ? second.data : second.data ? [second.data] : [];
    expect(replay).toHaveLength(0);
  });
});
