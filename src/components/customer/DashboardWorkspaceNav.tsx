"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DASHBOARD_SECTIONS,
  dashboardSectionHref,
  sectionIdFromPathname,
} from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function DashboardWorkspaceNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const { workspaceId, theme } = useCustomerPortal();
  const active = sectionIdFromPathname(pathname);

  if (!workspaceId) return null;

  const base = embedded
    ? "border-white/20 bg-white/10"
    : "border-purple-100 bg-purple-50/40";

  return (
    <nav
      aria-label="Dashboard sections"
      className={`flex flex-wrap gap-1 rounded-lg border p-1 ${base} ${embedded ? "mt-2" : "mb-4"}`}
    >
      {DASHBOARD_SECTIONS.map((section) => {
        const isActive = section.id === active;
        const href = dashboardSectionHref(section.href, workspaceId);
        return (
          <Link
            key={section.id}
            href={href}
            title={section.description}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              isActive
                ? embedded
                  ? "bg-white text-purple-dark shadow-sm"
                  : `${theme.navActive}`
                : embedded
                  ? "text-white/90 hover:bg-white/15"
                  : "bg-white/70 text-ink hover:bg-white"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
