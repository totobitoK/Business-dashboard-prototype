"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useClientStore } from "@/lib/client-store";
import {
  getMilestoneProgressPercent,
  getNextMilestoneLabel,
} from "@/lib/client-milestones";
import { adminRoutes } from "@/lib/routes";

export function PendingOnboardingList({ compact = false }: { compact?: boolean }) {
  const { clients } = useClientStore();
  const pendingClients = clients.filter((c) => c.status === "pending");
  const displayed = compact ? pendingClients.slice(0, 4) : pendingClients;

  if (pendingClients.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No clients currently in onboarding.</p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-purple-100 rounded-xl border border-purple-100 bg-white shadow-glow">
        {displayed.map((client) => {
          const progress = getMilestoneProgressPercent(client);
          const nextLabel = getNextMilestoneLabel(client);
          return (
            <li
              key={client.id}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{client.company}</p>
                  <StatusBadge status="pending" />
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {client.contactName}
                </p>
                {nextLabel && (
                  <p className="mt-1 text-xs text-purple">
                    Next: {nextLabel}
                  </p>
                )}
              </div>
              <div className="w-full sm:max-w-xs">
                <ProgressBar value={progress} label="Milestones" />
              </div>
            </li>
          );
        })}
      </ul>
      {compact && pendingClients.length > 4 && (
        <Link
          href={adminRoutes.onboarding}
          className="mt-3 inline-block text-sm font-medium text-purple hover:text-purple-dark"
        >
          View all {pendingClients.length} pending →
        </Link>
      )}
    </>
  );
}
