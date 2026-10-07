"use client";

import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { RevenueMetrics } from "@/components/RevenueMetrics";
import { useClientStore } from "@/lib/client-store";
import {
  calculateMRR,
  calculatePaidRevenue,
  calculatePipelineRevenue,
  formatCurrency,
  formatCurrencyDetailed,
} from "@/lib/metrics";

export default function RevenuePage() {
  const { clients } = useClientStore();
  const paidRevenue = calculatePaidRevenue(clients);
  const pipelineRevenue = calculatePipelineRevenue(clients);
  const mrr = calculateMRR(clients);

  const activeClients = clients.filter(
    (c) => c.status === "active" && c.subscriptionActive
  );
  const pendingWithBalance = clients.filter(
    (c) => c.status === "pending" && c.setupFee > c.setupPaidAmount
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Revenue"
        title="Revenue"
        description="Paid revenue, pipeline, and recurring subscription income."
      />

      <RevenueMetrics />

      <section aria-label="Revenue breakdown">
        <h2 className="mb-3 text-sm font-semibold text-ink">Breakdown</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-glow">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple">
              Active subscriptions ({activeClients.length})
            </h3>
            <p className="mt-2 text-xl font-semibold">
              <span className="text-purple">{formatCurrency(mrr)}</span>
              <span className="text-ink">/mo</span>
            </p>
            {activeClients.length > 0 ? (
              <ul className="mt-3 divide-y divide-purple-50">
                {activeClients.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span className="text-ink-muted">{c.company}</span>
                    <span className="font-medium text-purple">
                      {formatCurrency(c.monthlyFee)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No active subscriptions.</p>
            )}
          </div>

          <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-glow">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple">
              Pipeline — unpaid setup ({pendingWithBalance.length})
            </h3>
            <p className="mt-2 text-xl font-semibold text-purple">
              {formatCurrency(pipelineRevenue)}
            </p>
            {pendingWithBalance.length > 0 ? (
              <ul className="mt-3 divide-y divide-purple-50">
                {pendingWithBalance.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span className="text-ink-muted">{c.company}</span>
                    <span className="font-medium text-purple">
                      {formatCurrencyDetailed(c.setupFee - c.setupPaidAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No outstanding setup fees.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Paid revenue note">
        <MetricCard
          label="Total paid revenue"
          value={formatCurrency(paidRevenue)}
          sublabel="All recorded payments minus refunds across every client"
          accent
          isCurrency
        />
      </section>
    </div>
  );
}
