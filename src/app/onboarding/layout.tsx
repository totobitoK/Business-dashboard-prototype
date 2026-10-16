import type { Metadata } from "next";
import { getMarketingPageTitle } from "@/lib/branding";
import "../demo/onboarding/onboarding.css";

export const metadata: Metadata = {
  title: `Onboarding | ${getMarketingPageTitle().split("|")[0]?.trim()}`,
  description: "Complete requirements intake and review scope with RavenView.",
};

export default function LiveOnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
