"use client";

import { useEffect, useState } from "react";
import {
  LAYOUT_CUSTOMIZE_SAMPLE,
  LAYOUT_CUSTOMIZE_THEMES,
  type LayoutCustomizeTheme,
} from "@/lib/layout-customize-themes";

const ROTATE_MS = 3000;
const sample = LAYOUT_CUSTOMIZE_SAMPLE;
const maxBar = Math.max(...sample.chartHeights);

export function LayoutCustomizeVisualRotator() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % LAYOUT_CUSTOMIZE_THEMES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <div className="relative min-h-[22rem] sm:min-h-[23rem]">
        {LAYOUT_CUSTOMIZE_THEMES.map((theme, index) => (
          <div
            key={theme.id}
            className={`transition-opacity duration-700 ease-in-out ${
              index === activeIndex
                ? "relative opacity-100"
                : "pointer-events-none absolute inset-0 opacity-0"
            }`}
            aria-hidden={index !== activeIndex}
          >
            <LayoutCustomizeVisual theme={theme} />
          </div>
        ))}
      </div>
      <div
        className="mt-4 flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Layout color theme preview"
      >
        {LAYOUT_CUSTOMIZE_THEMES.map((theme, index) => (
          <button
            key={theme.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={theme.name}
            onClick={() => setActiveIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex
                ? "w-6 bg-purple"
                : "w-2 bg-purple-200 hover:bg-purple-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function LayoutCustomizeVisual({ theme }: { theme: LayoutCustomizeTheme }) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${theme.card}`}>
      <div
        className={`flex items-center justify-between px-4 py-2.5 sm:px-5 ${theme.header} ${theme.headerText}`}
      >
        <p className="text-sm font-semibold">Your dashboard</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badge} ${theme.badgeText}`}
        >
          Sample layout
        </span>
      </div>

      <div className="flex gap-3 p-4 sm:p-5">
        <nav
          className={`flex w-[4.25rem] shrink-0 flex-col gap-1.5 rounded-xl p-1.5 ${theme.sidebar}`}
          aria-label="Sample navigation"
        >
          {sample.nav.map((label, i) => (
            <span
              key={label}
              className={`rounded-md px-1.5 py-1 text-center text-[9px] font-semibold leading-tight ${
                i === 0 ? theme.navActive : theme.navInactive
              }`}
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <div className={`rounded-lg border p-2.5 ${theme.metricA}`}>
            <p className="text-[10px] font-semibold text-ink">{sample.metrics[0].label}</p>
            <p className={`mt-0.5 text-lg font-bold leading-none ${theme.metricValueA}`}>
              {sample.metrics[0].value}
            </p>
          </div>
          <div className={`rounded-lg border p-2.5 ${theme.metricB}`}>
            <p className="text-[10px] font-semibold text-ink">{sample.metrics[1].label}</p>
            <p className={`mt-0.5 text-lg font-bold leading-none ${theme.metricValueB}`}>
              {sample.metrics[1].value}
            </p>
          </div>

          <div className={`col-span-2 rounded-lg border p-2.5 ${theme.chartPanel}`}>
            <p className="text-[10px] font-semibold text-ink">Weekly activity</p>
            <ul
              className="mt-2 flex items-end justify-between gap-0.5"
              aria-hidden
            >
              {sample.chartHeights.map((h, i) => (
                <li key={`${sample.chartLabels[i]}-${i}`} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className={`w-full max-w-[1.35rem] rounded-t ${
                      i === sample.chartHeights.length - 1
                        ? theme.chartBarHi
                        : theme.chartBar
                    }`}
                    style={{
                      height: `${Math.max(8, Math.round((h / maxBar) * 40))}px`,
                    }}
                  />
                  <span className="text-[8px] font-medium text-ink">
                    {sample.chartLabels[i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`col-span-2 rounded-lg border p-2.5 ${theme.listPanel}`}>
            <p className="text-[10px] font-semibold text-ink">Today on the calendar</p>
            <ul className="mt-1.5 space-y-1">
              {sample.appointments.map((appt) => (
                <li
                  key={appt.time}
                  className={`rounded-md border px-2 py-1 ${theme.listRow}`}
                >
                  <p className={`text-[9px] font-bold ${theme.listAccent}`}>{appt.time}</p>
                  <p className="text-[10px] font-medium leading-tight text-ink">
                    {appt.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-black/5 px-4 py-3 sm:px-5">
        {theme.swatches.map((c) => (
          <span
            key={c}
            className={`h-5 w-5 rounded-full border shadow-sm ${theme.swatchRing}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="text-xs font-semibold text-ink">{theme.name}</span>
      </div>
    </div>
  );
}
