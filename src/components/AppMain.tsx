"use client";

import { useSidebar } from "@/lib/sidebar-context";

export function AppMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={`min-h-screen pt-10 transition-[padding] duration-200 ${
        collapsed ? "lg:pl-16" : "lg:pl-56"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
