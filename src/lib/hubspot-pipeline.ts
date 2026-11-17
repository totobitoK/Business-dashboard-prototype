import type { ReportingDateRange } from "./workspace-reporting-period";
import { isDateInRange } from "./workspace-reporting-period";

export type DealStageKind = "open" | "closed_won" | "closed_lost";

export type HubSpotStage = {
  id: string;
  label: string;
  kind: DealStageKind;
  displayOrder: number;
};

export type HubSpotPipelineDef = {
  id: string;
  label: string;
  stages: HubSpotStage[];
};

/** A deal as stored for one RavenView company. Amounts are pipeline value, not cash. */
export type HubSpotDeal = {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  /** Null when the deal has no company association. */
  company: string | null;
  /** Null when HubSpot has no owner on the deal. */
  owner: string | null;
  /** Null when HubSpot has no amount. The deal still counts. */
  amount: number | null;
  /** Null when HubSpot has no currency. The amount is excluded from value totals. */
  currency: string | null;
  /** Company-local calendar day, YYYY-MM-DD. */
  expectedClose: string | null;
  /** Company-local calendar day the deal closed. */
  closeDate: string | null;
  url: string | null;
};

export type PipelineSyncState =
  | "ready"
  | "pending_first_sync"
  | "syncing"
  | "stale"
  | "failed"
  | "verified_empty";

export type PipelineRead = {
  state: PipelineSyncState;
  /** Set for demo records so they are not mistaken for a live HubSpot account. */
  sampleLabel: string | null;
  lastSuccessfulSyncAt: string | null;
  message: string | null;
  pipelines: HubSpotPipelineDef[];
  deals: HubSpotDeal[];
};

export type CurrencyTotal = {
  currency: string;
  amount: number;
  dealCount: number;
};

export type PipelineDealRow = {
  id: string;
  name: string;
  company: string | null;
  owner: string | null;
  stage: string;
  amount: number | null;
  currency: string | null;
  dateLabel: "Expected close" | "Close date";
  date: string | null;
  url: string | null;
};

export type PipelineStageRow = {
  id: string;
  label: string;
  count: number;
  missingAmountCount: number;
  values: CurrencyTotal[];
};

export type PipelineView = {
  state: PipelineSyncState;
  sampleLabel: string | null;
  syncLabel: string | null;
  message: string | null;
  showFigures: boolean;
  openCount: number;
  missingAmountCount: number;
  openValue: CurrencyTotal[];
  closingSoon: PipelineDealRow[];
  stageRows: PipelineStageRow[];
  pipelineOptions: { id: string; label: string }[];
  selectedPipelineId: string | null;
  wonCount: number;
  wonMissingAmountCount: number;
  wonValue: CurrencyTotal[];
  deals: PipelineDealRow[];
};

const EMPTY_VIEW_BASE = {
  openCount: 0,
  missingAmountCount: 0,
  openValue: [] as CurrencyTotal[],
  closingSoon: [] as PipelineDealRow[],
  stageRows: [] as PipelineStageRow[],
  wonCount: 0,
  wonMissingAmountCount: 0,
  wonValue: [] as CurrencyTotal[],
  deals: [] as PipelineDealRow[],
};

export function formatPipelineSync(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function stageFor(deal: HubSpotDeal, pipelines: HubSpotPipelineDef[]): HubSpotStage | null {
  const pipeline = pipelines.find((item) => item.id === deal.pipelineId);
  return pipeline?.stages.find((stage) => stage.id === deal.stageId) ?? null;
}

function addCurrency(groups: Map<string, CurrencyTotal>, currency: string, amount: number) {
  const code = currency.trim() || "USD";
  const current = groups.get(code) ?? { currency: code, amount: 0, dealCount: 0 };
  current.amount += amount;
  current.dealCount += 1;
  groups.set(code, current);
}

function currencyList(groups: Map<string, CurrencyTotal>): CurrencyTotal[] {
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

function toRow(
  deal: HubSpotDeal,
  stage: HubSpotStage | null,
  open: boolean
): PipelineDealRow {
  return {
    id: deal.id,
    name: deal.name,
    company: deal.company,
    owner: deal.owner,
    stage: stage?.label ?? "Unmapped stage",
    amount: deal.amount,
    currency: deal.currency,
    dateLabel: open ? "Expected close" : "Close date",
    date: open ? deal.expectedClose : deal.closeDate,
    url: deal.url,
  };
}

/**
 * Open pipeline is an as-of snapshot. Won deals use the HubSpot close date
 * inside the reporting range. The range dates are company-local calendar days.
 */
export function buildPipelineView(input: {
  read: PipelineRead;
  range: ReportingDateRange;
  timeZone: string;
  pipelineId?: string | null;
}): PipelineView {
  const { read, range, timeZone } = input;
  const selected = input.pipelineId ?? null;
  const syncLabel = formatPipelineSync(read.lastSuccessfulSyncAt, timeZone);
  const pipelineOptions = read.pipelines.map((pipeline) => ({
    id: pipeline.id,
    label: pipeline.label,
  }));
  const base = {
    state: read.state,
    sampleLabel: read.sampleLabel,
    syncLabel,
    pipelineOptions,
    selectedPipelineId: selected,
  };

  if (read.state === "pending_first_sync" || read.state === "syncing" || read.state === "failed") {
    return {
      ...base,
      ...EMPTY_VIEW_BASE,
      message:
        read.message ??
        (read.state === "failed"
          ? "HubSpot pipeline could not be loaded."
          : read.state === "syncing"
            ? "HubSpot pipeline is syncing."
            : "Waiting for the first HubSpot sync."),
      showFigures: false,
    };
  }

  const inPipeline = (deal: HubSpotDeal) => !selected || deal.pipelineId === selected;
  const openDeals: { deal: HubSpotDeal; stage: HubSpotStage }[] = [];
  const wonDeals: { deal: HubSpotDeal; stage: HubSpotStage }[] = [];

  for (const deal of read.deals) {
    if (!inPipeline(deal)) continue;
    const stage = stageFor(deal, read.pipelines);
    if (!stage) continue;
    if (stage.kind === "open") openDeals.push({ deal, stage });
    if (
      stage.kind === "closed_won" &&
      deal.closeDate &&
      isDateInRange(deal.closeDate, range)
    ) {
      wonDeals.push({ deal, stage });
    }
  }

  const openValue = new Map<string, CurrencyTotal>();
  let missingAmountCount = 0;
  for (const { deal } of openDeals) {
    if (deal.amount == null || !deal.currency) {
      missingAmountCount += 1;
      continue;
    }
    addCurrency(openValue, deal.currency, deal.amount);
  }

  const wonValue = new Map<string, CurrencyTotal>();
  let wonMissingAmountCount = 0;
  for (const { deal } of wonDeals) {
    if (deal.amount == null || !deal.currency) {
      wonMissingAmountCount += 1;
      continue;
    }
    addCurrency(wonValue, deal.currency, deal.amount);
  }

  const closingSoon = [...openDeals]
    .sort((a, b) => {
      if (a.deal.expectedClose === b.deal.expectedClose) {
        return a.deal.name.localeCompare(b.deal.name);
      }
      if (!a.deal.expectedClose) return 1;
      if (!b.deal.expectedClose) return -1;
      return a.deal.expectedClose < b.deal.expectedClose ? -1 : 1;
    })
    .slice(0, 2)
    .map(({ deal, stage }) => toRow(deal, stage, true));

  const stageRows: PipelineStageRow[] = [];
  const pipelines = selected
    ? read.pipelines.filter((pipeline) => pipeline.id === selected)
    : read.pipelines;
  for (const pipeline of pipelines) {
    const openStages = [...pipeline.stages]
      .filter((stage) => stage.kind === "open")
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
    for (const stage of openStages) {
      const matching = openDeals.filter(
        (item) => item.deal.pipelineId === pipeline.id && item.stage.id === stage.id
      );
      if (!selected && matching.length === 0) continue;
      const values = new Map<string, CurrencyTotal>();
      let missing = 0;
      for (const { deal } of matching) {
        if (deal.amount == null || !deal.currency) missing += 1;
        else addCurrency(values, deal.currency, deal.amount);
      }
      const prefix = selected || read.pipelines.length === 1 ? "" : `${pipeline.label} · `;
      stageRows.push({
        id: `${pipeline.id}:${stage.id}`,
        label: `${prefix}${stage.label}`,
        count: matching.length,
        missingAmountCount: missing,
        values: currencyList(values),
      });
    }
  }

  const deals = [
    ...openDeals.map(({ deal, stage }) => toRow(deal, stage, true)),
    ...wonDeals.map(({ deal, stage }) => toRow(deal, stage, false)),
  ].sort((a, b) => {
    if (a.date === b.date) return a.name.localeCompare(b.name);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  });

  const emptyMessage =
    read.state === "verified_empty" ? "HubSpot has no deals in this pipeline." : null;

  return {
    ...base,
    message: read.state === "stale" ? read.message ?? "This HubSpot read is stale." : emptyMessage,
    showFigures: true,
    openCount: openDeals.length,
    missingAmountCount,
    openValue: currencyList(openValue),
    closingSoon,
    stageRows,
    wonCount: wonDeals.length,
    wonMissingAmountCount,
    wonValue: currencyList(wonValue),
    deals,
  };
}

export function pendingPipelineRead(message?: string): PipelineRead {
  return {
    state: "pending_first_sync",
    sampleLabel: null,
    lastSuccessfulSyncAt: null,
    message: message ?? "Waiting for the first HubSpot sync.",
    pipelines: [],
    deals: [],
  };
}
