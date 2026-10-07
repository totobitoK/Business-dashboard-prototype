"use client";

import { MetricCard } from "@/components/MetricCard";
import { useClientStore } from "@/lib/client-store";
import {
  calculateMRR,
  calculatePaidRevenue,
  calculatePipelineRevenue,
  formatCurrency,
} from "@/lib/metrics";

export function RevenueMetrics() {
  const { clients } = useClientStore();

  const paidRevenue = calculatePaidRevenue(clients);
  const pipelineRevenue = calculatePipelineRevenue(clients);
  const mrr = calculateMRR(clients);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Paid revenue"
        value={formatCurrency(paidRevenue)}
        sublabel="Recorded payments minus refunds"
        accent
        isCurrency
      />
      <MetricCard
        label="Pipeline revenue"
        value={formatCurrency(pipelineRevenue)}
        sublabel="Unpaid setup fees from pending clients"
        isCurrency
      />
      <MetricCard
        label="Monthly recurring revenue"
        value={formatCurrency(mrr)}
        sublabel="Active subscriptions only"
        accent
        isCurrency
      />
    </div>
  );
}
