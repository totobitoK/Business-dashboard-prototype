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
  currentStep: 1 | 2 | 3 | "review";
  answers: Partial<ClientOnboardingAnswers>;
  updatedAt: string;
}

/** Offline = admin-recorded; online = processor-confirmed; demo = local simulation only */
export type PaymentRecordSource = "offline" | "online" | "demo";

export interface Payment {
  id: string;
  date: string;
  amount: number;
  type: PaymentType;
  note?: string;
  recordSource?: PaymentRecordSource;
  /** Check number, transfer ref, etc. (offline recordings) */
  methodReference?: string;
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
  | "authorized"
  | "syncing"
  | "data-validated"
  | "needs-attention";

export interface GuidedConnection {
  id: string;
  label: string;
  demoStatus: ConnectionDemoStatus;
  provider?: string;
  externalAccountId?: string;
  selectedAccountLabel?: string;
  accessMode?: string;
  lastSuccessfulSyncAt?: string;
  errorDetail?: string;
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

/** Immutable scope/pricing snapshot shown to the customer for a published revision. */
export interface PublishedScopeSnapshot {
  revision: number;
  publishedAt: string;
  setupFee: number;
  monthlyFee: number;
  acceptedSourcesIn: string[];
  acceptedScreens: string[];
  agreedScopeSummary?: string;
  dashboardScope?: string;
}

export type ScopeCustomerAcceptanceSource = "customer";

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
  /** Monotonic scope content revision (admin edits bump this). */
  scopeRevision?: number;
  /** Revision published for customer review. */
  publishedScopeRevision?: number;
  scopePublishedAt?: string;
  scopeCustomerAcceptedAt?: string;
  scopeCustomerAcceptedRevision?: number;
  /** Set when the customer explicitly accepts on the portal (not migration). */
  scopeCustomerAcceptanceSource?: ScopeCustomerAcceptanceSource;
  /** Published scope frozen for customer review — admin draft fields may differ until republish. */
  publishedScopeSnapshot?: PublishedScopeSnapshot;
  /** Launched before customer publish flow — deposit gate without retrospective acceptance. */
  scopeDepositGrandfathered?: boolean;
  /** Prior migration may have fabricated acceptance — admin should verify. */
  scopeAcceptanceNeedsReview?: boolean;
  scopeChangeRequestAt?: string;
  scopeChangeRequestNote?: string;
  /** Bump when scope acceptance / publish migration rules change. */
  scopeMigrationVersion?: number;
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
  /** Customer portal — preview approved locally; does not activate or charge. */
  previewApprovedAt?: string;
  /** Latest customer preview feedback (also copied to notes for admin). */
  previewChangeRequest?: string;
  previewRevisionVersion?: number;
  previewApprovedRevision?: number;
  previewFeedbackUnresolved?: boolean;
  /** Set when admin activates — used for archived reactivation without bypassing never-launched clients. */
  launchedAt?: string;
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
