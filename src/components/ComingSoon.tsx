export function ComingSoon({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-baby-300 bg-baby-50/50 px-4 py-3">
      <p className="text-sm font-medium text-navy-muted">{label}</p>
      <p className="mt-0.5 text-xs text-navy-muted/80">
        {description ?? "Coming next — not available in this prototype."}
      </p>
    </div>
  );
}
