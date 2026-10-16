import crypto from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";
import { readCompanyIdBySlug } from "./milestone2-test-fixtures";
import { encryptToken } from "../google-calendar/token-crypto";
import { hashOAuthState } from "../google-calendar/oauth-state";

const USER_A = "member-a@acme.dev";
const USER_B = "member-b@beta.dev";

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
  if (!seed?.users[USER_A] || !seed?.users[USER_B]) {
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
  let acmeId: string;
  let betaId: string;
  let acmeConnId: string | null = null;

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
    acmeId = await readCompanyIdBySlug(service, "acme-hvac");
    betaId = await readCompanyIdBySlug(service, "beta-retail");
  });

  afterEach(async () => {
    if (acmeConnId) {
      await service.from("google_calendar_events").delete().eq("connection_id", acmeConnId);
      await service.from("google_calendar_selected_calendars").delete().eq("connection_id", acmeConnId);
      await service.from("google_calendar_connection_secrets").delete().eq("connection_id", acmeConnId);
      await service.from("google_calendar_connections").delete().eq("id", acmeConnId);
      acmeConnId = null;
    }
  });

  it("enforces one connection row per company and hides secrets from members", async () => {
    const { data: conn, error } = await service
      .from("google_calendar_connections")
      .insert({
        company_id: acmeId,
        google_sub: "sub-test",
        google_email: "owner@acme.test",
        status: "connected",
        connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    acmeConnId = conn!.id as string;

    const dup = await service.from("google_calendar_connections").insert({
      company_id: acmeId,
      google_sub: "sub-other",
      status: "connected",
    });
    expect(dup.error).toBeTruthy();

    await service.from("google_calendar_connection_secrets").insert({
      connection_id: acmeConnId,
      company_id: acmeId,
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
      p_company_id: acmeId,
    });
    expect(status?.google_email).toBe("owner@acme.test");
  });

  it("denies cross-tenant appointment reads", async () => {
    const { data: conn } = await service
      .from("google_calendar_connections")
      .insert({
        company_id: acmeId,
        google_sub: "sub-acme",
        google_email: "acme@test.local",
        status: "connected",
      })
      .select("id")
      .single();
    acmeConnId = conn!.id as string;

    await service.from("google_calendar_selected_calendars").insert({
      connection_id: acmeConnId,
      company_id: acmeId,
      google_calendar_id: "primary",
      summary: "Primary",
      selected: true,
    });

    await service.from("google_calendar_events").insert({
      company_id: acmeId,
      connection_id: acmeConnId,
      google_calendar_id: "primary",
      google_event_id: "evt-1",
      title: "Acme only",
      starts_at: new Date().toISOString(),
      all_day: false,
      status: "confirmed",
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const seed = loadDevSeedCredentials()!;
    const betaMember = await signIn(url, key, USER_B, seed.users[USER_B]!);

    const { error } = await betaMember.rpc("member_list_google_calendar_appointments", {
      p_company_id: acmeId,
    });
    expect(error?.message).toContain("FORBIDDEN");

    const { data: betaAppts } = await betaMember.rpc("member_list_google_calendar_appointments", {
      p_company_id: betaId,
    });
    expect(betaAppts ?? []).toHaveLength(0);
  });

  it("consumes oauth state only once", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!;
    const state = crypto.randomBytes(16).toString("base64url");
    const stateHash = hashOAuthState(state);
    const { data: userRow } = await service.auth.admin.listUsers();
    const userId = userRow.users.find((u) => u.email === USER_A)?.id;
    expect(userId).toBeTruthy();

    await service.from("google_calendar_oauth_states").insert({
      state_hash: stateHash,
      user_id: userId!,
      company_id: acmeId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });

    const first = await service
      .from("google_calendar_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state_hash", stateHash)
      .is("consumed_at", null)
      .select("id");
    expect(first.data).toHaveLength(1);

    const second = await service
      .from("google_calendar_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state_hash", stateHash)
      .is("consumed_at", null)
      .select("id");
    expect(second.data).toHaveLength(0);

    await service.from("google_calendar_oauth_states").delete().eq("state_hash", stateHash);
  });
});
