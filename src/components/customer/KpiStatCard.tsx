import type { ReactNode } from "react";

export type KpiIconName = "dollar" | "check" | "receipt" | "alert" | "layers";

function KpiIcon({ name }: { name: KpiIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" {...stroke} />
      </svg>
    );
  }
  if (name === "receipt") {
    return (
      <svg {...common}>
        <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" {...stroke} />
        <path d="M9 8h6M9 12h6" {...stroke} />
      </svg>
    );
  }
  if (name === "alert") {
    return (
      <svg {...common}>
        <path d="M12 9v4M12 17h.01" {...stroke} />
        <path d="M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z" {...stroke} />
      </svg>
    );
  }
  if (name === "layers") {
    return (
      <svg {...common}>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" {...stroke} />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" {...stroke} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 2v20" {...stroke} />
      <path d="M17 6.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...stroke} />
    </svg>
  );
}

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d={up ? "M7 17 17 7M9 7h8v8" : "M7 7l10 10M17 9v8h-8"}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function deltaClass(tone: "neutral" | "up" | "down" | undefined): string {
  if (!tone || tone === "neutral") return "text-ink-muted";
  return "text-ink";
}

export function KpiStatCard({
  label,
  sub,
  compare,
  compareTone,
  higherIsBetter = true,
  value,
  className,
  accentClass,
  icon,
  compact,
}: {
  label: string;
  sub: string;
  compare?: string;
  compareTone?: "neutral" | "up" | "down";
  higherIsBetter?: boolean;
  value: ReactNode;
  className: string;
  accentClass?: string;
  icon?: KpiIconName;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
        compact ? "p-2.5" : "p-3 motion-safe:hover:-translate-y-0.5 sm:p-4"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-muted">{label}</p>
          <div className="mt-1">{value}</div>
          <p className="mt-0.5 text-[10px] text-ink-muted">{sub}</p>
          {compare ? (
            <p
              className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${deltaClass(compareTone)}`}
            >
              {compareTone === "up" || compareTone === "down" ? (
                <TrendArrow up={compareTone === "up"} />
              ) : null}
              <span>{compare}</span>
            </p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ${accentClass ?? ""} ${
              compact ? "h-8 w-8" : "h-9 w-9"
            }`}
          >
            <KpiIcon name={icon} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
