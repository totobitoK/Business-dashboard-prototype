export const MARKETING = "/";

export const ADMIN = "/admin";

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

export const marketingRoutes = {
  home: MARKETING,
} as const;

export const clientRoutes = {
  onboardingStart: "/onboarding",
  onboarding: (clientId: string) => `/onboarding/${clientId}`,
  onboardingPayment: (clientId: string) => `/onboarding/${clientId}/payment`,
} as const;
