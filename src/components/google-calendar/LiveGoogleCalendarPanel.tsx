"use client";

import { useMemo, useState, useTransition } from "react";
import {
  disconnectGoogleCalendarAction,
  refreshGoogleCalendarListAction,
  saveGoogleCalendarSelectionAction,
} from "@/lib/actions/google-calendar";
import { connectorCanConnect } from "@/lib/connector-presentation";
import { CONNECTOR_DEFINITIONS } from "@/lib/connector-catalog";

export type GoogleCalendarStatus = {
  connected: boolean;
  status: string;
  google_email: string | null;
  last_sync_at: string | null;
  last_sync_error_code?: string | null;
  selected_calendar_count: number;
};

export type CalendarRow = {
  id: string;
  google_calendar_id: string;
  summary: string;
  selected: boolean;
};

export function LiveGoogleCalendarPanel({
  companyId,
  isOwner,
  integrationConfigured,
  status,
  calendars,
  flashCode,
}: {
  companyId: string;
  isOwner: boolean;
  integrationConfigured: boolean;
  status: GoogleCalendarStatus;
  calendars: CalendarRow[];
  flashCode?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    calendars.filter((c) => c.selected).map((c) => c.google_calendar_id)
  );

  const googleDef = CONNECTOR_DEFINITIONS.find((c) => c.id === "google-calendar");
  const canConnect =
    integrationConfigured && googleDef ? connectorCanConnect(googleDef) : false;

  const connectHref = useMemo(() => {
    const base = `/api/integrations/google-calendar/connect?companyId=${encodeURIComponent(companyId)}`;
    return base;
  }, [companyId]);

  const replaceHref = `${connectHref}&replace=1`;

  const flash = flashMessage(flashCode);

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      setMessage(res.ok ? "Saved." : (res.error ?? "Something went wrong."));
    });
  }

  return (
    <section className="rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Google Calendar</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Connect one Google account per company. Owners manage the connection; team members
            can view synced appointments on the dashboard.
          </p>
        </div>
        {status.connected && status.google_email ? (
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-dark ring-1 ring-inset ring-purple-100">
            {status.google_email}
          </span>
        ) : null}
      </div>

      {flash ? (
        <p className="mt-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2 text-sm text-ink">
          {flash}
        </p>
      ) : null}

      {!integrationConfigured ? (
        <p className="mt-4 text-sm text-ink-muted">
          Google Calendar Connect is not enabled in this environment yet.
        </p>
      ) : null}

      {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}

      <div className="mt-4 space-y-3 text-sm">
        {renderStatusLine(status)}

        {isOwner && canConnect ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {!status.connected || status.status === "disconnected" ? (
              <a
                href={connectHref}
                className="inline-flex rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white"
              >
                Connect Google Calendar
              </a>
            ) : (
              <>
                {status.status === "reconnect_required" ? (
                  <a
                    href={connectHref}
                    className="inline-flex rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white"
                  >
                    Reconnect Google Calendar
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => refreshGoogleCalendarListAction(companyId))}
                  className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-dark"
                >
                  Refresh calendar list
                </button>
                <a
                  href={replaceHref}
                  className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-900"
                >
                  Use a different Google account
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => disconnectGoogleCalendarAction(companyId))}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        ) : null}

        {!isOwner && status.connected ? (
          <p className="text-ink-muted">Only company owners can change this connection.</p>
        ) : null}

        {isOwner && status.connected && calendars.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="font-semibold text-ink">Calendars to sync</p>
            <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-purple-50 p-3">
              {calendars.map((cal) => (
                <li key={cal.id} className="flex items-center gap-2">
                  <input
                    id={`cal-${cal.id}`}
                    type="checkbox"
                    checked={selectedIds.includes(cal.google_calendar_id)}
                    onChange={() => toggleId(cal.google_calendar_id)}
                    disabled={pending}
                  />
                  <label htmlFor={`cal-${cal.id}`} className="flex-1 cursor-pointer">
                    {cal.summary}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => saveGoogleCalendarSelectionAction(companyId, selectedIds))
              }
              className="rounded-lg bg-purple px-3 py-2 text-xs font-semibold text-white"
            >
              Save selection & sync
            </button>
          </div>
        ) : null}

        {status.connected && status.selected_calendar_count === 0 ? (
          <p className="text-ink-muted">
            Select at least one calendar to import appointments. Sync runs automatically on a
            schedule after selection.
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Imported events are removed from your dashboard when you disconnect or deselect a calendar.
        OAuth tokens stay on RavenView servers (encrypted) and keep refreshing while Google
        authorization remains valid. Unverified Google Cloud apps may limit refresh tokens to
        seven days until production verification.
      </p>
    </section>
  );
}

function renderStatusLine(status: GoogleCalendarStatus) {
  if (!status.connected) {
    return <p className="text-ink-muted">Not connected.</p>;
  }
  if (status.status === "syncing") {
    return <p className="font-medium text-purple-dark">Syncing appointments…</p>;
  }
  if (status.status === "reconnect_required") {
    return (
      <p className="font-medium text-amber-900">
        Google authorization expired or was revoked. Reconnect to resume sync.
      </p>
    );
  }
  if (status.status === "error") {
    return (
      <p className="font-medium text-amber-900">
        Temporary sync issue{status.last_sync_error_code ? `: ${status.last_sync_error_code}` : ""}.
        RavenView will retry automatically.
      </p>
    );
  }
  if (status.last_sync_at) {
    return (
      <p className="text-ink-muted">
        Last sync {new Date(status.last_sync_at).toLocaleString()}
        {status.selected_calendar_count
          ? ` · ${status.selected_calendar_count} calendar(s)`
          : ""}
      </p>
    );
  }
  return <p className="text-ink-muted">Connected — waiting for first sync.</p>;
}

function flashMessage(code?: string | null): string | null {
  switch (code) {
    case "connected":
      return "Google Calendar connected. Choose calendars to sync below.";
    case "denied":
      return "Google sign-in was cancelled.";
    case "invalid_state":
      return "This connection link expired or was already used. Try Connect again.";
    case "replace_required":
      return "That Google account does not match your current connection. Use “Use a different Google account” to replace it.";
    case "exchange_failed":
      return "Could not complete Google authorization. Try again or contact RavenView support.";
    case "forbidden":
      return "You must be signed in as a company owner to finish connecting.";
    default:
      return null;
  }
}
