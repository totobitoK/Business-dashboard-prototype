"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DASHBOARD_SECTIONS,
  dashboardSectionHref,
  resolveDashboardSection,
} from "@/lib/dashboard-section-routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function DashboardWorkspaceNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, theme, navigationBase } = useCustomerPortal();
  const active = resolveDashboardSection(pathname, searchParams);

  if (!workspaceId) return null;

  const linkBase = navigationBase ?? undefined;

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
        const href = dashboardSectionHref(
          workspaceId,
          section.id,
          linkBase ?? undefined
        );
        return (
          <Link
            key={section.id}
            href={href}
            scroll={false}
            title={section.description}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              isActive
                ? embedded
                  ? theme.embeddedNavActive
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
