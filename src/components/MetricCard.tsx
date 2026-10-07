export function MetricCard({
  label,
  value,
  sublabel,
  accent = false,
  isCurrency = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
  isCurrency?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-soft ${
        accent
          ? "border-purple-200 bg-gradient-to-br from-purple-50 to-white"
          : "border-purple-100 bg-white"
      }`}
    >
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          isCurrency || accent ? "text-purple" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-xs text-ink-subtle">{sublabel}</p>
      )}
    </div>
  );
}
