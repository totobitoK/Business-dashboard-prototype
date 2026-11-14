import { Suspense } from "react";
import { CustomerConnectionsPage } from "@/components/customer/CustomerConnectionsPage";

export default function DashboardConnectionsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading connections…</p>}>
      <CustomerConnectionsPage />
    </Suspense>
  );
}
