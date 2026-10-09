import {
  WORKSPACE_ALPINE_HVAC,
  WORKSPACE_MERIDIAN_RETAIL,
} from "./customer-workspaces";
import { DEMO_AS_OF_DATE } from "./workspace-demo-date";
import type {
  BusinessAppointment,
  BusinessCustomer,
  BusinessInvoice,
  BusinessJob,
  BusinessPayment,
  WorkspaceBusinessData,
} from "./workspace-business-data";

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

const ALPINE_TECHS = ["Jordan Ellis", "Tech team A", "Tech team B", "Maria Santos", "Chris Webb"];
const ALPINE_SERVICES = [
  { type: "Seasonal maintenance", category: "Maintenance" },
  { type: "AC repair", category: "Repair" },
  { type: "Furnace diagnostic", category: "Diagnostic" },
  { type: "Ductless install", category: "Install" },
  { type: "Thermostat upgrade", category: "Install" },
  { type: "Emergency no-cool", category: "Repair" },
];

const MERIDIAN_CHANNELS = [
  { type: "Wholesale restock", category: "Wholesale" },
  { type: "Shopify fulfillment", category: "E-commerce" },
  { type: "POS daily close", category: "In-store" },
  { type: "Pop-up market", category: "Events" },
  { type: "Vendor co-op", category: "Wholesale" },
];

export function buildAlpineHvacDataset(): WorkspaceBusinessData {
  const rand = mulberry32(42);
  const customers: BusinessCustomer[] = [];
  for (let i = 1; i <= 34; i++) {
    customers.push({
      id: `alp-cust-${i}`,
      name:
        i <= 8
          ? ["Garcia residence", "Northside Office Park", "Kim household", "Riverside Retail", "Summit Medical", "Boulder Commons", "Flatiron Lofts", "Peak Fitness"][i - 1]!
          : `Alpine customer ${i}`,
    });
  }

  const jobs: BusinessJob[] = [];
  let jobSeq = 0;
  const start = new Date("2025-09-01T12:00:00Z");
  const asOf = new Date(`${DEMO_AS_OF_DATE}T12:00:00Z`);

  for (let dayOffset = 0; dayOffset <= 220; dayOffset++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    if (d > asOf && rand() > 0.15) continue;
    const dateIso = d.toISOString().slice(0, 10);
    const jobsToday = d <= asOf ? int(rand, 0, 2) : int(rand, 0, 1);
    for (let j = 0; j < jobsToday; j++) {
      jobSeq++;
      const cust = pick(rand, customers);
      const svc = pick(rand, ALPINE_SERVICES);
      const roll = rand();
      let status: BusinessJob["status"] = "completed";
      let completedDate: string | undefined = dateIso;
      if (d > asOf) {
        status = roll < 0.12 ? "canceled" : "scheduled";
        completedDate = undefined;
      } else if (roll < 0.08) {
        status = "canceled";
        completedDate = undefined;
      } else if (roll < 0.12 && dateIso === DEMO_AS_OF_DATE) {
        status = "in_progress";
        completedDate = undefined;
      }
      const slotHour = 7 + (j * 2 + jobSeq) % 9;
      jobs.push({
        id: `alp-job-${jobSeq}`,
        customerId: cust.id,
        customer: cust.name,
        serviceType: svc.type,
        category: svc.category,
        assignee: pick(rand, ALPINE_TECHS),
        scheduledDate: dateIso,
        scheduledAt: `${dateIso}T${String(slotHour).padStart(2, "0")}:00:00`,
        amount: int(rand, 225, 4850),
        completedDate,
        status,
      });
    }
  }

  const invoices: BusinessInvoice[] = [];
  const payments: BusinessPayment[] = [];
  let invSeq = 0;
  let paySeq = 0;

  for (let m = 0; m < 7; m++) {
    const month = 9 + m;
    const year = month > 12 ? 2026 : 2025;
    const calMonth = month > 12 ? month - 12 : month;
    const count = int(rand, 8, 12);
    for (let i = 0; i < count; i++) {
      invSeq++;
      const cust = pick(rand, customers);
      const issueDay = int(rand, 1, 26);
      const issueDate = `${year}-${String(calMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`;
      if (issueDate > DEMO_AS_OF_DATE) continue;
      const dueDate = addDays(issueDate, int(rand, 10, 30));
      const amount = int(rand, 450, 6200);
      const invId = `alp-inv-${invSeq}`;
      const invNum = `INV-A${1000 + invSeq}`;

      let paid = 0;
      const payRoll = rand();
      if (payRoll > 0.25 && issueDate <= DEMO_AS_OF_DATE) {
        const payCount = payRoll > 0.85 ? 2 : 1;
        for (let p = 0; p < payCount; p++) {
          paySeq++;
          const portion =
            p === payCount - 1
              ? payRoll > 0.92
                ? amount
                : Math.round(amount * (0.35 + rand() * 0.5))
              : Math.round(amount * (0.25 + rand() * 0.35));
          const payAmount = Math.min(portion, amount - paid);
          if (payAmount <= 0) break;
          paid += payAmount;
          const payDate = addDays(issueDate, int(rand, 3, 40));
          if (payDate > DEMO_AS_OF_DATE) continue;
          payments.push({
            id: `alp-pay-${paySeq}`,
            date: payDate,
            amount: payAmount,
            customerId: cust.id,
            customer: cust.name,
            invoiceId: invId,
            invoiceNumber: invNum,
            sourceLabel: "QuickBooks Online",
          });
        }
      }

      const balanceDue = Math.max(0, amount - paid);
      let status: BusinessInvoice["status"] = "Paid";
      if (balanceDue > 0) {
        status = compareDates(dueDate, DEMO_AS_OF_DATE) < 0 ? "Past due" : "Open";
      }

      invoices.push({
        id: invId,
        invoiceNumber: invNum,
        customerId: cust.id,
        customer: cust.name,
        issueDate,
        dueDate,
        amount,
        balanceDue,
        status,
        lineSummary: `${pick(rand, ALPINE_SERVICES).type} — ${cust.name}`,
        sourceLabel: "QuickBooks Online",
      });
    }
  }

  // Future-dated payment (must not affect historical KPIs)
  payments.push({
    id: "alp-pay-future",
    date: addDays(DEMO_AS_OF_DATE, 5),
    amount: 1200,
    customerId: customers[0]!.id,
    customer: customers[0]!.name,
    invoiceId: invoices[0]?.id,
    invoiceNumber: invoices[0]?.invoiceNumber,
    sourceLabel: "QuickBooks Online",
  });

  const appointments: BusinessAppointment[] = [];
  const apptTitles = [
    "Seasonal maintenance",
    "Estimate walkthrough",
    "Service call",
    "Follow-up visit",
    "Install kickoff",
  ];
  for (let day = 0; day <= 10; day++) {
    const iso = addDays(DEMO_AS_OF_DATE, day);
    const inNextWeek = day <= 7;
    const count = inNextWeek
      ? day === 0
        ? 2
        : int(rand, 0, 2)
      : int(rand, 0, 1);
    for (let a = 0; a < count; a++) {
      const hour = 8 + a * 3;
      appointments.push({
        id: `alp-appt-${day}-${a}`,
        startAt: `${iso}T${String(hour).padStart(2, "0")}:00:00`,
        title: `${pick(rand, apptTitles)} — ${pick(rand, customers).name}`,
        location: `${100 + int(rand, 1, 899)} ${pick(rand, ["Oak St", "Pine Rd", "Business Pkwy", "River Walk"])}`,
        assignee: pick(rand, ALPINE_TECHS),
        status: day === 5 && a === 0 ? "canceled" : "scheduled",
        sourceLabel: "Google Calendar",
      });
    }
  }

  return {
    workspaceId: WORKSPACE_ALPINE_HVAC,
    demoAsOf: DEMO_AS_OF_DATE,
    customers,
    jobs,
    invoices,
    payments,
    appointments,
  };
}

export function buildMeridianRetailDataset(): WorkspaceBusinessData {
  const rand = mulberry32(99);
  const customers: BusinessCustomer[] = [];
  for (let i = 1; i <= 28; i++) {
    customers.push({
      id: `mer-cust-${i}`,
      name:
        i <= 6
          ? [
              "Wholesale — Austin",
              "Pop-up market booth",
              "Online orders",
              "In-store POS",
              "Denver boutique",
              "Corporate gifting",
            ][i - 1]!
          : `Meridian account ${i}`,
    });
  }

  const jobs: BusinessJob[] = [];
  let jobSeq = 0;
  for (let dayOffset = 0; dayOffset <= 200; dayOffset++) {
    const d = new Date("2025-09-01T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const dateIso = d.toISOString().slice(0, 10);
    if (dateIso > DEMO_AS_OF_DATE && rand() > 0.2) continue;
    const n = dateIso <= DEMO_AS_OF_DATE ? int(rand, 0, 3) : int(rand, 0, 1);
    for (let j = 0; j < n; j++) {
      jobSeq++;
      const cust = pick(rand, customers);
      const ch = pick(rand, MERIDIAN_CHANNELS);
      const status: BusinessJob["status"] =
        dateIso > DEMO_AS_OF_DATE
          ? "scheduled"
          : rand() < 0.07
            ? "canceled"
            : "completed";
      const slotHour = 9 + (j + jobSeq) % 8;
      jobs.push({
        id: `mer-job-${jobSeq}`,
        customerId: cust.id,
        customer: cust.name,
        serviceType: ch.type,
        category: ch.category,
        assignee: pick(rand, ["Avery Chen", "Ops lead", "Store manager", "Fulfillment"]),
        scheduledDate: dateIso,
        scheduledAt: `${dateIso}T${String(slotHour).padStart(2, "0")}:30:00`,
        amount: int(rand, 350, 6200),
        completedDate: status === "completed" ? dateIso : undefined,
        status,
      });
    }
  }

  const invoices: BusinessInvoice[] = [];
  const payments: BusinessPayment[] = [];
  let invSeq = 0;
  let paySeq = 0;

  for (let m = 0; m < 6; m++) {
    const month = 10 + m;
    const year = month > 12 ? 2026 : 2025;
    const calMonth = month > 12 ? month - 12 : month;
    for (let i = 0; i < int(rand, 6, 10); i++) {
      invSeq++;
      const cust = pick(rand, customers);
      const issueDay = int(rand, 1, 24);
      const issueDate = `${year}-${String(calMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`;
      if (issueDate > DEMO_AS_OF_DATE) continue;
      const amount = int(rand, 800, 4800);
      const invId = `mer-inv-${invSeq}`;
      const invNum = `INV-M${2000 + invSeq}`;
      const dueDate = addDays(issueDate, int(rand, 7, 21));
      let paid = rand() > 0.35 ? amount : Math.round(amount * rand());
      if (paid > amount) paid = amount;
      if (paid > 0) {
        paySeq++;
        payments.push({
          id: `mer-pay-${paySeq}`,
          date: addDays(issueDate, int(rand, 1, 18)),
          amount: paid,
          customerId: cust.id,
          customer: cust.name,
          invoiceId: invId,
          invoiceNumber: invNum,
          sourceLabel: "Google Sheets",
        });
      }
      const balanceDue = amount - paid;
      invoices.push({
        id: invId,
        invoiceNumber: invNum,
        customerId: cust.id,
        customer: cust.name,
        issueDate,
        dueDate,
        amount,
        balanceDue,
        status: balanceDue <= 0 ? "Paid" : compareDates(dueDate, DEMO_AS_OF_DATE) < 0 ? "Past due" : "Open",
        lineSummary: `${pick(rand, MERIDIAN_CHANNELS).type}`,
        sourceLabel: "Google Sheets",
      });
    }
  }

  const appointments: BusinessAppointment[] = [
    {
      id: "mer-appt-1",
      startAt: "2026-03-12T10:00:00",
      title: "Vendor line review — Sheets sync",
      location: "Meridian HQ",
      assignee: "Avery Chen",
      status: "scheduled",
      sourceLabel: "HubSpot",
    },
    {
      id: "mer-appt-2",
      startAt: "2026-03-13T14:00:00",
      title: "HubSpot pipeline walkthrough",
      location: "Zoom",
      assignee: "Marketing lead",
      status: "scheduled",
      sourceLabel: "HubSpot",
    },
    {
      id: "mer-appt-3",
      startAt: "2026-03-15T09:00:00",
      title: "Wholesale buyer call",
      location: "Phone",
      assignee: "Avery Chen",
      status: "canceled",
      sourceLabel: "HubSpot",
    },
  ];

  return {
    workspaceId: WORKSPACE_MERIDIAN_RETAIL,
    demoAsOf: DEMO_AS_OF_DATE,
    customers,
    jobs,
    invoices,
    payments,
    appointments,
  };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function compareDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
