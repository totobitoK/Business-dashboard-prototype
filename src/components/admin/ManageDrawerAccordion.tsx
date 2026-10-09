"use client";

export function ManageDrawerAccordion({
  title,
  summary,
  open,
  onToggle,
  lockOpen = false,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  lockOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-baby-200 bg-white">
      <button
        type="button"
        onClick={() => {
          if (!lockOpen) onToggle();
        }}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-baby-50/50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">{title}</p>
          <p className="mt-0.5 text-xs text-navy-muted line-clamp-2">{summary}</p>
        </div>
        <span className="shrink-0 text-xs text-navy-muted" aria-hidden>
          {lockOpen ? "Editing" : open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="border-t border-baby-100 px-4 py-4">{children}</div>
      )}
    </div>
  );
}
