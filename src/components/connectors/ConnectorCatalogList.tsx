import type { ConnectorDefinition } from "@/lib/connector-catalog";
import {
  connectorCanConnect,
  getPublicMarketingConnectors,
  getPublicStatusBadge,
} from "@/lib/connector-presentation";

export function ConnectorCatalogList({
  entries = getPublicMarketingConnectors(),
  showDescriptions = true,
}: {
  entries?: ConnectorDefinition[];
  showDescriptions?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-purple-100 bg-purple-50/30 px-4 py-4 text-sm text-ink-muted">
        Self-serve Connect is not shown for in-progress integrations. Your project
        team will confirm sources in scope; connections appear here when operational
        for your account.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((item) => {
        const badge = getPublicStatusBadge(item);
        const canConnect = connectorCanConnect(item);
        return (
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
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {badge ? (
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-dark ring-1 ring-inset ring-purple-100">
                  {badge}
                </span>
              ) : null}
              {canConnect ? (
                <button
                  type="button"
                  className="rounded-lg bg-purple px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Connect
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
