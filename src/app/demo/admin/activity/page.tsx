"use client";

import { PageHeader } from "@/components/PageHeader";
import { RecentActivity } from "@/components/RecentActivity";
import { useClientStore } from "@/lib/client-store";
import { getRecentActivity } from "@/lib/metrics";

export default function ActivityPage() {
  const { clients } = useClientStore();
  const allActivity = getRecentActivity(clients);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Activity"
        description="Payments and notes grouped by category."
      />
      <RecentActivity activities={allActivity} />
    </div>
  );
}
