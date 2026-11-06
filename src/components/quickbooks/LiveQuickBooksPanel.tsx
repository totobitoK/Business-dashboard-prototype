"use client";

import { useState, useTransition } from "react";
import { disconnectQuickBooksAction, syncQuickBooksAction } from "@/lib/actions/quickbooks";
import type { QuickBooksStatusPayload } from "@/lib/quickbooks/receivables-presentation";

function flashMessage(code: string | null): string | null {
  switch (code) {
    case "connected":
      return "QuickBooks Online is connected and the latest invoice sync finished.";
    case "connected_sync_failed":
      return "QuickBooks Online is connected, but the invoice sync did not finish. You can try syncing again.";
    case "denied":
      return "QuickBooks authorization was cancelled.";
    case "invalid_callback":
      return "QuickBooks did not return a complete authorization. Start the connection again.";
    case "invalid_state":
      return "This QuickBooks authorization link is invalid or already used. Start the connection again.";
    case "forbidden":
      return "Only the company owner who started the connection can finish it.";
    case "invalid_realm":
      return "QuickBooks did not return a valid company id.";
    case "replace_required":
      return "This QuickBooks company is different from the one already connected. Use Replace to switch companies.";
    case "exchange_failed":
      return "QuickBooks authorization could not be completed.";
    case "not_configured":
      return "QuickBooks Online is not enabled in this environment.";
    default:
      return null;
  }
}

export function LiveQuickBooksPanel({
  companyId,
  isOwner,
  connectAllowed,
  status,
  flashCode,
}: {
  companyId: string;
  isOwner: boolean;
  connectAllowed: boolean;
  status: QuickBooksStatusPayload;
  flashCode?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const flash = flashMessage(flashCode ?? null);
  const connectHref = `/api/integrations/quickbooks/connect?companyId=${encodeURIComponent(companyId)}`;
  const replaceHref = `${connectHref}&replace=1`;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? success : (result.error ?? "Something went wrong."));
    });
  }

  return (
    <section className="rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">QuickBooks Online</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Connect one QuickBooks Online company. This reads open invoices only. Owners manage the
        connection; team members can see unpaid balances on the dashboard.
      </p>
      {flash ? (
        <p className="mt-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2 text-sm text-ink">
          {flash}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      {!connectAllowed ? (
        <p className="mt-4 text-sm text-ink-muted">
          QuickBooks Online Connect is not enabled in this environment yet.
        </p>
      ) : null}
      <div className="mt-4 space-y-2 text-sm text-ink">
        <p>
          Status: {status.connected ? status.status ?? "connected" : "not connected"}
          {status.company_name ? ` · ${status.company_name}` : ""}
          {status.intuit_environment ? ` · ${status.intuit_environment}` : ""}
        </p>
        <p className="text-ink-muted">
          {status.last_successful_sync_at
            ? `Last successful sync ${new Date(status.last_successful_sync_at).toLocaleString()}.`
            : "No successful sync yet."}
        </p>
      </div>
      {isOwner && connectAllowed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!status.connected ? (
            <a
              href={connectHref}
              className="inline-flex rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white"
            >
              Connect QuickBooks Online
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => syncQuickBooksAction(companyId), "Sync finished.")}
                className="rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Sync invoices
              </button>
              <a
                href={replaceHref}
                className="inline-flex rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-dark"
              >
                Replace company
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => disconnectQuickBooksAction(companyId), "QuickBooks disconnected.")
                }
                className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-dark disabled:opacity-60"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      ) : null}
      {!isOwner ? (
        <p className="mt-4 text-sm text-ink-muted">Only a company owner can connect or sync QuickBooks.</p>
      ) : null}
    </section>
  );
}
