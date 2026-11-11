"use client";

import { DailyDashboard } from "@/components/customer/daily/DailyDashboard";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";

/** Shared customer dashboard. Pass `liveSnapshot` only from the signed-in route. */
export function CustomerPortalDashboard({
  liveSnapshot = null,
  changesRequestedNote,
}: {
  liveSnapshot?: DailyDashboardSnapshot | null;
  changesRequestedNote?: string;
}) {
  return (
    <DailyDashboard liveSnapshot={liveSnapshot} changesRequestedNote={changesRequestedNote} />
  );
}
