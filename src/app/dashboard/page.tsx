import { Suspense } from "react";
import { CustomerPortalDashboard } from "@/components/customer/CustomerPortalDashboard";

export default function LiveCustomerDashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading dashboard…</p>}>
      <CustomerPortalDashboard />
    </Suspense>
  );
}
