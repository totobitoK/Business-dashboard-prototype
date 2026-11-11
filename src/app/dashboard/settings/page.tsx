import { Suspense } from "react";
import { CustomerSettingsPage } from "@/components/customer/CustomerSettingsPage";
import { loadLiveDailyDashboard } from "@/lib/daily-dashboard/load-live-dashboard";

export default async function LiveDashboardSettingsPage() {
  const liveSnapshot = await loadLiveDailyDashboard();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading settings…</p>}>
      <CustomerSettingsPage liveSnapshot={liveSnapshot} />
    </Suspense>
  );
}
