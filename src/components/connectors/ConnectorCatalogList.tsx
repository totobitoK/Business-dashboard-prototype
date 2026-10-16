import { CONNECTOR_CATALOG, type ConnectorCatalogEntry } from "@/lib/connector-catalog";

function statusBadgeClass(availability: ConnectorCatalogEntry["availability"]): string {
  if (availability === "in_development") {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  if (availability === "available") {
    return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  }
  return "bg-purple-50 text-purple-dark ring-purple-100";
}

export function ConnectorCatalogList({
  entries = CONNECTOR_CATALOG.filter((c) => c.includeInMarketing),
  showDescriptions = true,
}: {
  entries?: ConnectorCatalogEntry[];
  showDescriptions?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {entries.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-purple-100 bg-white px-4 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{item.label}</p>
              {showDescriptions ? (
                <p className="mt-1 text-sm text-ink-muted">{item.shortDescription}</p>
              ) : null}
            </div>
            <span
              className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:self-center ${statusBadgeClass(item.availability)}`}
            >
              {item.statusLabel}
            </span>
          </li>
      ))}
    </ul>
  );
}
