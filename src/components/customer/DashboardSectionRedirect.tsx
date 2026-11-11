"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardSectionId } from "@/lib/dashboard-section-routes";
import {
  dashboardRoutesForPathname,
  dashboardSectionHref,
} from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";

/** Legacy /dashboard/revenue and /dashboard/schedule → home with ?section= */
export function DashboardSectionRedirect({ section }: { section: DashboardSectionId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(pathname);

  useEffect(() => {
    const ws = workspaceId ?? searchParams.get("workspace");
    if (!ws) {
      router.replace(routes.home);
      return;
    }
    router.replace(dashboardSectionHref(ws, section, routes.home));
  }, [router, routes.home, searchParams, section, workspaceId]);

  return (
    <p className="text-sm text-ink-muted" aria-live="polite">
      Opening dashboard…
    </p>
  );
}
