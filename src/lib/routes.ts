export const MARKETING = "/";

export const ADMIN = "/admin";
export const DEMO_ADMIN = "/demo/admin";
export const DASHBOARD = "/dashboard";
export const DEMO_DASHBOARD = "/demo/dashboard";

export const adminRoutes = {
  dashboard: ADMIN,
  revenue: `${ADMIN}/revenue`,
  clients: `${ADMIN}/clients`,
  clientsPending: `${ADMIN}/clients?filter=pending`,
  clientsActive: `${ADMIN}/clients?filter=active`,
  clientsArchived: `${ADMIN}/clients?filter=archived`,
  onboarding: `${ADMIN}/onboarding`,
  activity: `${ADMIN}/activity`,
} as const;

export const demoAdminRoutes = {
  dashboard: DEMO_ADMIN,
  revenue: `${DEMO_ADMIN}/revenue`,
  clients: `${DEMO_ADMIN}/clients`,
  clientsPending: `${DEMO_ADMIN}/clients?filter=pending`,
  clientsActive: `${DEMO_ADMIN}/clients?filter=active`,
  clientsArchived: `${DEMO_ADMIN}/clients?filter=archived`,
  onboarding: `${DEMO_ADMIN}/onboarding`,
  activity: `${DEMO_ADMIN}/activity`,
} as const;

export const marketingRoutes = {
  home: MARKETING,
} as const;

export const clientRoutes = {
  onboardingStart: "/demo/onboarding",
  onboarding: (clientId: string) => `/demo/onboarding/${clientId}`,
  onboardingPayment: (clientId: string) => `/demo/onboarding/${clientId}/payment`,
} as const;

export const dashboardRoutes = {
  home: DASHBOARD,
  revenue: `${DASHBOARD}/revenue`,
  schedule: `${DASHBOARD}/schedule`,
  connections: `${DASHBOARD}/connections`,
  settings: `${DASHBOARD}/settings`,
} as const;

export const demoDashboardRoutes = {
  home: DEMO_DASHBOARD,
  revenue: `${DEMO_DASHBOARD}/revenue`,
  schedule: `${DEMO_DASHBOARD}/schedule`,
  connections: `${DEMO_DASHBOARD}/connections`,
  settings: `${DEMO_DASHBOARD}/settings`,
} as const;

export const portalRoutes = dashboardRoutes;
