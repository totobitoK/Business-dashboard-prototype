"use client";

import { useMemo } from "react";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import {
  composeCustomerDashboard,
  connectedToolsFromClient,
  connectedToolsFromSnapshot,
  type CustomerDashboardComposition,
} from "@/lib/dashboard-composition";
import { demoClients } from "@/lib/demo-data";
import { useCustomerPortal } from "@/lib/customer-portal-context";

/** Demo and preview routes already have sample records, so a not-yet-started connection does not replace them. */
function sampleComposition(connected: ReturnType<typeof connectedToolsFromClient>) {
  const layout = composeCustomerDashboard({ connected: connected ?? [] });
  return layout.promptToConnect ? null : layout;
}

/**
 * `null` keeps the sample layout. Signed-in /dashboard has no connector list.
 * A live snapshot still asks to connect a source when nothing is connected.
 */
export function useDashboardComposition(
  liveSnapshot?: DailyDashboardSnapshot | null
): CustomerDashboardComposition | null {
  const { client, workspace, liveSamplePreview } = useCustomerPortal();

  return useMemo(() => {
    if (liveSnapshot) {
      return composeCustomerDashboard({
        connected: connectedToolsFromSnapshot(liveSnapshot),
      });
    }
    if (client) {
      return sampleComposition(connectedToolsFromClient(client) ?? []);
    }
    if (liveSamplePreview && workspace) {
      const demo = demoClients.find((item) => item.id === workspace.clientId);
      if (demo) return sampleComposition(connectedToolsFromClient(demo) ?? []);
    }
    return null;
  }, [client, liveSamplePreview, liveSnapshot, workspace]);
}
