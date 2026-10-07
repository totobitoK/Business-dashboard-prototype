"use client";

import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { adminRoutes } from "@/lib/routes";
import { PageHeader } from "@/components/PageHeader";
import { PendingOnboardingList } from "@/components/PendingOnboardingList";
import { RecentActivity } from "@/components/RecentActivity";
import { RevenueMetrics } from "@/components/RevenueMetrics";
import { useClientStore } from "@/lib/client-store";
import {
  getActiveCount,
  getPendingCount,
  getRecentActivity,
} from "@/lib/metrics";

export default function OverviewPage() {
  const { clients } = useClientStore();
  const activeCount = getActiveCount(clients);
  const pendingCount = getPendingCount(clients);
  const recentActivity = getRecentActivity(clients, 6);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Dashboard"
        description="Revenue and client status at a glance."
      />

      <section aria-label="Revenue summary">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Revenue</h2>
          <Link
            href={adminRoutes.revenue}
            className="text-xs font-medium text-purple hover:text-purple-dark"
          >
            View details →
          </Link>
        </div>
        <RevenueMetrics />
      </section>

      <section aria-label="Client counts">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Active customers" value={String(activeCount)} accent />
          <MetricCard label="Pending clients" value={String(pendingCount)} />
        </div>
      </section>

      <section aria-label="Pending onboarding">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Pending onboarding</h2>
          <Link
            href={adminRoutes.onboarding}
            className="text-xs font-medium text-purple hover:text-purple-dark"
          >
            View all →
          </Link>
        </div>
        <PendingOnboardingList compact />
      </section>

      <section aria-label="Recent activity">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
          <Link
            href={adminRoutes.activity}
            className="text-xs font-medium text-purple hover:text-purple-dark"
          >
            View all →
          </Link>
        </div>
        <RecentActivity activities={recentActivity} />
      </section>
    </div>
  );
}
