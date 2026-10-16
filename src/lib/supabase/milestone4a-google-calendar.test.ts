import crypto from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import { encryptToken } from "../google-calendar/token-crypto";
import { hashOAuthState } from "../google-calendar/oauth-state";
import {
  createDisposableM4aCompany,
  deleteDisposableM4aCompany,
} from "./milestone4a-test-fixtures";

const USER_A = "member-a@acme.dev";

function prereq(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_MILESTONE4A_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_MILESTONE4A_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "Supabase URL and publishable key" };
  }
  if (!process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, reason: "SUPABASE_SECRET_KEY" };
  }
  if (!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    return { ok: false, reason: "GOOGLE_TOKEN_ENCRYPTION_KEY" };
  }
  const seed = loadDevSeedCredentials();
  if (!seed?.users[USER_A]) {
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

describe("Milestone 4A Google Calendar tenancy", () => {
  const check = prereq();
  let service: SupabaseClient;
  let ownerUserId: string;
  let disposableCompanyId: string | null = null;

  if (!check.ok) {
    if (process.env.RUN_SUPABASE_MILESTONE4A_TESTS === "1") {
      it(`missing prerequisites (${check.reason})`, () => {
        throw new Error(`Milestone 4A DB tests require ${check.reason}.`);
      });
    } else {
      it.skip(`skipped — ${check.reason}`, () => {});
    }
    return;
  }

  beforeAll(async () => {
    service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: users } = await service.auth.admin.listUsers();
    ownerUserId = users.users.find((u) => u.email === USER_A)?.id ?? "";
    expect(ownerUserId).toBeTruthy();
  });

  afterEach(async () => {
    if (disposableCompanyId) {
      await deleteDisposableM4aCompany(service, disposableCompanyId);
      disposableCompanyId = null;
    }
  });

  it("enforces one connection row per company and hides secrets from members", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    const { data: conn, error } = await service
      .from("google_calendar_connections")
      .insert({
        company_id: disposableCompanyId,
        google_sub: "sub-test",
        google_email: "owner@m4a.test",
        status: "connected",
        connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    const dup = await service.from("google_calendar_connections").insert({
      company_id: disposableCompanyId,
      google_sub: "sub-other",
      status: "connected",
    });
    expect(dup.error).toBeTruthy();

    await service.from("google_calendar_connection_secrets").insert({
      connection_id: conn!.id,
      company_id: disposableCompanyId,
      refresh_token_enc: encryptToken("refresh-test"),
      access_token_enc: encryptToken("access-test"),
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const seed = loadDevSeedCredentials()!;
    const member = await signIn(url, key, USER_A, seed.users[USER_A]!);

    const secrets = await member.from("google_calendar_connection_secrets").select("*");
    expect(secrets.error?.message ?? "no access").toMatch(/permission|denied|schema/i);

    const { data: status } = await member.rpc("member_get_google_calendar_status", {
      p_company_id: disposableCompanyId,
    });
    expect(status?.google_email).toBe("owner@m4a.test");
  });

  it("acquires and releases sync lease atomically by worker id", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    const w1 = "worker-a";
    const w2 = "worker-b";
    const a1 = await service.rpc("google_calendar_acquire_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: w1,
      p_ttl_seconds: 300,
    });
    expect(a1.data).toBe(true);

    const a2 = await service.rpc("google_calendar_acquire_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: w2,
      p_ttl_seconds: 300,
    });
    expect(a2.data).toBe(false);

    await service.rpc("google_calendar_release_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: w2,
    });
    const stillHeld = await service.rpc("google_calendar_acquire_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: w2,
      p_ttl_seconds: 300,
    });
    expect(stillHeld.data).toBe(false);

    await service.rpc("google_calendar_release_sync_lease", {
      p_company_id: disposableCompanyId,
      p_worker_id: w1,
    });
  });

  it("consumes oauth state only once via RPC", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    process.env.GOOGLE_OAUTH_STATE_SECRET = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!;
    const state = crypto.randomBytes(16).toString("base64url");
    const stateHash = hashOAuthState(state);

    await service.from("google_calendar_oauth_states").insert({
      state_hash: stateHash,
      user_id: ownerUserId,
      company_id: disposableCompanyId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });

    const first = await service.rpc("google_calendar_consume_oauth_state", {
      p_state_hash: stateHash,
    });
    expect((first.data as unknown[] | null)?.length ?? 0).toBe(1);

    const second = await service.rpc("google_calendar_consume_oauth_state", {
      p_state_hash: stateHash,
    });
    expect((second.data as unknown[] | null)?.length ?? 0).toBe(0);
  });

  it("rejects stale sync writes after disconnect bumps generation", async () => {
    const disposable = await createDisposableM4aCompany(service, ownerUserId);
    disposableCompanyId = disposable.companyId;

    const { data: conn, error } = await service
      .from("google_calendar_connections")
      .insert({
        company_id: disposableCompanyId,
        google_sub: "sub-race",
        google_email: "race@test.local",
        status: "connected",
        sync_generation: 0,
      })
      .select("id, sync_generation")
      .single();
    expect(error).toBeNull();

    const connectionId = conn!.id as string;
    const generation = Number(conn!.sync_generation);

    await service.from("google_calendar_selected_calendars").insert({
      connection_id: connectionId,
      company_id: disposableCompanyId,
      google_calendar_id: "primary",
      summary: "Primary",
      selected: true,
    });

    const appliedBefore = await service.rpc("google_calendar_sync_apply_event", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_google_calendar_id: "primary",
      p_google_event_id: "evt-live",
      p_title: "Live",
      p_starts_at: new Date().toISOString(),
      p_ends_at: null,
      p_all_day: false,
      p_all_day_start: null,
      p_all_day_end: null,
      p_timezone: null,
      p_status: "confirmed",
      p_google_updated_at: new Date().toISOString(),
      p_is_cancelled: false,
    });
    expect(appliedBefore.data).toBe(true);

    await service.rpc("google_calendar_disconnect_company", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
    });

    const staleWrite = await service.rpc("google_calendar_sync_apply_event", {
      p_connection_id: connectionId,
      p_company_id: disposableCompanyId,
      p_expected_generation: generation,
      p_google_calendar_id: "primary",
      p_google_event_id: "evt-stale",
      p_title: "Stale",
      p_starts_at: new Date().toISOString(),
      p_ends_at: null,
      p_all_day: false,
      p_all_day_start: null,
      p_all_day_end: null,
      p_timezone: null,
      p_status: "confirmed",
      p_google_updated_at: new Date().toISOString(),
      p_is_cancelled: false,
    });
    expect(staleWrite.data).toBe(false);

    const { data: events } = await service
      .from("google_calendar_events")
      .select("google_event_id")
      .eq("company_id", disposableCompanyId);
    expect(events ?? []).toHaveLength(0);
  });
});
