"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { adminRoutes } from "@/lib/routes";
import { useSidebar } from "@/lib/sidebar-context";
import { RavenViewWordmark } from "./RavenViewWordmark";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ active: boolean }>;
  filter?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: adminRoutes.dashboard, label: "Dashboard", icon: DashboardIcon },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: adminRoutes.revenue, label: "Revenue", icon: RevenueIcon },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: adminRoutes.clients, label: "All clients", icon: ClientsIcon },
      {
        href: adminRoutes.clients,
        label: "Pending",
        icon: PendingIcon,
        filter: "pending",
      },
      {
        href: adminRoutes.clients,
        label: "Active",
        icon: ActiveIcon,
        filter: "active",
      },
      {
        href: adminRoutes.clients,
        label: "Archived",
        icon: ArchivedIcon,
        filter: "archived",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: adminRoutes.onboarding, label: "Onboarding", icon: OnboardingIcon },
      { href: adminRoutes.activity, label: "Activity", icon: ActivityIcon },
    ],
  },
];

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const currentFilter = searchParams.get("filter");

  function isActive(item: NavItem) {
    if (item.filter) {
      return pathname === adminRoutes.clients && currentFilter === item.filter;
    }
    if (item.href === adminRoutes.dashboard) {
      return pathname === adminRoutes.dashboard;
    }
    if (item.href === adminRoutes.clients) {
      return pathname === adminRoutes.clients && !currentFilter;
    }
    return pathname.startsWith(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-11 z-40 rounded-md border border-purple-200 bg-white p-2 shadow-soft lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-10 z-50 flex flex-col border-r border-purple-100 bg-white transition-all duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-16" : "w-56"}`}
      >
        <div
          className={`flex shrink-0 items-center border-b border-purple-100 ${
            collapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3"
          }`}
        >
          <RavenViewWordmark
            linked
            collapsed={collapsed}
            href={adminRoutes.dashboard}
          />
          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              className="hidden rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-purple-50 hover:text-purple lg:block"
              aria-label="Collapse sidebar"
            >
              <CollapseIcon />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="mx-auto mb-1 mt-1 hidden rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-purple-50 hover:text-purple lg:block"
            aria-label="Expand sidebar"
          >
            <ExpandIcon />
          </button>
        )}

        <nav
          className="flex-1 overflow-y-auto px-2 py-3"
          aria-label="Main navigation"
        >
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-purple">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  const href = item.filter
                    ? `${item.href}?filter=${item.filter}`
                    : item.href;
                  const Icon = item.icon;

                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center rounded-lg transition-colors ${
                          collapsed
                            ? "justify-center px-2 py-2.5"
                            : "gap-3 px-3 py-2"
                        } text-sm font-medium ${
                          active
                            ? "bg-purple-50 text-purple shadow-glow"
                            : "text-ink-muted hover:bg-purple-50/60 hover:text-ink"
                        }`}
                      >
                        <Icon active={active} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="shrink-0 border-t border-purple-100 px-4 py-3">
            <p className="text-[10px] text-ink-subtle">Stage 1 prototype</p>
          </div>
        )}
      </aside>
    </>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </IconWrapper>
  );
}

function RevenueIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </IconWrapper>
  );
}

function ClientsIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </IconWrapper>
  );
}

function PendingIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </IconWrapper>
  );
}

function ActiveIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </IconWrapper>
  );
}

function ArchivedIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </IconWrapper>
  );
}

function OnboardingIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </IconWrapper>
  );
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <IconWrapper active={active}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </IconWrapper>
  );
}

function IconWrapper({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${active ? "text-purple" : "text-ink-subtle"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5 text-ink"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}
