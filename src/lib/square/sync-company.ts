import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EASTERN_TIME_ZONE } from "@/lib/company-time-zone";
import { isValidIanaTimeZone } from "@/lib/quickbooks/reporting-date";
import { shouldRefreshSquareToken } from "./access-token";
import {
  getSquareCredentials,
  getSquareEnvironment,
  SQUARE_IMPORT_LOOKBACK_DAYS,
  SYNC_LOCK_TTL_SECONDS,
} from "./config";
import { loadConnectionByCompany, loadSecrets, listSelectedLocationIds } from "./connection-store";
import { civilDateInTimeZone, collectCompletedTransactions } from "./import-transactions";
import { isSquareAuthError, refreshAccessToken, SquareApiError } from "./square-api";
import { readLocationActivity, readSellerProfile } from "./square-read";
import {
  acquireSyncLease,
  commitImport,
  markSyncError,
  markSyncing,
  persistTokens,
  releaseSyncLease,
  replaceLocations,
} from "./sync-rpc";
import { encryptToken } from "./token-crypto";

function errorCode(error: unknown): string {
  if (error instanceof SquareApiError) return error.code.replace(/[^A-Za-z0-9_]/g, "").slice(0, 80) || "SQUARE_READ_FAILED";
  if (error instanceof Error) return error.message.split(":")[0]?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 80) || "SYNC_FAILED";
  return "SYNC_FAILED";
}

export async function syncCompanySquare(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deployment = getSquareEnvironment();
  const credentials = getSquareCredentials();
  const connection = await loadConnectionByCompany(admin, companyId);
  if (!connection || connection.disconnectedAt || connection.status === "disconnected") {
    return { ok: false, error: "NOT_CONNECTED" };
  }
  if (!deployment || !credentials || connection.environment !== deployment) {
    return { ok: false, error: "ENVIRONMENT_MISMATCH" };
  }
  if (!connection.merchantId) return { ok: false, error: "MISSING_MERCHANT" };

  const selectedBefore = await listSelectedLocationIds(admin, connection.id);
  if (selectedBefore.length === 0) {
    return { ok: false, error: "Choose at least one Square location." };
  }

  const workerId = `square-${crypto.randomUUID()}`;
  const acquired = await acquireSyncLease(admin, companyId, workerId, SYNC_LOCK_TTL_SECONDS);
  if (!acquired) return { ok: false, error: "SYNC_BUSY" };

  const expectedGeneration = connection.syncGeneration;
  try {
    const marked = await markSyncing(admin, {
      connectionId: connection.id,
      companyId,
      expectedGeneration,
      workerId,
    });
    if (!marked) return { ok: false, error: "SYNC_ABORTED" };

    const secrets = await loadSecrets(admin, connection.id);
    if (!secrets?.refreshToken) {
      await markSyncError(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        workerId,
        errorCode: "RECONNECT_REQUIRED",
        reconnect: true,
      });
      return { ok: false, error: "RECONNECT_REQUIRED" };
    }

    let refreshToken = secrets.refreshToken;
    let accessToken = secrets.accessToken;
    const persist = async (tokens: { refreshToken: string; accessToken: string; expiresAt: string }) => {
      refreshToken = tokens.refreshToken;
      accessToken = tokens.accessToken;
      return persistTokens(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        refreshTokenEnc: encryptToken(tokens.refreshToken),
        accessTokenEnc: encryptToken(tokens.accessToken),
        accessTokenExpiresAt: tokens.expiresAt,
      });
    };

    if (
      shouldRefreshSquareToken({
        updatedAt: secrets.updatedAt,
        expiresAt: secrets.accessTokenExpiresAt,
        now: new Date(),
      }) ||
      !accessToken
    ) {
      const renewed = await refreshAccessToken({
        environment: connection.environment,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken,
      });
      const saved = await persist(renewed);
      if (!saved) return { ok: false, error: "SYNC_ABORTED" };
    }

    const read = async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await fn(accessToken!);
      } catch (error) {
        if (!isSquareAuthError(error)) throw error;
        const renewed = await refreshAccessToken({
          environment: connection.environment,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken,
        });
        const saved = await persist(renewed);
        if (!saved) throw new Error("SYNC_ABORTED");
        return fn(accessToken!);
      }
    };

    const profile = await read((token) =>
      readSellerProfile({
        environment: connection.environment,
        accessToken: token,
        merchantId: connection.merchantId!,
      })
    );
    const locationsSaved = await replaceLocations(admin, {
      connectionId: connection.id,
      companyId,
      locations: profile.locations,
    });
    if (!locationsSaved) return { ok: false, error: "SYNC_ABORTED" };

    const names = new Map(profile.locations.map((location) => [location.square_location_id, location.name]));
    const selected = await listSelectedLocationIds(admin, connection.id);
    if (selected.length === 0) {
      await markSyncError(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        workerId,
        errorCode: "NO_LOCATIONS_SELECTED",
        reconnect: false,
      });
      return { ok: false, error: "Choose at least one Square location." };
    }

    const { data: companyRow } = await admin.from("companies").select("timezone").eq("id", companyId).maybeSingle();
    const timeZone =
      typeof companyRow?.timezone === "string" && isValidIanaTimeZone(companyRow.timezone)
        ? companyRow.timezone
        : EASTERN_TIME_ZONE;
    const now = new Date();
    const begin = new Date(now.getTime() - SQUARE_IMPORT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const payments = [];
    const refunds = [];
    for (const locationId of selected) {
      const activity = await read((token) =>
        readLocationActivity({
          environment: connection.environment,
          accessToken: token,
          locationId,
          beginTime: begin.toISOString(),
          endTime: now.toISOString(),
        })
      );
      payments.push(...activity.payments);
      refunds.push(...activity.refunds);
    }

    const imported = collectCompletedTransactions({
      payments,
      refunds,
      timeZone,
      selectedLocationIds: selected,
    });
    const reportingDate = civilDateInTimeZone(now.toISOString(), timeZone);
    if (!reportingDate) {
      await markSyncError(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        workerId,
        errorCode: "REPORTING_DATE",
        reconnect: false,
      });
      return { ok: false, error: "REPORTING_DATE" };
    }
    const syncRunId = crypto.randomUUID();
    const removed = await commitImport(admin, {
      connectionId: connection.id,
      companyId,
      expectedGeneration,
      workerId,
      syncRunId,
      reportingDate,
      reportingTimezone: timeZone,
      merchantName: profile.merchantName,
      transactions: imported.map((row) => ({
        kind: row.kind,
        square_id: row.squareId,
        location_id: row.locationId,
        location_name: names.get(row.locationId) ?? "",
        created_at: row.createdAt,
        reporting_date: row.reportingDate,
        currency: row.currency,
        amount_minor: String(row.amountMinor),
        source_type: row.sourceType ?? "",
      })),
    });
    if (removed < 0) return { ok: false, error: "SYNC_ABORTED" };
    return { ok: true };
  } catch (error) {
    const code = errorCode(error);
    const reconnect = isSquareAuthError(error) || code === "RECONNECT_REQUIRED";
    await markSyncError(admin, {
      connectionId: connection.id,
      companyId,
      expectedGeneration,
      workerId,
      errorCode: code,
      reconnect,
    }).catch(() => undefined);
    return { ok: false, error: reconnect ? "RECONNECT_REQUIRED" : code };
  } finally {
    await releaseSyncLease(admin, companyId, workerId).catch(() => undefined);
  }
}
