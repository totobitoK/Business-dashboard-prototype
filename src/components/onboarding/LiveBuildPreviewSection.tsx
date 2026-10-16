"use client";

import Link from "next/link";
import { LivePreviewReviewControls } from "@/components/onboarding/LivePreviewReviewControls";
import {
  getOutstandingCustomerRequests,
} from "@/lib/onboarding-handoff";
import { getCustomerPortalStage } from "@/lib/customer-portal-stage";
import { hasScopeConfirmed, isMilestoneComplete } from "@/lib/client-milestones";
import type { Client } from "@/lib/types";

export function LiveBuildPreviewSection({ client }: { client: Client }) {
  if (!client.liveBuildPreviewTrack || !hasScopeConfirmed(client)) {
    return null;
  }

  const stage = getCustomerPortalStage(client);
  const guidedDone = isMilestoneComplete(client, "guided-data-setup");
  const outstanding = getOutstandingCustomerRequests(client);
  const showPreviewControls =
    stage === "preview-ready" ||
    stage === "approved-awaiting-launch" ||
    stage === "approved-balance-due";

  return (
    <section className="space-y-4 rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
      <h2 className="text-sm font-semibold text-ink">Build &amp; preview review</h2>

      {!guidedDone ? (
        <p className="text-sm text-ink-muted">
          RavenView will begin your dashboard build after guided setup is marked complete.
        </p>
      ) : stage === "building" && !showPreviewControls ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-ink">We&apos;re building your dashboard.</p>
          {client.buildStatusNote ? (
            <p className="text-ink-muted">{client.buildStatusNote}</p>
          ) : (
            <p className="text-ink-muted">
              RavenView will post an update here when your preview is ready.
            </p>
          )}
          {client.buildNextUpdateMessage ? (
            <p className="rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2 text-ink-muted">
              <span className="font-medium text-ink">Next update: </span>
              {client.buildNextUpdateMessage}
            </p>
          ) : null}
          {outstanding.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Outstanding from you
              </p>
              <ul className="mt-1 list-inside list-disc text-amber-950">
                {outstanding.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPreviewControls && client.dashboardPreviewUrl ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Review the sample dashboard layout. All figures are labeled sample data — not your live
            books.
          </p>
          <Link
            href={client.dashboardPreviewUrl}
            className="inline-flex rounded-lg border border-purple px-4 py-2 text-sm font-semibold text-purple hover:bg-purple-50"
          >
            Open dashboard preview ↗
          </Link>
        </div>
      ) : null}

      {showPreviewControls ? <LivePreviewReviewControls client={client} /> : null}

      <p className="text-xs text-ink-muted">
        Setup payments, billing, and launch activation are not available in this milestone.
      </p>
    </section>
  );
}
