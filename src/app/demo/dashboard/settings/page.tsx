import { Suspense } from "react";
import { CustomerSettingsPage } from "@/components/customer/CustomerSettingsPage";

export default function DashboardSettingsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading settings…</p>}>
      <CustomerSettingsPage />
    </Suspense>
  );
}
