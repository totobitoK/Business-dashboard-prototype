import type { ClientStatus } from "@/lib/types";

const styles: Record<ClientStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

const labels: Record<ClientStatus, string> = {
  pending: "Pending",
  active: "Active",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
