"use client";

import Link from "next/link";
import { useState } from "react";
import { LAYOUT_CUSTOMIZE_THEMES } from "@/lib/layout-customize-themes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { WorkspaceThemeId } from "@/lib/customer-portal-context";
import { dashboardRoutes } from "@/lib/routes";
import {
  DASHBOARD_WIDGET_IDS,
  WIDGET_LABELS,
} from "@/lib/workspace-widget-layout";

export function CustomerSettingsPage() {
  const {
    workspace,
    settings,
    updateSettings,
    resetLayoutToDefaults,
    moveWidget,
    toggleWidgetHidden,
    theme,
  } = useCustomerPortal();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!workspace) return null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple">
          {workspace.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Appearance & layout</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Saved per demo workspace in your browser only — does not change CRM records,
          connection permissions, or financial source data.
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
          <span className="block text-sm font-semibold text-ink">Compact layout</span>
          <span className="mt-1 block text-sm text-ink-muted">
            Tighter spacing and smaller KPI type on the sample dashboard.
          </span>
        </span>
      </label>

      <fieldset className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
        <legend className="px-1 text-sm font-semibold text-ink">Dashboard widgets</legend>
        <p className="mt-1 text-sm text-ink-muted">
          Reorder optional sections or hide them. Order applies on the home preview.
        </p>
        <ul className="mt-4 space-y-2">
          {settings.widgetOrder.map((id, index) => {
            const hidden = settings.hiddenWidgets.includes(id);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-50 px-3 py-2"
              >
                <span className={`text-sm font-medium ${hidden ? "text-ink-muted line-through" : "text-ink"}`}>
                  {WIDGET_LABELS[id]}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveWidget(id, "up")}
                    className="rounded border border-purple-100 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === settings.widgetOrder.length - 1}
                    onClick={() => moveWidget(id, "down")}
                    className="rounded border border-purple-100 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWidgetHidden(id)}
                    className="rounded border border-purple-100 px-2 py-1 text-xs font-semibold"
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          All widgets: {DASHBOARD_WIDGET_IDS.join(", ")}
        </p>
      </fieldset>

      <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-ink">Restore default layout</p>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mt-3 rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
          >
            Reset this workspace…
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                resetLayoutToDefaults();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-purple-100 px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

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
