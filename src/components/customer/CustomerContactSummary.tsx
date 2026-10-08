"use client";

import { useEffect, useState } from "react";
import { PortalAccordion, PortalAccordionEditLock } from "@/components/customer/PortalAccordion";
import { useClientStore } from "@/lib/client-store";
import type { Client } from "@/lib/types";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function CustomerContactSummary({
  client,
  forceAccordionOpen,
  embedded = false,
}: {
  client: Client;
  forceAccordionOpen?: boolean;
  embedded?: boolean;
}) {
  const { updateClient } = useClientStore();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: client.company,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website ?? "",
  });

  useEffect(() => {
    if (!editing) {
      setForm({
        company: client.company,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        website: client.website ?? "",
      });
    }
  }, [client, editing]);

  function cancel() {
    setEditing(false);
    setError(null);
    setSaved(false);
    setForm({
      company: client.company,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      website: client.website ?? "",
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    if (!form.company.trim() || !form.contactName.trim()) {
      setError("Company and contact name are required.");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    updateClient(client.id, {
      company: form.company.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      website: form.website.trim() || undefined,
    });
    setEditing(false);
    setSaved(true);
  }

  const summary = `${client.contactName} · ${client.email}`;

  const body = (
    <PortalAccordionEditLock active={editing}>
        {!editing ? (
          <>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-muted">Company</dt>
                <dd className="text-ink">{client.company}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-muted">Contact</dt>
                <dd className="text-ink">{client.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-muted">Email</dt>
                <dd className="text-ink">{client.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-muted">Phone</dt>
                <dd className="text-ink">{client.phone}</dd>
              </div>
              {client.website && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-ink-muted">Website</dt>
                  <dd className="text-ink">{client.website}</dd>
                </div>
              )}
            </dl>
            {saved && (
              <p className="mt-3 text-sm text-emerald-800" role="status">
                Contact details saved.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
              className="mt-4 rounded-lg border border-purple px-3 py-1.5 text-sm font-semibold text-ink hover:bg-purple-50"
            >
              Edit details
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-ink">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Contact name</span>
              <input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Website (optional)</span>
              <input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm"
              />
            </label>
            {error && (
              <p className="text-sm text-amber-800" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-dark"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg border border-purple-100 px-4 py-2 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
    </PortalAccordionEditLock>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Company & contact</h3>
        {body}
      </div>
    );
  }

  return (
    <PortalAccordion
      id="portal-contact"
      title="Company & contact"
      summary={summary}
      forceOpen={forceAccordionOpen || editing}
    >
      {body}
    </PortalAccordion>
  );
}
