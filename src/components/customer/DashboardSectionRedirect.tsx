"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardSectionId } from "@/lib/dashboard-section-routes";
import { dashboardSectionHref } from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import { demoDashboardRoutes } from "@/lib/routes";

/** Legacy /dashboard/revenue and /dashboard/schedule → home with ?section= */
export function DashboardSectionRedirect({ section }: { section: DashboardSectionId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId } = useCustomerPortal();

  useEffect(() => {
    const ws = workspaceId ?? searchParams.get("workspace");
    if (!ws) {
      router.replace(demoDashboardRoutes.home);
      return;
    }
    router.replace(dashboardSectionHref(ws, section, demoDashboardRoutes.home));
  }, [router, searchParams, section, workspaceId]);

  return (
    <p className="text-sm text-ink-muted" aria-live="polite">
      Opening dashboard…
    </p>
  );
}
