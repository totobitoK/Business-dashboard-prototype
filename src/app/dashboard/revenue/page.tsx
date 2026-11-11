import { Suspense } from "react";
import { DashboardSectionRedirect } from "@/components/customer/DashboardSectionRedirect";

export default function LiveDashboardRevenuePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening dashboard…</p>}>
      <DashboardSectionRedirect section="revenue" />
    </Suspense>
  );
}
