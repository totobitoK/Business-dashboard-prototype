"use client";

import Link from "next/link";
import { LAYOUT_CUSTOMIZE_THEMES } from "@/lib/layout-customize-themes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { WorkspaceThemeId } from "@/lib/customer-portal-context";
import { dashboardRoutes } from "@/lib/routes";

export function CustomerSettingsPage() {
  const { workspace, settings, updateSettings, theme } = useCustomerPortal();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple">
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Appearance & layout</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Planned customization controls — saved per demo workspace in your browser only.
        </p>
      </div>

      <fieldset className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
        <legend className="px-1 text-sm font-semibold text-ink">Color theme</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {LAYOUT_CUSTOMIZE_THEMES.map((t) => (
            <label
              key={t.id}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                settings.themeId === t.id
                  ? "border-purple bg-purple-50/40"
                  : "border-purple-100 hover:border-purple-200"
              }`}
            >
              <input
                type="radio"
                name="theme"
                className="sr-only"
                checked={settings.themeId === t.id}
                onChange={() => updateSettings({ themeId: t.id as WorkspaceThemeId })}
              />
              <span className={`block h-2 rounded-full ${t.header}`} />
              <span className="mt-2 block text-sm font-semibold text-ink">{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
        <input
          type="checkbox"
          checked={settings.showCompactMetrics}
          onChange={(e) => updateSettings({ showCompactMetrics: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-purple-200 text-purple"
        />
        <span>
          <span className="block text-sm font-semibold text-ink">Compact metric row</span>
          <span className="mt-1 block text-sm text-ink-muted">
            Tighter KPI layout on dashboard previews (demo preference).
          </span>
        </span>
      </label>

      <div className={`rounded-xl border p-4 text-sm ${theme.card}`}>
        <p className="font-semibold text-ink">Preview swatch</p>
        <p className="mt-1 text-ink-muted">Theme applies to sample dashboard widgets on home.</p>
      </div>

      <Link
        href={dashboardRoutes.home}
        className="inline-block text-sm font-semibold text-purple hover:text-purple-dark"
      >
        ← Back to home
      </Link>
    </div>
  );
}
