"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RavenViewWordmark } from "@/components/RavenViewWordmark";
import { dashboardRoutes, marketingRoutes } from "@/lib/routes";

const links = [
  { href: dashboardRoutes.home, label: "Home" },
  { href: dashboardRoutes.connections, label: "Connections" },
  { href: dashboardRoutes.settings, label: "Settings" },
];

export function CustomerPortalNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-purple-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
        <RavenViewWordmark linked href={dashboardRoutes.home} size="md" />
        <nav
          className="flex flex-1 flex-wrap items-center gap-1 sm:gap-2"
          aria-label="Customer portal"
        >
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-purple-50 text-purple-dark"
                    : "text-ink hover:bg-purple-50/60 hover:text-purple"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href={marketingRoutes.home}
          className="text-sm font-medium text-ink hover:text-purple"
        >
          Marketing site
        </Link>
      </div>
    </header>
  );
}
