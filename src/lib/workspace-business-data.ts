import {
  WORKSPACE_ALPINE_HVAC,
  WORKSPACE_MERIDIAN_RETAIL,
} from "./customer-workspaces";

export const DEMO_AS_OF_DATE = "2026-03-12";

export type ReportingPeriodKey = "mtd" | "last30" | "last7";

export interface BusinessPayment {
  id: string;
  date: string;
  amount: number;
  customer: string;
  sourceLabel: string;
}

export interface BusinessInvoice {
  id: string;
  customer: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: "Open" | "Past due" | "Paid";
  lineSummary: string;
  sourceLabel: string;
}

export interface BusinessAppointment {
  id: string;
  startAt: string;
  title: string;
  location: string;
  assignee: string;
  sourceLabel: string;
}

export interface WorkspaceBusinessData {
  workspaceId: string;
  demoAsOf: string;
  payments: BusinessPayment[];
  invoices: BusinessInvoice[];
  appointments: BusinessAppointment[];
}

const alpine: WorkspaceBusinessData = {
  workspaceId: WORKSPACE_ALPINE_HVAC,
  demoAsOf: DEMO_AS_OF_DATE,
  payments: [
    { id: "pay-a1", date: "2026-03-01", amount: 8200, customer: "Garcia residence", sourceLabel: "QuickBooks Online" },
    { id: "pay-a2", date: "2026-03-04", amount: 12400, customer: "Northside Office Park", sourceLabel: "QuickBooks Online" },
    { id: "pay-a3", date: "2026-03-08", amount: 9650, customer: "Kim household", sourceLabel: "QuickBooks Online" },
    { id: "pay-a4", date: "2026-03-11", amount: 11000, customer: "Riverside Retail", sourceLabel: "QuickBooks Online" },
    { id: "pay-a5", date: "2026-02-15", amount: 4200, customer: "Prior month", sourceLabel: "QuickBooks Online" },
  ],
  invoices: [
    {
      id: "inv-1",
      customer: "Garcia residence",
      issueDate: "2026-03-01",
      dueDate: "2026-03-14",
      amount: 2840,
      balanceDue: 2840,
      status: "Open",
      lineSummary: "Seasonal maintenance invoice",
      sourceLabel: "QuickBooks Online",
    },
    {
      id: "inv-2",
      customer: "Northside Office Park",
      issueDate: "2026-02-20",
      dueDate: "2026-03-10",
      amount: 4200,
      balanceDue: 4200,
      status: "Past due",
      lineSummary: "Commercial service contract",
      sourceLabel: "QuickBooks Online",
    },
    {
      id: "inv-3",
      customer: "Kim household",
      issueDate: "2026-03-05",
      dueDate: "2026-03-18",
      amount: 1650,
      balanceDue: 1650,
      status: "Open",
      lineSummary: "Diagnostic visit",
      sourceLabel: "QuickBooks Online",
    },
    {
      id: "inv-4",
      customer: "Riverside Retail",
      issueDate: "2026-02-18",
      dueDate: "2026-03-08",
      amount: 4150,
      balanceDue: 4150,
      status: "Past due",
      lineSummary: "RTU repair",
      sourceLabel: "QuickBooks Online",
    },
  ],
  appointments: [
    {
      id: "appt-1",
      startAt: "2026-03-12T08:00:00",
      title: "Seasonal maintenance — Garcia residence",
      location: "124 Oak St",
      assignee: "Tech team A",
      sourceLabel: "Google Calendar",
    },
    {
      id: "appt-2",
      startAt: "2026-03-12T11:30:00",
      title: "Estimate — Northside Office Park",
      location: "900 Business Pkwy",
      assignee: "Jordan Ellis",
      sourceLabel: "Google Calendar",
    },
    {
      id: "appt-3",
      startAt: "2026-03-13T09:15:00",
      title: "Service call — Kim household",
      location: "88 Pine Rd",
      assignee: "Tech team B",
      sourceLabel: "Google Calendar",
    },
    {
      id: "appt-4",
      startAt: "2026-03-14T13:00:00",
      title: "Follow-up — Riverside Retail",
      location: "220 River Walk",
      assignee: "Tech team A",
      sourceLabel: "Google Calendar",
    },
  ],
};

const meridian: WorkspaceBusinessData = {
  workspaceId: WORKSPACE_MERIDIAN_RETAIL,
  demoAsOf: DEMO_AS_OF_DATE,
  payments: [
    { id: "pay-m1", date: "2026-03-10", amount: 9200, customer: "Austin wholesale", sourceLabel: "Google Sheets" },
    { id: "pay-m2", date: "2026-03-11", amount: 6800, customer: "In-store POS", sourceLabel: "Google Sheets" },
    { id: "pay-m3", date: "2026-03-12", amount: 5400, customer: "Online orders", sourceLabel: "Google Sheets" },
  ],
  invoices: [
    {
      id: "inv-m1",
      customer: "Wholesale — Austin",
      issueDate: "2026-03-01",
      dueDate: "2026-03-15",
      amount: 3200,
      balanceDue: 3200,
      status: "Open",
      lineSummary: "March restock order",
      sourceLabel: "Google Sheets",
    },
    {
      id: "inv-m2",
      customer: "Pop-up market booth",
      issueDate: "2026-02-28",
      dueDate: "2026-03-11",
      amount: 3000,
      balanceDue: 3000,
      status: "Past due",
      lineSummary: "Event booth fees",
      sourceLabel: "Google Sheets",
    },
  ],
  appointments: [
    {
      id: "appt-m1",
      startAt: "2026-03-13T10:00:00",
      title: "Vendor line review — Sheets sync",
      location: "Meridian HQ",
      assignee: "Avery Chen",
      sourceLabel: "HubSpot",
    },
    {
      id: "appt-m2",
      startAt: "2026-03-14T14:00:00",
      title: "HubSpot pipeline walkthrough",
      location: "Zoom",
      assignee: "Marketing lead",
      sourceLabel: "HubSpot",
    },
  ],
};

const BY_ID: Record<string, WorkspaceBusinessData> = {
  [WORKSPACE_ALPINE_HVAC]: alpine,
  [WORKSPACE_MERIDIAN_RETAIL]: meridian,
};

export function getWorkspaceBusinessData(
  workspaceId: string
): WorkspaceBusinessData | undefined {
  return BY_ID[workspaceId];
}
