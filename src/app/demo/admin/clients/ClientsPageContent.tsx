"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddClientModal } from "@/components/AddClientModal";
import { PageHeader } from "@/components/PageHeader";
import { ManageDrawer } from "@/components/ManageDrawer";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useClientStore } from "@/lib/client-store";
import {
  CUSTOMER_PORTAL_STAGE_LABELS,
  getCustomerPortalStage,
} from "@/lib/customer-portal-stage";
import { getWorkspaceForClientId } from "@/lib/customer-workspaces";
import { getNextStepLabel, getOnboardingProgress } from "@/lib/onboarding";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import type { Client, ClientFilter } from "@/lib/types";

const filters: { value: ClientFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

function filterFromParams(params: URLSearchParams): ClientFilter {
  const value = params.get("filter");
  if (value && filters.some((f) => f.value === value)) {
    return value as ClientFilter;
  }
  return "all";
}

export function ClientsPageContent() {
  const { clients } = useClientStore();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const filter = filterFromParams(searchParams);

  const [search, setSearch] = useState("");
  const [manageClientId, setManageClientId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const setFilter = useCallback(
    (value: ClientFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("filter");
      } else {
        params.set("filter", value);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.company.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q)
      );
    });
  }, [clients, search, filter]);

  const handleManage = useCallback((id: string) => {
    setManageClientId(id);
  }, []);

  const handleCloseManage = useCallback(() => {
    setManageClientId(null);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={
            filter === "all"
              ? "Clients"
              : `${filters.find((f) => f.value === filter)?.label ?? ""} clients`
          }
          description={`${filteredClients.length} of ${clients.length} clients`}
        />
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
        >
          Add client
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by company or contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-baby-200 bg-white py-2.5 pl-10 pr-4 text-sm text-navy placeholder:text-navy-muted/50 focus:border-baby-400 focus:outline-none focus:ring-1 focus:ring-baby-400"
          />
        </div>
        <div
          className="flex rounded-lg border border-baby-200 bg-baby-50/50 p-1"
          role="tablist"
          aria-label="Filter clients by status"
        >
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === value
                  ? "bg-white text-navy shadow-soft"
                  : "text-navy-muted hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-baby-200 bg-white shadow-soft md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-baby-100 bg-baby-50/50">
              <th className="px-5 py-3 font-medium text-navy-muted">Company</th>
              <th className="px-5 py-3 font-medium text-navy-muted">Contact</th>
              <th className="px-5 py-3 font-medium text-navy-muted">Status</th>
              <th className="px-5 py-3 font-medium text-navy-muted">Setup</th>
              <th className="px-5 py-3 font-medium text-navy-muted">Monthly</th>
              <th className="px-5 py-3 font-medium text-navy-muted">
                Onboarding
              </th>
              <th className="px-5 py-3 font-medium text-navy-muted">Portal</th>
              <th className="px-5 py-3 font-medium text-navy-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-baby-100">
            {filteredClients.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-navy-muted"
                >
                  No clients match this filter.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onManage={handleManage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredClients.length === 0 ? (
          <p className="py-8 text-center text-sm text-navy-muted">
            No clients match this filter.
          </p>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onManage={handleManage}
            />
          ))
        )}
      </div>

      <ManageDrawer clientId={manageClientId} onClose={handleCloseManage} />

      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={(id) => setManageClientId(id)}
      />
    </div>
  );
}

function ClientRow({
  client,
  onManage,
}: {
  client: Client;
  onManage: (id: string) => void;
}) {
  const progress = getOnboardingProgress(client);
  const nextLabel = getNextStepLabel(client);

  return (
    <tr className="group hover:bg-baby-50/30">
      <td className="px-5 py-3.5 font-medium text-navy">{client.company}</td>
      <td className="px-5 py-3.5 text-navy-muted">{client.contactName}</td>
      <td className="px-5 py-3.5">
        <StatusBadge status={client.status} />
      </td>
      <td className="px-5 py-3.5">
        <CurrencyAmount amount={client.setupFee} />
      </td>
      <td className="px-5 py-3.5">
        <CurrencyAmount amount={client.monthlyFee} />
      </td>
      <td className="px-5 py-3.5">
        {client.status === "pending" ? (
          <div className="max-w-[140px]">
            <ProgressBar value={progress} />
            {nextLabel && (
              <p className="mt-1 text-xs text-navy-muted">
                Next: {nextLabel}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-navy-muted">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <ClientPortalStageBadge client={client} />
      </td>
      <td className="px-5 py-3.5">
        <button
          type="button"
          onClick={() => onManage(client.id)}
          className="rounded-lg border border-baby-200 bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-baby-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baby-400"
        >
          Manage
        </button>
      </td>
    </tr>
  );
}

function ClientCard({
  client,
  onManage,
}: {
  client: Client;
  onManage: (id: string) => void;
}) {
  const progress = getOnboardingProgress(client);
  const nextLabel = getNextStepLabel(client);

  return (
    <div className="rounded-xl border border-baby-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-navy">{client.company}</p>
          <p className="text-sm text-navy-muted">{client.contactName}</p>
        </div>
        <StatusBadge status={client.status} />
      </div>
      <div className="mt-3 flex gap-4 text-sm">
        <span className="text-navy-muted">
          Setup:{" "}
          <CurrencyAmount amount={client.setupFee} />
        </span>
        <span className="text-navy-muted">
          Monthly:{" "}
          <CurrencyAmount amount={client.monthlyFee} />
        </span>
      </div>
      <div className="mt-3">
        <ClientPortalStageBadge client={client} />
      </div>
      {client.status === "pending" && (
        <div className="mt-3">
          <ProgressBar value={progress} label="Onboarding" />
          {nextLabel && (
            <p className="mt-1 text-xs text-navy-muted">
              Next: {nextLabel}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => onManage(client.id)}
        className="mt-4 w-full rounded-lg border border-baby-200 bg-baby-50 py-2 text-sm font-medium text-navy transition-colors hover:bg-baby-100"
      >
        Manage
      </button>
    </div>
  );
}

function ClientPortalStageBadge({ client }: { client: Client }) {
  const workspace = getWorkspaceForClientId(client.id);
  if (!workspace) {
    return <span className="text-xs text-navy-muted">—</span>;
  }
  const stage = getCustomerPortalStage(client);
  return (
    <span className="inline-block max-w-[9rem] rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-dark">
      {CUSTOMER_PORTAL_STAGE_LABELS[stage]}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
