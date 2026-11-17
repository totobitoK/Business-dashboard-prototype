"use client";

import type { ReactNode } from "react";
import { formatDashboardMoney } from "@/lib/format-chart-currency";
import type { CurrencyTotal, PipelineDealRow, PipelineView } from "@/lib/hubspot-pipeline";
import { isLightDashboardTheme, type LayoutCustomizeTheme } from "@/lib/layout-customize-themes";
import { formatCalendarDateDisplay } from "@/lib/workspace-reporting-period";
import { DashboardSelect } from "@/components/customer/dashboard-controls";

function money(amount: number, currency: string): string {
  return formatDashboardMoney(amount, currency);
}

function valueLine(values: CurrencyTotal[]): string {
  if (values.length === 0) return "No recorded value";
  return values.map((value) => money(value.amount, value.currency)).join(" · ");
}

function missingLine(count: number, noun: string): string | null {
  if (count <= 0) return null;
  const deal = count === 1 ? "deal" : "deals";
  const verb = count === 1 ? "is" : "are";
  return `${count} ${noun} ${deal} ${count === 1 ? "has" : "have"} no amount or currency and ${verb} excluded from the value.`;
}

function reported(value: string | null, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function DealDate({ deal }: { deal: PipelineDealRow }) {
  if (!deal.date) return <span>{deal.dateLabel} not set</span>;
  return (
    <span>
      {deal.dateLabel} {formatCalendarDateDisplay(deal.date)}
    </span>
  );
}

export function SalesPipelineCard({
  view,
  theme,
  action,
}: {
  view: PipelineView;
  theme: LayoutCustomizeTheme;
  action?: ReactNode;
}) {
  const rule = isLightDashboardTheme(theme.id) ? theme.detailPanelBorder : "border-white/10";
  return (
    <article className={`flex flex-col gap-3 p-4 ${theme.metricA}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ink">Sales pipeline</p>
          <p className="text-[11px] text-ink">
            HubSpot
            {view.sampleLabel ? ` · ${view.sampleLabel}` : ""}
            {view.syncLabel ? ` · Last sync ${view.syncLabel}` : ""}
          </p>
        </div>
        {action}
      </div>
      {view.message ? <p className="text-sm text-ink">{view.message}</p> : null}
      {view.showFigures ? (
        <>
          <div className={`flex flex-wrap items-end justify-between gap-3 border-t pt-3 ${rule}`}>
            <div>
              <p className={`text-2xl font-semibold tabular-nums leading-none ${theme.metricValueA}`}>
                {view.openCount}
              </p>
              <p className="mt-1 text-sm text-ink">Open deals</p>
            </div>
            <p className={`text-sm font-semibold tabular-nums ${theme.metricValueA}`}>{valueLine(view.openValue)}</p>
          </div>
          {missingLine(view.missingAmountCount, "open") ? (
            <p className="text-sm text-ink">{missingLine(view.missingAmountCount, "open")}</p>
          ) : null}
          {view.closingSoon.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {view.closingSoon.map((deal) => (
                <li key={deal.id} className="min-w-0 text-sm text-ink">
                  <span className="font-semibold">{deal.name}</span>
                  <span className="text-ink">
                    {" "}
                    · {deal.stage} · <DealDate deal={deal} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink">No open deals are waiting to close.</p>
          )}
        </>
      ) : null}
    </article>
  );
}

export function PipelineView({
  view,
  theme,
  rangeLabel,
  onPipelineChange,
}: {
  view: PipelineView;
  theme: LayoutCustomizeTheme;
  rangeLabel: string;
  onPipelineChange: (pipelineId: string | null) => void;
}) {
  const rule = isLightDashboardTheme(theme.id) ? theme.detailPanelBorder : "border-white/10";
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <section className={`flex flex-col gap-3 p-4 ${theme.sectionPanel}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Open pipeline</h2>
            <p className="text-sm text-ink">
              HubSpot
              {view.sampleLabel ? ` · ${view.sampleLabel}` : ""}
              {view.syncLabel ? ` · Last sync ${view.syncLabel}` : " · No successful sync yet"}
            </p>
          </div>
          {view.pipelineOptions.length > 1 ? (
            <DashboardSelect
              theme={theme}
              aria-label="Pipeline"
              value={view.selectedPipelineId ?? "all"}
              options={[
                { value: "all", label: "All pipelines" },
                ...view.pipelineOptions.map((pipeline) => ({
                  value: pipeline.id,
                  label: pipeline.label,
                })),
              ]}
              onChange={(value) => onPipelineChange(value === "all" ? null : value)}
            />
          ) : null}
        </div>
        {view.message ? <p className="text-sm text-ink">{view.message}</p> : null}
        {view.showFigures ? (
          <>
            <div className={`flex flex-wrap items-end justify-between gap-3 border-t pt-3 ${rule}`}>
              <p className="text-sm text-ink">
                <span className={`text-2xl font-semibold tabular-nums ${theme.metricValueA}`}>{view.openCount}</span>{" "}
                open deals
              </p>
              <p className={`text-sm font-semibold tabular-nums ${theme.metricValueA}`}>{valueLine(view.openValue)}</p>
            </div>
            {missingLine(view.missingAmountCount, "open") ? (
              <p className="text-sm text-ink">{missingLine(view.missingAmountCount, "open")}</p>
            ) : null}
            {view.stageRows.length > 0 ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {view.stageRows.map((stage) => (
                  <li key={stage.id} className={`rounded-xl px-3 py-2 ${theme.metricA}`}>
                    <p className="text-sm font-semibold text-ink">{stage.label}</p>
                    <p className="text-sm text-ink">
                      {stage.count} open · {valueLine(stage.values)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>

      {view.showFigures ? (
        <section className={`p-4 ${theme.sectionPanel}`}>
          <h2 className="text-sm font-semibold text-ink">Won in selected period</h2>
          <p className="text-sm text-ink">{rangeLabel}</p>
          <p className="mt-2 text-sm text-ink">
            <span className={`text-2xl font-semibold tabular-nums ${theme.metricValueA}`}>{view.wonCount}</span>{" "}
            closed won · {valueLine(view.wonValue)}
          </p>
          {missingLine(view.wonMissingAmountCount, "won") ? (
            <p className="mt-2 text-sm text-ink">{missingLine(view.wonMissingAmountCount, "won")}</p>
          ) : null}
        </section>
      ) : null}

      {view.showFigures ? (
        <section className={`p-4 ${theme.sectionPanel}`}>
          <h2 className="text-sm font-semibold text-ink">Deals</h2>
          {view.deals.length === 0 ? (
            <p className="mt-2 text-sm text-ink">No open deals, and none closed won in this period.</p>
          ) : (
            <ul className={`mt-2 divide-y ${rule}`}>
              {view.deals.map((deal) => (
                <li key={deal.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{deal.name}</p>
                    <p className="text-sm text-ink">
                      {reported(deal.company, "Company not reported")} · {reported(deal.owner, "Owner not reported")} ·{" "}
                      {deal.stage}
                    </p>
                    <p className="text-sm text-ink">
                      <DealDate deal={deal} />
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <p className={`text-sm font-semibold tabular-nums ${theme.metricValueA}`}>
                      {deal.amount == null
                        ? "No amount"
                        : deal.currency
                          ? money(deal.amount, deal.currency)
                          : "Currency not reported"}
                    </p>
                    {deal.url ? (
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`text-sm font-semibold ${theme.metricValueA} ${theme.linkAccentHover}`}
                      >
                        Open in HubSpot
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
