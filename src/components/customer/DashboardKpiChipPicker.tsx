"use client";

export function DashboardKpiChipPicker<T extends string>({
  order,
  hidden,
  labels,
  themeChipActive,
  themeChipIdle,
  onToggleHidden,
}: {
  order: T[];
  hidden: T[];
  labels: Record<T, string>;
  themeChipActive: string;
  themeChipIdle: string;
  onToggleHidden: (id: T) => void;
}) {
  const visibleCount = order.filter((id) => !hidden.includes(id)).length;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="KPI cards to show">
      {order.map((id) => {
        const isVisible = !hidden.includes(id);
        const isLastVisible = isVisible && visibleCount <= 1;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isVisible}
            disabled={isLastVisible}
            title={isLastVisible ? "At least one KPI must stay visible" : undefined}
            onClick={() => onToggleHidden(id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isVisible ? themeChipActive : themeChipIdle
            }`}
          >
            {labels[id]}
          </button>
        );
      })}
    </div>
  );
}
