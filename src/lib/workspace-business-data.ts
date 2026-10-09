import {
  WORKSPACE_ALPINE_HVAC,
  WORKSPACE_MERIDIAN_RETAIL,
} from "./customer-workspaces";
import { DEMO_AS_OF_DATE } from "./workspace-demo-date";
import {
  buildAlpineHvacDataset,
  buildMeridianRetailDataset,
} from "./workspace-sample-data-build";

export { DEMO_AS_OF_DATE };

/** @deprecated Use ReportingPeriodPreset from workspace-reporting-period */
export type ReportingPeriodKey = "mtd" | "last30" | "last7";

export interface BusinessCustomer {
  id: string;
  name: string;
}

export interface BusinessPayment {
  id: string;
  date: string;
  amount: number;
  customerId: string;
  customer: string;
  invoiceId?: string;
  invoiceNumber?: string;
  sourceLabel: string;
}

export interface BusinessInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: "Open" | "Past due" | "Paid";
  lineSummary: string;
  sourceLabel: string;
}

export type BusinessJobStatus = "completed" | "scheduled" | "canceled" | "in_progress";

export interface BusinessJob {
  id: string;
  customerId: string;
  customer: string;
  serviceType: string;
  category: string;
  assignee: string;
  scheduledDate: string;
  /** Local demo datetime for list display (ISO with time). */
  scheduledAt: string;
  amount: number;
  completedDate?: string;
  status: BusinessJobStatus;
}

export interface BusinessAppointment {
  id: string;
  startAt: string;
  title: string;
  location: string;
  assignee: string;
  status: "scheduled" | "canceled";
  sourceLabel: string;
}

export interface WorkspaceBusinessData {
  workspaceId: string;
  demoAsOf: string;
  customers: BusinessCustomer[];
  jobs: BusinessJob[];
  payments: BusinessPayment[];
  invoices: BusinessInvoice[];
  appointments: BusinessAppointment[];
}

const alpine = buildAlpineHvacDataset();
const meridian = buildMeridianRetailDataset();

const BY_ID: Record<string, WorkspaceBusinessData> = {
  [WORKSPACE_ALPINE_HVAC]: alpine,
  [WORKSPACE_MERIDIAN_RETAIL]: meridian,
};

export function getWorkspaceBusinessData(
  workspaceId: string
): WorkspaceBusinessData | undefined {
  return BY_ID[workspaceId];
}
