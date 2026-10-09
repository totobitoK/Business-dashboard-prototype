"use client";

import type { ReactNode } from "react";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";

export function DashboardSection({
  theme,
  title,
  subtitle,
  headerAside,
  accent = "default",
  compact = false,
  tightToolbar = false,
  subtitleAlign = "right",
  children,
}: {
  theme: LayoutCustomizeTheme;
  title: string;
  /** Period or counts — shown below the title. */
  subtitle?: ReactNode;
  headerAside?: ReactNode;
  accent?: "default" | "alert";
  compact?: boolean;
  /** Less vertical space around a header toolbar and below the header rule. */
  tightToolbar?: boolean;
  subtitleAlign?: "left" | "center" | "right";
  children: ReactNode;
}) {
  const padX = compact ? "px-4" : "px-5 sm:px-6";
  const alertOverlay =
    accent === "alert"
      ? "bg-gradient-to-b from-amber-50/45 via-white to-white ring-amber-200/70 before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-2xl before:bg-amber-400"
      : "";

  return (
    <section className={`relative overflow-visible ${theme.sectionPanel} ${alertOverlay}`}>
      <header
        className={`flex w-full flex-col ${padX} ${theme.sectionHeader} ${
          tightToolbar
            ? "gap-1 pb-1.5 pt-3 sm:gap-1.5 sm:pb-1.5 sm:pt-3"
            : headerAside
              ? "gap-1.5 pb-2 pt-3 sm:pb-2 sm:pt-3.5"
              : "gap-2 pb-2 pt-3 sm:pb-2.5 sm:pt-3.5"
        }`}
      >
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          <h3 className="text-center text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle ? (
            <div
              className={`min-w-0 text-xs font-medium leading-tight text-ink-muted tabular-nums ${
                subtitleAlign === "center"
                  ? "text-center"
                  : subtitleAlign === "left"
                    ? "text-left"
                    : "text-right"
              }`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {headerAside ? (
          <div className="relative z-10 flex w-full min-w-0 justify-end">{headerAside}</div>
        ) : null}
      </header>
      <div
        className={`${padX} sm:pb-5 ${tightToolbar ? "pb-3 pt-1.5" : "pb-4 pt-2.5"}`}
      >
        {children}
      </div>
    </section>
  );
}
