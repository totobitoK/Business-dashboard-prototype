export type LiveClientProjectStatus = "pending" | "active" | "archived";

export interface LiveClientProject {
  id: string;
  company_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  status: LiveClientProjectStatus;
  setup_fee: number;
  monthly_fee: number;
  onboarding_path: "full" | "payment-only";
  target_launch_date: string | null;
  dashboard_scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveCompany {
  id: string;
  name: string;
  slug: string;
}
