"use client";

import {
  getMilestoneProgress,
  getMilestonesForPath,
  isAdminTogglableMilestone,
  isClientJourneyComplete,
  isMilestoneComplete,
  MILESTONE_LABELS,
} from "@/lib/client-milestones";
import { useClientStore } from "@/lib/client-store";
import type { Client, ClientMilestone } from "@/lib/types";

export function AdminMilestones({ client }: { client: Client }) {
  const { toggleAdminMilestone } = useClientStore();
  const path = getMilestonesForPath(client);
  const { completed, total } = getMilestoneProgress(client);

  return (
    <div>
      <p className="mb-2 text-xs text-navy-muted">
        Milestones: {completed} of {total} complete
      </p>
      <ul className="space-y-2">
        {path.map((milestone) => (
          <MilestoneRow
            key={milestone}
            client={client}
            milestone={milestone}
            onToggle={() => toggleAdminMilestone(client.id, milestone)}
          />
        ))}
      </ul>
      {client.status === "active" ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Active — onboarding complete
        </p>
      ) : isClientJourneyComplete(client) ? (
        <p className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2 text-sm text-navy">
          All milestones complete — activate the client when ready to go live.
        </p>
      ) : null}
    </div>
  );
}

function MilestoneRow({
  client,
  milestone,
  onToggle,
}: {
  client: Client;
  milestone: ClientMilestone;
  onToggle: () => void;
}) {
  const done = isMilestoneComplete(client, milestone);
  const togglable = isAdminTogglableMilestone(milestone);
  const financial = milestone === "deposit" || milestone === "final-balance";

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-baby-100 px-3 py-2 text-sm">
      <span className={done ? "text-navy" : "text-navy-muted"}>
        {MILESTONE_LABELS[milestone]}
        {financial && (
          <span className="ml-1 text-xs text-navy-muted">(from payments)</span>
        )}
      </span>
      {togglable ? (
        <button
          type="button"
          onClick={onToggle}
          disabled={client.status === "archived"}
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            done
              ? "bg-emerald-50 text-emerald-800"
              : "bg-baby-50 text-navy-muted hover:bg-baby-100"
          }`}
        >
          {done ? "Mark incomplete" : "Mark complete"}
        </button>
      ) : (
        <span
          className={`text-xs font-medium ${
            done ? "text-emerald-700" : "text-navy-muted"
          }`}
        >
          {done ? "Complete" : "Pending"}
        </span>
      )}
    </li>
  );
}
