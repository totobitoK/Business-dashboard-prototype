import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAccessToken } from "./access-token";
import { getQuickBooksEnvironment } from "./config";
import { loadConnectionByCompany, loadSecrets } from "./connection-store";
import {
  buildOpenInvoiceQuery,
  chunkInvoices,
  collectOpenInvoices,
} from "./invoice-import";
import { QuickBooksReadError, qboReadJson, readCompanyProfile } from "./qbo-read";
import { reportingDateInTimeZone, selectReportingTimeZone } from "./reporting-date";
import {
  acquireSyncLease,
  finalizeOpenInvoices,
  markSyncError,
  markSyncing,
  persistTokens,
  releaseSyncLease,
  upsertOpenInvoices,
} from "./sync-rpc";
import { encryptToken } from "./token-crypto";

function errorCode(error: unknown): string {
  if (error instanceof QuickBooksReadError) {
    if (error.status === 401 || error.code === "3200") return "RECONNECT_REQUIRED";
    return error.code.replace(/[^A-Za-z0-9_]/g, "").slice(0, 80) || "QUICKBOOKS_READ_FAILED";
  }
  if (error instanceof Error) {
    const code = error.message.split(":")[0] ?? "SYNC_FAILED";
    return code.replace(/[^A-Za-z0-9_]/g, "").slice(0, 80) || "SYNC_FAILED";
  }
  return "SYNC_FAILED";
}

export async function syncCompanyQuickBooks(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deployment = getQuickBooksEnvironment();
  const connection = await loadConnectionByCompany(admin, companyId);
  if (!connection || connection.disconnectedAt || connection.status === "disconnected") {
    return { ok: false, error: "NOT_CONNECTED" };
  }
  if (!deployment || connection.environment !== deployment) {
    return { ok: false, error: "ENVIRONMENT_MISMATCH" };
  }
  if (!connection.realmId) return { ok: false, error: "MISSING_REALM" };

  const workerId = `qbo-${crypto.randomUUID()}`;
  const acquired = await acquireSyncLease(admin, companyId, workerId);
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
    const persist = async (tokens: {
      refreshToken: string;
      accessToken: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string | null;
    }) => {
      refreshToken = tokens.refreshToken;
      return persistTokens(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        refreshTokenEnc: encryptToken(tokens.refreshToken),
        accessTokenEnc: encryptToken(tokens.accessToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      });
    };

    let accessToken = await resolveAccessToken({
      secrets: {
        accessToken: secrets.accessToken,
        accessTokenExpiresAt: secrets.accessTokenExpiresAt,
        refreshToken,
      },
      persist,
    });

    const read = async (resourcePath: string, query?: Record<string, string>) => {
      try {
        return await qboReadJson({
          environment: connection.environment,
          realmId: connection.realmId!,
          resourcePath,
          query,
          accessToken,
        });
      } catch (error) {
        if (!(error instanceof QuickBooksReadError) || error.status !== 401) throw error;
        accessToken = await resolveAccessToken({
          secrets: {
            accessToken: null,
            accessTokenExpiresAt: null,
            refreshToken,
          },
          forceRefresh: true,
          persist,
        });
        return qboReadJson({
          environment: connection.environment,
          realmId: connection.realmId!,
          resourcePath,
          query,
          accessToken,
        });
      }
    };

    const profile = readCompanyProfile(await read(`companyinfo/${connection.realmId}`));
    const { data: companyRow } = await admin
      .from("companies")
      .select("timezone")
      .eq("id", companyId)
      .maybeSingle();
    const timeZone = selectReportingTimeZone(
      typeof companyRow?.timezone === "string" ? companyRow.timezone : null
    );
    const source = "configured" as const;
    const reportingDate = reportingDateInTimeZone(timeZone, new Date());
    const invoices = await collectOpenInvoices({
      reportingDate,
      fetchPage: (startPosition) =>
        read("query", { query: buildOpenInvoiceQuery(startPosition) }),
    });

    const syncRunId = crypto.randomUUID();
    for (const batch of chunkInvoices(invoices, 200)) {
      const wrote = await upsertOpenInvoices(admin, {
        connectionId: connection.id,
        companyId,
        expectedGeneration,
        workerId,
        syncRunId,
        invoices: batch,
      });
      if (!wrote) throw new Error("SYNC_ABORTED");
    }

    const removed = await finalizeOpenInvoices(admin, {
      connectionId: connection.id,
      companyId,
      expectedGeneration,
      workerId,
      syncRunId,
      reportingDate,
      reportingTimezone: timeZone,
      reportingTimezoneSource: source,
      companyName: profile.name,
    });
    if (removed < 0) throw new Error("SYNC_ABORTED");
    return { ok: true };
  } catch (error) {
    const code = errorCode(error);
    await markSyncError(admin, {
      connectionId: connection.id,
      companyId,
      expectedGeneration,
      workerId,
      errorCode: code,
      reconnect: code === "RECONNECT_REQUIRED",
    }).catch(() => undefined);
    return { ok: false, error: code };
  } finally {
    await releaseSyncLease(admin, companyId, workerId).catch(() => undefined);
  }
}
