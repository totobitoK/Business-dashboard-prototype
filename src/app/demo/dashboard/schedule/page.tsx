import { Suspense } from "react";
import { DashboardSectionRedirect } from "@/components/customer/DashboardSectionRedirect";

export default function DashboardSchedulePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening dashboard…</p>}>
      <DashboardSectionRedirect section="schedule" />
    </Suspense>
  );
}
