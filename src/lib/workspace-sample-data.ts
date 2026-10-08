import {
  WORKSPACE_ALPINE_HVAC,
  WORKSPACE_MERIDIAN_RETAIL,
} from "./customer-workspaces";

export interface SampleInvoice {
  id: string;
  customer: string;
  dueDate: string;
  amount: number;
  status: "Open" | "Past due" | "Paid";
}

export interface SampleAppointment {
  id: string;
  date: string;
  time: string;
  title: string;
}

export interface WorkspaceSampleData {
  periodLabel: string;
  paymentsReceived: number;
  outstandingInvoices: number;
  upcomingAppointments: number;
  trend: { label: string; amount: number }[];
  invoices: SampleInvoice[];
  appointments: SampleAppointment[];
}

const alpineHvac: WorkspaceSampleData = {
  periodLabel: "Month to date",
  paymentsReceived: 48250,
  outstandingInvoices: 12840,
  upcomingAppointments: 7,
  trend: [
    { label: "Aug", amount: 38200 },
    { label: "Sep", amount: 42100 },
    { label: "Oct", amount: 46800 },
    { label: "Nov", amount: 44200 },
    { label: "Dec", amount: 43900 },
    { label: "Jan", amount: 46100 },
    { label: "Feb", amount: 48250 },
  ],
  invoices: [
    {
      id: "inv-1",
      customer: "Garcia residence",
      dueDate: "Mar 14",
      amount: 2840,
      status: "Open",
    },
    {
      id: "inv-2",
      customer: "Northside Office Park",
      dueDate: "Mar 10",
      amount: 4200,
      status: "Past due",
    },
    {
      id: "inv-3",
      customer: "Kim household",
      dueDate: "Mar 18",
      amount: 1650,
      status: "Open",
    },
    {
      id: "inv-4",
      customer: "Riverside Retail",
      dueDate: "Mar 8",
      amount: 4150,
      status: "Past due",
    },
  ],
  appointments: [
    {
      id: "appt-1",
      date: "Wed, Mar 12",
      time: "8:00 AM",
      title: "Seasonal maintenance — Garcia residence",
    },
    {
      id: "appt-2",
      date: "Wed, Mar 12",
      time: "11:30 AM",
      title: "Estimate — Northside Office Park",
    },
    {
      id: "appt-3",
      date: "Thu, Mar 13",
      time: "9:15 AM",
      title: "Service call — Kim household",
    },
  ],
};

const meridianRetail: WorkspaceSampleData = {
  periodLabel: "This week",
  paymentsReceived: 28400,
  outstandingInvoices: 6200,
  upcomingAppointments: 4,
  trend: [
    { label: "W1", amount: 18200 },
    { label: "W2", amount: 21400 },
    { label: "W3", amount: 24800 },
    { label: "W4", amount: 26100 },
    { label: "W5", amount: 27200 },
    { label: "W6", amount: 27800 },
    { label: "W7", amount: 28400 },
  ],
  invoices: [
    {
      id: "inv-m1",
      customer: "Wholesale — Austin",
      dueDate: "Mar 15",
      amount: 3200,
      status: "Open",
    },
    {
      id: "inv-m2",
      customer: "Pop-up market booth",
      dueDate: "Mar 11",
      amount: 3000,
      status: "Past due",
    },
  ],
  appointments: [
    {
      id: "appt-m1",
      date: "Thu, Mar 13",
      time: "10:00 AM",
      title: "Vendor line review — Sheets sync",
    },
    {
      id: "appt-m2",
      date: "Fri, Mar 14",
      time: "2:00 PM",
      title: "HubSpot pipeline walkthrough",
    },
  ],
};

const BY_WORKSPACE: Record<string, WorkspaceSampleData> = {
  [WORKSPACE_ALPINE_HVAC]: alpineHvac,
  [WORKSPACE_MERIDIAN_RETAIL]: meridianRetail,
};

export function getWorkspaceSampleData(workspaceId: string): WorkspaceSampleData {
  return BY_WORKSPACE[workspaceId] ?? alpineHvac;
}
