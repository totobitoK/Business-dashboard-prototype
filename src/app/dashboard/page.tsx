import { Suspense } from "react";
import { CustomerDashboardHome } from "@/components/customer/CustomerDashboardHome";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading dashboard…</p>}>
      <CustomerDashboardHome />
    </Suspense>
  );
}
