import { Suspense } from "react";
import { CustomerPortalDashboard } from "@/components/customer/CustomerPortalDashboard";

export default function LiveCustomerDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading dashboard…</p>}>
      <CustomerPortalDashboard />
    </Suspense>
  );
}
