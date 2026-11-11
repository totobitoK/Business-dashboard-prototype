import { Suspense } from "react";
import { CustomerPortalDashboard } from "@/components/customer/CustomerPortalDashboard";
import { loadLiveDailyDashboard } from "@/lib/daily-dashboard/load-live-dashboard";

export default async function LiveCustomerDashboardPage() {
  const liveSnapshot = await loadLiveDailyDashboard();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading dashboard…</p>}>
      <CustomerPortalDashboard liveSnapshot={liveSnapshot} />
    </Suspense>
  );
}
