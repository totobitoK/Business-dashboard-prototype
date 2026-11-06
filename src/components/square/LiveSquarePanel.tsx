"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectSquareAction, syncSquareAction } from "@/lib/actions/square";
import type { SquareStatusPayload } from "@/lib/square/collections-presentation";

export type SquareLocationChoice = {
  square_location_id: string;
  name: string | null;
  status: string | null;
  currency: string | null;
  selected: boolean;
};

function flashMessage(code: string | null): string | null {
  switch (code) {
    case "connected":
      return null;
    case "choose_locations":
      return "Square is connected. Choose the locations to include, then click Sync collections.";
    case "connected_sync_failed":
      return "Square is connected, but the collections sync did not finish. You can try syncing again.";
    case "denied":
      return "Square authorization was cancelled.";
    case "invalid_callback":
      return "Square did not return a complete authorization. Start the connection again.";
    case "invalid_state":
      return "This Square authorization link is invalid or already used. Start the connection again.";
    case "forbidden":
      return "Only the company owner who started the connection can finish it.";
    case "invalid_merchant":
      return "Square did not return a valid seller id.";
    case "replace_required":
      return "This Square seller is different from the one already connected. Use Replace to switch sellers.";
    case "exchange_failed":
      return "Square authorization could not be completed.";
    case "not_configured":
      return "Square is not enabled in this environment.";
    default:
      return null;
  }
}

export function LiveSquarePanel({
  companyId,
  isOwner,
  connectAllowed,
  status,
  locations,
  flashCode,
}: {
  companyId: string;
  isOwner: boolean;
  connectAllowed: boolean;
  status: SquareStatusPayload;
  locations: SquareLocationChoice[];
  flashCode?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [selected, setSelected] = useState(
    () => new Set(locations.filter((location) => location.selected).map((location) => location.square_location_id))
  );
  const setupFinished = synced || Boolean(status.last_successful_sync_at);
  const flash =
    setupFinished && (flashCode === "choose_locations" || flashCode === "connected")
      ? null
      : flashMessage(flashCode ?? null);
  const connectHref = `/api/integrations/square/connect?companyId=${encodeURIComponent(companyId)}`;
  const replaceHref = `${connectHref}&replace=1`;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? success : (result.error ?? "Something went wrong."));
    });
  }

  return (
    <section className="min-w-0 rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">Square</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Connect one Square seller, then choose which locations to include. This reads completed
        payments and refunds only. It does not take payments or issue refunds.
      </p>
      {flash ? (
        <p className="mt-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2 text-sm text-ink">
          {flash}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      {!connectAllowed ? (
        <p className="mt-4 text-sm text-ink-muted">Square Connect is not enabled in this environment yet.</p>
      ) : null}
      <div className="mt-4 space-y-2 text-sm text-ink">
        <p>
          Status: {status.connected ? status.status ?? "connected" : "not connected"}
          {status.merchant_name ? ` · ${status.merchant_name}` : ""}
          {status.square_environment ? ` · ${status.square_environment}` : ""}
        </p>
        <p className="text-ink-muted">
          {status.last_successful_sync_at
            ? `Last successful sync ${new Date(status.last_successful_sync_at).toLocaleString()}.`
            : "No successful sync yet."}
        </p>
      </div>
      {status.connected && locations.length > 0 ? (
        <fieldset className="mt-4 min-w-0 space-y-2" disabled={!isOwner || pending}>
          <legend className="text-sm font-semibold text-ink">Locations to include</legend>
          {locations.map((location) => {
            const active = location.status === "ACTIVE";
            return (
              <label key={location.square_location_id} className="flex min-w-0 items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(location.square_location_id)}
                  disabled={!active}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(location.square_location_id);
                      else next.delete(location.square_location_id);
                      return next;
                    });
                  }}
                />
                <span className="min-w-0 break-words">
                  {location.name ?? location.square_location_id}
                  {location.currency ? ` · ${location.currency}` : ""}
                  {active ? "" : " · inactive"}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {isOwner && connectAllowed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!status.connected ? (
            <a
              href={connectHref}
              className="inline-flex rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white"
            >
              Connect Square
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const result = await syncSquareAction(companyId, [...selected]);
                    if (!result.ok) {
                      setMessage(result.error ?? "Something went wrong.");
                      return;
                    }
                    setSynced(true);
                    const url = new URL(window.location.href);
                    if (url.searchParams.has("square")) {
                      url.searchParams.delete("square");
                      router.replace(`${url.pathname}${url.search}`);
                    }
                  });
                }}
                className="rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Sync collections
              </button>
              <a
                href={replaceHref}
                className="inline-flex rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-dark"
              >
                Replace seller
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => disconnectSquareAction(companyId), "Square disconnected.")}
                className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-dark disabled:opacity-60"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      ) : null}
      {!isOwner ? (
        <p className="mt-4 text-sm text-ink-muted">Only a company owner can connect Square or choose locations.</p>
      ) : null}
    </section>
  );
}
