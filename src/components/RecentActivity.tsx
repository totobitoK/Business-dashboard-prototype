"use client";

import Link from "next/link";
import { TextWithCurrency } from "@/components/CurrencyAmount";
import {
  ACTIVITY_CATEGORY_LABELS,
  groupActivityByCategory,
} from "@/lib/metrics";
import { adminRoutes } from "@/lib/routes";
import type { ActivityCategory, ActivityEntry } from "@/lib/types";

const CATEGORY_ORDER: ActivityCategory[] = ["onboarding", "payments", "notes"];

export function RecentActivity({
  activities,
  limit,
  showViewAll = false,
}: {
  activities: ActivityEntry[];
  limit?: number;
  showViewAll?: boolean;
}) {
  const sliced = limit ? activities.slice(0, limit) : activities;
  const grouped = groupActivityByCategory(sliced);

  const hasAny = CATEGORY_ORDER.some((cat) => grouped[cat].length > 0);

  if (!hasAny) {
    return <p className="text-sm text-ink-muted">No recent activity.</p>;
  }

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category];
        if (items.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple">
              <CategoryDot category={category} />
              {ACTIVITY_CATEGORY_LABELS[category]}
              <span className="font-normal normal-case tracking-normal text-ink-subtle">
                ({items.length})
              </span>
            </h3>
            <ul className="divide-y divide-purple-100 rounded-xl border border-purple-100 bg-white shadow-glow">
              {items.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </div>
        );
      })}

      {showViewAll && (
        <Link
          href={adminRoutes.activity}
          className="inline-block text-sm font-medium text-purple hover:text-purple-dark"
        >
          View all activity →
        </Link>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">
          <TextWithCurrency text={entry.description} />
        </p>
        <p className="mt-0.5 text-xs font-medium text-ink-muted">
          {entry.clientName}
        </p>
      </div>
      <time
        className="shrink-0 text-xs text-ink-subtle"
        dateTime={entry.date}
      >
        {new Date(entry.date).toLocaleDateString()}
      </time>
    </li>
  );
}

function CategoryDot({ category }: { category: ActivityCategory }) {
  const colors: Record<ActivityCategory, string> = {
    onboarding: "bg-purple-light",
    payments: "bg-purple",
    notes: "bg-purple-muted",
  };
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${colors[category]}`}
      aria-hidden
    />
  );
}
