"use client";

import { createContext, useContext } from "react";
import type { DashboardSectionId } from "@/lib/dashboard-section-routes";

export type SignedInNavContextValue = {
  /** True while Next is still on /dashboard, so Settings can swap without a new server load. */
  canSwap: boolean;
  showingSettings: boolean;
  showSettings: () => void;
  showDashboard: (section?: DashboardSectionId) => void;
};

export const SignedInNavContext = createContext<SignedInNavContextValue | null>(null);

export function useSignedInNav() {
  return useContext(SignedInNavContext);
}
