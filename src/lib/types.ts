export type ClientStatus = "pending" | "active" | "archived";

export type OnboardingPath = "full" | "payment-only";

export type FullOnboardingStep =
  | "requirements-submitted"
  | "scope-pricing-confirmed"
  | "setup-payment-received"
  | "dashboard-ready"
  | "active";

export type PaymentOnlyOnboardingStep =
  | "setup-payment-received"
  | "dashboard-ready"
  | "active";

export type OnboardingStep = FullOnboardingStep | PaymentOnlyOnboardingStep;

/** @deprecated Legacy step — migrated to requirements-submitted on load */
export type LegacyOnboardingStep = "details-submitted";

export type PaymentType = "setup" | "subscription" | "refund";

export type OnboardingFormStatus = "not-started" | "in-progress" | "submitted";

export type DataSourceTool =
  | "google-sheets"
  | "excel-csv"
  | "quickbooks"
  | "hubspot"
  | "stripe"
  | "square"
  | "google-calendar"
  | "other";

export interface ClientOnboardingAnswers {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  businessDescription: string;
  dashboardGoals: string;
  reportingPainPoints?: string;
  dashboardUsers?: string;
  selectedTools: DataSourceTool[];
  otherToolExplanation?: string;
  toolsNotes?: string;
}

export interface ClientOnboardingSubmission extends ClientOnboardingAnswers {
  submittedAt: string;
}

export interface ClientOnboardingDraft {
  currentStep: 1 | 2 | 3;
  answers: Partial<ClientOnboardingAnswers>;
  updatedAt: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  type: PaymentType;
  note?: string;
}

export interface Note {
  id: string;
  date: string;
  content: string;
}

export interface ClientFile {
  id: string;
  name: string;
  type: string;
  addedAt: string;
}

export type ClientMilestone =
  | "intake"
  | "discovery"
  | "scope-confirmed"
  | "deposit"
  | "guided-data-setup"
  | "building"
  | "client-review"
  | "final-balance"
  | "active";

export type ConnectionDemoStatus =
  | "not-started"
  | "awaiting-authorization"
  | "connected"
  | "needs-attention"
  | "data-validated";

export interface GuidedConnection {
  id: string;
  label: string;
  demoStatus: ConnectionDemoStatus;
}

export type ActivityCategory = "payments" | "notes" | "onboarding";

export interface ActivityEntry {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  description: string;
  category: ActivityCategory;
}

export interface Client {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  serviceName?: string;
  dashboardScope?: string;
  dataSourcesNeeded?: string;
  targetLaunchDate?: string;
  status: ClientStatus;
  setupFee: number;
  monthlyFee: number;
  onboardingPath: OnboardingPath;
  completedSteps: OnboardingStep[];
  setupPaidAmount: number;
  subscriptionActive: boolean;
  dashboardUrl?: string;
  payments: Payment[];
  notes: Note[];
  files: ClientFile[];
  createdAt: string;
  onboardingFormStatus?: OnboardingFormStatus;
  onboardingDraft?: ClientOnboardingDraft;
  onboardingSubmission?: ClientOnboardingSubmission;
  scopePricingConfirmedAt?: string;
  /** Admin-confirmed data sources for agent export — not from onboarding checkboxes. */
  acceptedSourcesIn?: string[];
  /** Admin-confirmed dashboard screens for agent export — not from free-text scope. */
  acceptedScreens?: string[];
  scopeCardVersion?: number;
  scopeCardExportedAt?: string;
  /** Admin-toggled milestones (not deposit/final-balance/intake — those are derived). */
  adminCompletedMilestones?: ClientMilestone[];
  guidedConnections?: GuidedConnection[];
  /** Internal — not shown on client-facing onboarding. */
  guidedSetupNotes?: string;
  agreedScopeSummary?: string;
  dashboardPreviewUrl?: string;
  buildStatusNote?: string;
  /** Payment-only: admin confirms discovery + scope were handled offline. */
  paymentOnlyPrepConfirmed?: boolean;
  /** Bump when normalizeClient milestone repair runs; stops re-inferring admin milestones. */
  milestoneMigrationVersion?: number;
}

export type ClientFilter = "all" | ClientStatus;

export interface ClientFormData {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  serviceName?: string;
  dashboardScope?: string;
  dataSourcesNeeded?: string;
  targetLaunchDate?: string;
  onboardingPath: OnboardingPath;
  setupFee: number;
  monthlyFee: number;
  initialNote?: string;
}
