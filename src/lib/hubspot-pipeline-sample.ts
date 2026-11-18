import { normalizeHubSpotCrm, type HubSpotCrmPayload } from "./hubspot-crm";
import type { PipelineRead } from "./hubspot-pipeline";

/**
 * HubSpot-shaped records for the demo. Metrics are not stored here.
 * `demoPipelineRead` runs them through the same normalizer as a live account.
 * Close timestamps are instants. The company time zone decides the calendar day.
 */
export const DEMO_HUBSPOT_CRM: HubSpotCrmPayload = {
  portalId: "24490123",
  pipelines: [
    {
      id: "default",
      label: "Sales Pipeline",
      displayOrder: 0,
      stages: [
        {
          id: "appointmentscheduled",
          label: "Appointment Scheduled",
          displayOrder: 0,
          metadata: { isClosed: "false", probability: "0.2" },
        },
        {
          id: "presentationscheduled",
          label: "Presentation Scheduled",
          displayOrder: 1,
          metadata: { isClosed: "false", probability: "0.6" },
        },
        {
          id: "closedwon",
          label: "Closed Won",
          displayOrder: 2,
          metadata: { isClosed: "true", probability: "1.0" },
        },
        {
          id: "closedlost",
          label: "Closed Lost",
          displayOrder: 3,
          metadata: { isClosed: "true", probability: "0.0" },
        },
      ],
    },
    {
      id: "81234567",
      label: "Enterprise",
      displayOrder: 1,
      stages: [
        {
          id: "1268071801",
          label: "Security review",
          displayOrder: 0,
          metadata: { isClosed: "false", probability: "0.4" },
        },
        {
          id: "1268071802",
          label: "Closed Won",
          displayOrder: 1,
          metadata: { isClosed: "true", probability: "1.0" },
        },
      ],
    },
  ],
  owners: [
    { id: "501", firstName: "Avery", lastName: "Chen", email: "avery@meridian.example" },
    { id: "503", firstName: null, lastName: null, email: "ops@meridian.example" },
  ],
  companies: [
    { id: "901", properties: { name: "Lumen Retail" } },
    { id: "902", properties: { name: "Northwind" } },
    { id: "903", properties: { name: "Online orders" } },
    { id: "904", properties: { name: "Denver boutique" } },
    { id: "905", properties: { name: "Plaza Office" } },
    { id: "906", properties: { name: "Harbor Industrial" } },
    { id: "907", properties: { name: "Meridian account 21" } },
    { id: "908", properties: { name: "Meridian account 4" } },
  ],
  deals: [
    {
      id: "1601",
      properties: {
        dealname: "Lumen kiosk",
        amount: "8400",
        deal_currency_code: "USD",
        dealstage: "appointmentscheduled",
        pipeline: "default",
        closedate: "2026-03-14T18:00:00.000Z",
        hubspot_owner_id: "501",
      },
      associations: { companies: { results: [{ id: "901", type: "deal_to_company" }] } },
    },
    {
      id: "1602",
      properties: {
        dealname: "Northwind restock",
        amount: "12000",
        deal_currency_code: "USD",
        dealstage: "presentationscheduled",
        pipeline: "default",
        closedate: "2026-03-18T18:00:00.000Z",
        hubspot_owner_id: "501",
      },
      associations: { companies: { results: [{ id: "902", type: "deal_to_company" }] } },
    },
    {
      id: "1604",
      properties: {
        dealname: "Unpriced renewal",
        amount: "",
        deal_currency_code: "USD",
        dealstage: "appointmentscheduled",
        pipeline: "default",
        closedate: "2026-03-16T18:00:00.000Z",
        hubspot_owner_id: "501",
      },
      associations: { companies: { results: [{ id: "907", type: "deal_to_company" }] } },
    },
    {
      id: "1605",
      properties: {
        dealname: "March wholesale",
        amount: "3054",
        deal_currency_code: "USD",
        dealstage: "closedwon",
        pipeline: "default",
        closedate: "2026-03-05T19:00:00.000Z",
        hubspot_owner_id: "501",
      },
      associations: { companies: { results: [{ id: "903", type: "deal_to_company" }] } },
    },
    {
      id: "1606",
      properties: {
        dealname: "February booth",
        amount: "2200",
        deal_currency_code: "USD",
        dealstage: "closedwon",
        pipeline: "default",
        closedate: "2026-02-20T19:00:00.000Z",
        hubspot_owner_id: "503",
      },
      associations: { companies: { results: [{ id: "904", type: "deal_to_company" }] } },
    },
    {
      id: "1607",
      properties: {
        dealname: "Lost lead",
        amount: "900",
        deal_currency_code: "USD",
        dealstage: "closedlost",
        pipeline: "default",
        closedate: "2026-03-02T19:00:00.000Z",
        hubspot_owner_id: "503",
      },
      associations: { companies: { results: [{ id: "905", type: "deal_to_company" }] } },
    },
    {
      id: "1608",
      properties: {
        dealname: "Harbor security review",
        amount: "15000",
        deal_currency_code: "USD",
        dealstage: "1268071801",
        pipeline: "81234567",
        closedate: null,
        hubspot_owner_id: null,
      },
      associations: { companies: { results: [{ id: "906", type: "deal_to_company" }] } },
    },
    {
      id: "1609",
      properties: {
        dealname: "Enterprise close",
        amount: "4000",
        deal_currency_code: "USD",
        dealstage: "1268071802",
        pipeline: "81234567",
        closedate: "2026-03-11T18:00:00.000Z",
        hubspot_owner_id: "503",
      },
      associations: { companies: { results: [{ id: "906", type: "deal_to_company" }] } },
    },
    {
      id: "1610",
      properties: {
        dealname: "Won without amount",
        amount: null,
        deal_currency_code: null,
        dealstage: "closedwon",
        pipeline: "default",
        closedate: "2026-03-08T18:00:00.000Z",
        hubspot_owner_id: "501",
      },
      associations: { companies: { results: [{ id: "908", type: "deal_to_company" }] } },
    },
  ],
};

export function demoPipelineRead(timeZone: string): PipelineRead {
  return normalizeHubSpotCrm({
    payload: DEMO_HUBSPOT_CRM,
    timeZone,
    state: "ready",
    sampleLabel: "Sample",
    lastSuccessfulSyncAt: "2026-03-12T15:00:00.000Z",
    message: null,
  });
}

/** Normalized sample used by tests and the appearance preview. Company zone is Denver. */
export const SAMPLE_PIPELINE_READ: PipelineRead = demoPipelineRead("America/Denver");
