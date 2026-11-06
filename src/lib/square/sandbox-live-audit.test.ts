import crypto from "crypto";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { loadDevSeedCredentials } from "../supabase/load-dev-seed-credentials";
import { loadConnectionByCompany, loadSecrets } from "./connection-store";
import { SQUARE_VERSION, squareHost } from "./config";
import { refreshAccessToken, squareGet } from "./square-api";
import { syncCompanySquare } from "./sync-company";
import { createServiceClient } from "../supabase/service";
import { encryptToken } from "./token-crypto";
import { persistTokens } from "./sync-rpc";

const COMPANY_ID = "1c07201c-ac74-4914-a3f3-3555dafb1a3c";
const runLive = process.env.RUN_SQUARE_LIVE_AUDIT === "1";

type Row = {
  id?: string;
  status?: string;
  created_at?: string;
  location_id?: string;
  amount_money?: { amount?: number; currency?: string };
  source_type?: string;
  destination_type?: string;
  payment_id?: string;
};

async function pages(token: string, path: string, itemKey: string, query: Record<string, string>) {
  const items: Row[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  do {
    pageCount += 1;
    const body = (await squareGet({
      environment: "sandbox",
      accessToken: token,
      path,
      query: { ...query, cursor, limit: "100" },
    })) as Record<string, unknown>;
    items.push(...((body[itemKey] as Row[] | undefined) ?? []));
    const next = typeof body.cursor === "string" ? body.cursor : "";
    if (!next || next === cursor) break;
    cursor = next;
  } while (pageCount < 50);
  return { items, pageCount };
}

describe.skipIf(!runLive)("Square sandbox live reconciliation", () => {
  const report: Record<string, unknown> = {};
  let restore: (() => Promise<void>) | null = null;

  afterAll(async () => {
    if (restore) await restore();
    fs.writeFileSync("/tmp/square-live-audit-result.json", JSON.stringify(report, null, 2));
  });

  it("reconciles the connected seller, refreshes the token, and preserves totals after a failed commit", async () => {
    const admin = createServiceClient();
    const connection = await loadConnectionByCompany(admin, COMPANY_ID);
    expect(connection?.merchantId).toBeTruthy();
    const beforeSecrets = await loadSecrets(admin, connection!.id);
    expect(beforeSecrets?.accessToken && beforeSecrets.refreshToken).toBeTruthy();

    const wide = {
      begin_time: "2020-01-01T00:00:00Z",
      end_time: new Date().toISOString(),
      sort_order: "ASC",
    };
    const locationBody = (await squareGet({
      environment: "sandbox",
      accessToken: beforeSecrets!.accessToken!,
      path: "/v2/locations",
    })) as { locations?: Array<{ id?: string; name?: string; status?: string; currency?: string }> };
    const merchantBody = (await squareGet({
      environment: "sandbox",
      accessToken: beforeSecrets!.accessToken!,
      path: `/v2/merchants/${connection!.merchantId}`,
    })) as {
      merchant?: { id?: string; business_name?: string; status?: string; currency?: string };
    };
    const locations = locationBody.locations ?? [];
    const activity = [];
    for (const location of locations) {
      if (!location.id) continue;
      const payments = await pages(beforeSecrets!.accessToken!, "/v2/payments", "payments", {
        ...wide,
        location_id: location.id,
      });
      const refunds = await pages(beforeSecrets!.accessToken!, "/v2/refunds", "refunds", {
        ...wide,
        location_id: location.id,
      });
      activity.push({
        id: location.id,
        name: location.name,
        status: location.status,
        currency: location.currency,
        paymentPages: payments.pageCount,
        payments: payments.items.map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          location_id: row.location_id,
          amount: row.amount_money?.amount,
          currency: row.amount_money?.currency,
          source: row.source_type,
        })),
        refundPages: refunds.pageCount,
        refunds: refunds.items.map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          location_id: row.location_id,
          amount: row.amount_money?.amount,
          currency: row.amount_money?.currency,
          payment_id: row.payment_id,
          destination: row.destination_type,
        })),
      });
    }

    const renewed = await refreshAccessToken({
      environment: "sandbox",
      clientId: process.env.SQUARE_SANDBOX_CLIENT_ID!,
      clientSecret: process.env.SQUARE_SANDBOX_CLIENT_SECRET!,
      refreshToken: beforeSecrets!.refreshToken,
    });
    expect(renewed.merchantId).toBe(connection!.merchantId);
    expect(renewed.accessToken).not.toBe(beforeSecrets!.accessToken);
    const persisted = await persistTokens(admin, {
      connectionId: connection!.id,
      companyId: COMPANY_ID,
      expectedGeneration: connection!.syncGeneration,
      refreshTokenEnc: encryptToken(renewed.refreshToken),
      accessTokenEnc: encryptToken(renewed.accessToken),
      accessTokenExpiresAt: renewed.expiresAt,
    });
    expect(persisted).toBe(true);
    const afterRefresh = await squareGet({
      environment: "sandbox",
      accessToken: renewed.accessToken,
      path: "/v2/locations",
    });
    expect(JSON.stringify(afterRefresh)).toContain(locations[0]?.id ?? "");

    const first = await syncCompanySquare(admin, COMPANY_ID);
    expect(first).toEqual({ ok: true });
    const mid = await admin
      .from("square_connections")
      .select("last_successful_sync_at, status, merchant_id, merchant_name")
      .eq("id", connection!.id)
      .single();
    const second = await syncCompanySquare(admin, COMPANY_ID);
    expect(second).toEqual({ ok: true });
    const end = await admin
      .from("square_connections")
      .select("last_successful_sync_at, status, merchant_id, merchant_name, reporting_date, reporting_timezone, last_sync_error_code")
      .eq("id", connection!.id)
      .single();
    const stored = await admin
      .from("square_transactions")
      .select("kind, square_id, location_id, created_at, reporting_date, currency, amount_minor")
      .eq("company_id", COMPANY_ID);
    const ids = (stored.data ?? []).map((row) => `${row.kind}:${row.square_id}`);
    expect(new Set(ids).size).toBe(ids.length);

    const stamp = end.data?.last_successful_sync_at as string;
    const workerId = `audit-${crypto.randomUUID()}`;
    const lease = await admin.rpc("square_acquire_sync_lease", {
      p_company_id: COMPANY_ID,
      p_worker_id: workerId,
      p_ttl_seconds: 60,
    });
    expect(lease.data).toBe(true);
    restore = async () => {
      await admin
        .from("square_connections")
        .update({
          status: "connected",
          last_sync_error_code: null,
          syncing_started_at: null,
          last_successful_sync_at: stamp,
        })
        .eq("id", connection!.id);
      await admin.from("square_transactions").delete().eq("company_id", COMPANY_ID).eq("square_id", "pay_should_roll_back");
      await admin.rpc("square_release_sync_lease", { p_company_id: COMPANY_ID, p_worker_id: workerId });
    };
    await admin.rpc("square_mark_syncing", {
      p_connection_id: connection!.id,
      p_company_id: COMPANY_ID,
      p_expected_generation: connection!.syncGeneration,
      p_worker_id: workerId,
    });
    const failed = await admin.rpc("square_commit_import", {
      p_connection_id: connection!.id,
      p_company_id: COMPANY_ID,
      p_expected_generation: connection!.syncGeneration,
      p_worker_id: workerId,
      p_sync_run_id: crypto.randomUUID(),
      p_transactions: [
        {
          kind: "payment",
          square_id: "pay_should_roll_back",
          location_id: locations[0]?.id,
          created_at: "2026-11-06T15:00:00Z",
          reporting_date: "2026-11-06",
          currency: "USD",
          amount_minor: "2500",
        },
      ],
      p_reporting_date: null,
      p_reporting_timezone: "",
      p_merchant_name: "test account",
    });
    expect(failed.error).toBeTruthy();
    const leaked = await admin
      .from("square_transactions")
      .select("square_id")
      .eq("company_id", COMPANY_ID)
      .eq("square_id", "pay_should_roll_back");
    expect(leaked.data ?? []).toHaveLength(0);
    const preserved = await admin
      .from("square_connections")
      .select("last_successful_sync_at")
      .eq("id", connection!.id)
      .single();
    expect(preserved.data?.last_successful_sync_at).toBe(stamp);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const seed = loadDevSeedCredentials();
    const other = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await other.auth.signInWithPassword({
      email: "member-b@beta.dev",
      password: seed!.users["member-b@beta.dev"]!,
    });
    expect(signed.error).toBeNull();
    const otherRows = await other.from("square_transactions").select("id").eq("company_id", COMPANY_ID);
    const otherStatus = await other.rpc("member_get_square_status", { p_company_id: COMPANY_ID });
    const otherSecrets = await other.from("square_connection_secrets").select("connection_id");

    report.merchant = {
      id: merchantBody.merchant?.id ?? null,
      name: merchantBody.merchant?.business_name ?? null,
      status: merchantBody.merchant?.status ?? null,
      currency: merchantBody.merchant?.currency ?? null,
    };
    report.locations = locations.map((location) => ({
      id: location.id,
      name: location.name,
      status: location.status,
      currency: location.currency,
    }));
    report.activity = activity;
    report.squareVersion = SQUARE_VERSION;
    report.squareHost = squareHost("sandbox");
    report.sync = {
      firstOk: first.ok,
      secondOk: second.ok,
      midSync: mid.data?.last_successful_sync_at,
      endSync: end.data?.last_successful_sync_at,
      status: end.data?.status,
      reportingDate: end.data?.reporting_date,
      reportingTimezone: end.data?.reporting_timezone,
      storedCount: stored.data?.length ?? 0,
      duplicateIds: ids.length - new Set(ids).size,
    };
    report.refresh = {
      merchantUnchanged: renewed.merchantId === connection!.merchantId,
      accessTokenChanged: renewed.accessToken !== beforeSecrets!.accessToken,
      persisted,
      expiresAt: renewed.expiresAt,
    };
    report.failedCommit = {
      errored: Boolean(failed.error),
      leakedRows: leaked.data?.length ?? 0,
      timestampUnchanged: preserved.data?.last_successful_sync_at === stamp,
    };
    report.otherTenant = {
      rowCount: otherRows.data?.length ?? 0,
      statusError: otherStatus.error?.message ?? null,
      secretsError: otherSecrets.error?.message ?? null,
    };
    expect(otherRows.data ?? []).toHaveLength(0);
    expect(otherStatus.error?.message ?? "").toMatch(/FORBIDDEN/);
    expect(otherSecrets.error?.message ?? "").toMatch(/permission|denied/i);
    expect(new Date(end.data!.last_successful_sync_at as string).getTime()).toBeGreaterThan(
      new Date(mid.data!.last_successful_sync_at as string).getTime()
    );
  }, 120_000);
});
