import type { ConnectorDefinition } from "@/lib/connector-catalog";
import {
  connectorCanConnect,
  getPublicMarketingConnectors,
  getPublicStatusBadge,
} from "@/lib/connector-presentation";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function ConnectorCatalogList({
  entries = getPublicMarketingConnectors(),
  showDescriptions = true,
}: {
  entries?: ConnectorDefinition[];
  showDescriptions?: boolean;
}) {
  const { theme } = useCustomerPortal();
  if (entries.length === 0) {
    return (
      <p className={`rounded-xl border px-4 py-4 text-sm text-ink-muted ${theme.detailPanelBorder} ${theme.badge}`}>
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
            className={`flex flex-col gap-3 rounded-xl border bg-white px-4 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between ${theme.detailPanelBorder}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{item.label}</p>
              {showDescriptions ? (
                <p className="mt-1 text-sm text-ink-muted">{item.shortDescription}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {badge ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-current/15 ${theme.badge} ${theme.metricValueA}`}>
                  {badge}
                </span>
              ) : null}
              {canConnect ? (
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${theme.navActive}`}
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
