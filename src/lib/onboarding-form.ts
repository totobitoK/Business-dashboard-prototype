import type {
  Client,
  ClientOnboardingAnswers,
  ClientOnboardingDraft,
  DataSourceTool,
} from "./types";

export const DATA_SOURCE_TOOLS: {
  id: DataSourceTool;
  label: string;
}[] = [
  { id: "google-sheets", label: "Google Sheets" },
  { id: "excel-csv", label: "Excel / CSV" },
  { id: "quickbooks", label: "QuickBooks Online" },
  { id: "hubspot", label: "HubSpot" },
  { id: "stripe", label: "Stripe" },
  { id: "square", label: "Square" },
  { id: "google-calendar", label: "Google Calendar" },
  { id: "other", label: "Other" },
];

export const TOOL_LABELS: Record<DataSourceTool, string> = Object.fromEntries(
  DATA_SOURCE_TOOLS.map((t) => [t.id, t.label])
) as Record<DataSourceTool, string>;

export function prefillFromClient(client: Client): Partial<ClientOnboardingAnswers> {
  return {
    company: client.company,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website ?? "",
    selectedTools: [],
  };
}

export function mergeDraftWithClient(
  client: Client,
  draft?: ClientOnboardingDraft
): Partial<ClientOnboardingAnswers> {
  const base = prefillFromClient(client);
  if (client.onboardingSubmission) {
    return { ...client.onboardingSubmission };
  }
  if (draft?.answers) {
    return { ...base, ...draft.answers };
  }
  return base;
}

export function validateStep1(answers: Partial<ClientOnboardingAnswers>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!answers.company?.trim()) errors.company = "Company name is required.";
  if (!answers.contactName?.trim()) errors.contactName = "Contact name is required.";
  if (!answers.email?.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

export function validateStep2(answers: Partial<ClientOnboardingAnswers>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!answers.businessDescription?.trim()) {
    errors.businessDescription = "Please describe what your business does.";
  }
  if (!answers.dashboardGoals?.trim()) {
    errors.dashboardGoals = "Please describe what you want to track.";
  }
  return errors;
}

export function validateStep3(answers: Partial<ClientOnboardingAnswers>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!answers.selectedTools?.length) {
    errors.selectedTools = "Select at least one tool.";
  }
  if (
    answers.selectedTools?.includes("other") &&
    !answers.otherToolExplanation?.trim()
  ) {
    errors.otherToolExplanation = "Please describe the other tool.";
  }
  return errors;
}

export function toFullAnswers(
  answers: Partial<ClientOnboardingAnswers>
): ClientOnboardingAnswers {
  return {
    company: answers.company!.trim(),
    contactName: answers.contactName!.trim(),
    email: answers.email!.trim(),
    phone: answers.phone?.trim() ?? "",
    website: answers.website?.trim() || undefined,
    businessDescription: answers.businessDescription!.trim(),
    dashboardGoals: answers.dashboardGoals!.trim(),
    reportingPainPoints: answers.reportingPainPoints?.trim() || undefined,
    dashboardUsers: answers.dashboardUsers?.trim() || undefined,
    selectedTools: answers.selectedTools ?? [],
    otherToolExplanation: answers.otherToolExplanation?.trim() || undefined,
    toolsNotes: answers.toolsNotes?.trim() || undefined,
  };
}
