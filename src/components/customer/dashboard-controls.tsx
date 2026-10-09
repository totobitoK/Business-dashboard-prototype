"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";

function ChevronDown({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg
      className={`transition-transform ${open ? "rotate-180" : ""} ${className ?? ""}`}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={1.75} />
      <path d="M20 20 16.5 16.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

export function DashboardControlBar({
  theme,
  children,
  className = "",
  compact = false,
  centered = false,
  fitContent = false,
  singleRow = false,
}: {
  theme: LayoutCustomizeTheme;
  children: ReactNode;
  className?: string;
  /** Tighter inset padding — for section header toolbars (e.g. invoices). */
  compact?: boolean;
  /** Center wrapped controls (e.g. job activity filters). */
  centered?: boolean;
  /** Shrink the track to chip/select width (no full-width empty gutters). */
  fitContent?: boolean;
  /** Keep controls on one line (avoid toolbar height jumping). */
  singleRow?: boolean;
}) {
  const inset = compact
    ? fitContent
      ? "gap-1 px-0.5 py-1"
      : "gap-1 p-1"
    : "gap-1.5 p-1.5 sm:gap-2";
  const widthClass = fitContent ? "mx-auto w-fit max-w-full" : "w-full min-w-0";
  const wrapClass = singleRow ? "flex-nowrap overflow-x-auto" : "flex-wrap";
  return (
    <div
      className={`flex ${wrapClass} items-center ${widthClass} ${centered ? "justify-center" : ""} ${inset} ${theme.filterTrack} ${className}`}
    >
      {children}
    </div>
  );
}

export function DashboardSelect<T extends string>({
  theme,
  label,
  value,
  onChange,
  options,
  className = "",
  "aria-label": ariaLabel,
  align = "left",
  size = "default",
}: {
  theme: LayoutCustomizeTheme;
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  "aria-label"?: string;
  align?: "left" | "right";
  size?: "default" | "compact";
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerSize =
    size === "compact"
      ? "h-7 min-w-[6.25rem] px-2 text-[11px]"
      : "h-9 min-w-[7.5rem] px-3 text-xs";

  return (
    <div ref={rootRef} className={`relative z-20 inline-flex min-w-0 flex-col ${className}`}>
      {label ? (
        <span className={`mb-0.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider ${theme.filterLabel}`}>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel ?? label ?? selected.label}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-1.5 rounded-lg border text-left font-semibold shadow-sm transition ${triggerSize} ${theme.filterControl}`}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={`shrink-0 ${theme.filterChevron}`} open={open} />
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? label}
          className={`absolute top-full z-[100] mt-1.5 max-h-60 min-w-full overflow-y-auto ${
            align === "right" ? "right-0" : "left-0"
          } ${theme.filterMenuPanel}`}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
                    active ? theme.filterMenuItemActive : theme.filterMenuItemIdle
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {active ? <CheckIcon className={`shrink-0 ${theme.filterChevron}`} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DashboardSearchInput({
  theme,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  theme: LayoutCustomizeTheme;
}) {
  return (
    <label className={`relative block min-w-0 flex-1 sm:min-w-[12rem] ${className}`}>
      <SearchIcon
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${theme.filterChevron}`}
      />
      <input
        type="search"
        {...props}
        className={`h-9 w-full rounded-lg border py-0 pl-9 pr-3 text-xs font-medium shadow-sm transition ${theme.filterControl}`}
      />
    </label>
  );
}

export function DashboardChipGroup<T extends string>({
  theme,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  compact = false,
  nowrap = false,
}: {
  theme: LayoutCustomizeTheme;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  "aria-label": string;
  compact?: boolean;
  nowrap?: boolean;
}) {
  const chipClass = compact
    ? "rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px]"
    : "rounded-lg px-2 py-1.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex min-w-0 gap-0.5 ${nowrap ? "shrink-0 flex-nowrap" : "flex-wrap"}`}
    >
      {options.map(({ value: optValue, label }) => {
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optValue)}
            className={`transition ${chipClass} ${
              active ? theme.filterChipActive : theme.filterChipIdle
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardSecondaryButton({
  theme,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  theme: LayoutCustomizeTheme;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold shadow-sm transition ${theme.filterSecondaryButton} ${className}`}
    >
      {children}
    </button>
  );
}
