export function ProgressBar({
  value,
  label,
  valueClassName = "text-purple",
  trackClassName = "bg-purple-100",
  fillClassName = "bg-gradient-to-r from-purple to-purple-light",
}: {
  value: number;
  label?: string;
  valueClassName?: string;
  trackClassName?: string;
  fillClassName?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-muted">{label}</span>
          <span className={`font-medium ${valueClassName}`}>{value}%</span>
        </div>
      )}
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full ${trackClassName}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillClassName}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
