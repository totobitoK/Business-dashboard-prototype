import type { HubSpotDeal, HubSpotPipelineDef, HubSpotStage, PipelineRead, PipelineSyncState } from "./hubspot-pipeline";

/** HubSpot CRM pipeline, as returned by the pipelines API. */
export type HubSpotPipelineRecord = {
  id: string;
  label: string;
  displayOrder: number;
  stages: HubSpotStageRecord[];
};

export type HubSpotStageRecord = {
  id: string;
  label: string;
  displayOrder: number;
  metadata: {
    isClosed: string;
    probability: string;
  };
};

/** HubSpot CRM deal, as returned by the deals API. */
export type HubSpotDealRecord = {
  id: string;
  properties: {
    dealname?: string | null;
    amount?: string | null;
    deal_currency_code?: string | null;
    dealstage?: string | null;
    pipeline?: string | null;
    closedate?: string | null;
    hubspot_owner_id?: string | null;
  };
  associations?: {
    companies?: { results: { id: string; type: string }[] };
  };
};

export type HubSpotOwnerRecord = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type HubSpotCompanyRecord = {
  id: string;
  properties: { name?: string | null };
};

/** One account's pipelines, deals, owners, and companies. Demo and live use this shape. */
export type HubSpotCrmPayload = {
  portalId: string | null;
  pipelines: HubSpotPipelineRecord[];
  deals: HubSpotDealRecord[];
  owners: HubSpotOwnerRecord[];
  companies: HubSpotCompanyRecord[];
};

export function companyCalendarDay(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function stageKind(stage: HubSpotStageRecord): HubSpotStage["kind"] {
  const closed = stage.metadata.isClosed.trim().toLowerCase() === "true";
  if (!closed) return "open";
  const probability = Number(stage.metadata.probability);
  return probability >= 1 ? "closed_won" : "closed_lost";
}

function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount)) return null;
  return amount;
}

function ownerName(owner: HubSpotOwnerRecord | undefined): string | null {
  if (!owner) return null;
  const name = [owner.firstName, owner.lastName].filter((part) => part && part.trim()).join(" ");
  if (name) return name;
  const email = owner.email?.trim();
  return email || null;
}

function dealUrl(portalId: string | null, dealId: string): string | null {
  if (!portalId?.trim()) return null;
  return `https://app.hubspot.com/contacts/${portalId.trim()}/record/0-3/${dealId}`;
}

/**
 * Turns a HubSpot CRM payload into the deal model the dashboard calculates from.
 * Demo fixtures and a live account read both call this.
 */
export function normalizeHubSpotCrm(input: {
  payload: HubSpotCrmPayload;
  timeZone: string;
  state: PipelineSyncState;
  sampleLabel: string | null;
  lastSuccessfulSyncAt: string | null;
  message: string | null;
}): PipelineRead {
  const owners = new Map(input.payload.owners.map((owner) => [owner.id, owner]));
  const companies = new Map(input.payload.companies.map((company) => [company.id, company]));
  const pipelines: HubSpotPipelineDef[] = [...input.payload.pipelines]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
    .map((pipeline) => ({
      id: pipeline.id,
      label: pipeline.label,
      stages: [...pipeline.stages]
        .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
        .map((stage) => ({
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          kind: stageKind(stage),
        })),
    }));
  const stageByKey = new Map<string, HubSpotStage>();
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) stageByKey.set(`${pipeline.id}:${stage.id}`, stage);
  }

  const deals: HubSpotDeal[] = input.payload.deals.map((record) => {
    const properties = record.properties;
    const pipelineId = properties.pipeline?.trim() || "";
    const stageId = properties.dealstage?.trim() || "";
    const stage = stageByKey.get(`${pipelineId}:${stageId}`) ?? null;
    const open = stage?.kind === "open";
    const day = properties.closedate ? companyCalendarDay(properties.closedate, input.timeZone) : null;
    const companyId = record.associations?.companies?.results[0]?.id;
    const companyName = companyId ? companies.get(companyId)?.properties.name?.trim() : "";
    const currency = properties.deal_currency_code?.trim() || null;
    return {
      id: record.id,
      name: properties.dealname?.trim() || "Untitled deal",
      pipelineId,
      stageId,
      company: companyName || null,
      owner: ownerName(properties.hubspot_owner_id ? owners.get(properties.hubspot_owner_id) : undefined),
      amount: parseAmount(properties.amount),
      currency,
      expectedClose: open ? day : null,
      closeDate: open ? null : day,
      url: dealUrl(input.payload.portalId, record.id),
    };
  });

  return {
    state: input.state,
    sampleLabel: input.sampleLabel,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    message: input.message,
    pipelines,
    deals,
  };
}

/** Live account read. A missing payload stays on the sync state and does not use demo deals. */
export function livePipelineRead(input: {
  payload: HubSpotCrmPayload | null;
  timeZone: string;
  state: PipelineSyncState;
  lastSuccessfulSyncAt: string | null;
  message: string | null;
}): PipelineRead {
  if (!input.payload || input.state === "pending_first_sync" || input.state === "syncing" || input.state === "failed") {
    return {
      state: input.state,
      sampleLabel: null,
      lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
      message: input.message,
      pipelines: [],
      deals: [],
    };
  }
  return normalizeHubSpotCrm({
    payload: input.payload,
    timeZone: input.timeZone,
    state: input.state,
    sampleLabel: null,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    message: input.message,
  });
}
