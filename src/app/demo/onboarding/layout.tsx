import type { Metadata } from "next";
import { ClientStoreProvider } from "@/lib/client-store";
import { getMarketingPageTitle } from "@/lib/branding";
import { OnboardingDemoBanner } from "@/components/onboarding/OnboardingDemoBanner";
import "./onboarding.css";

export const metadata: Metadata = {
  title: `Client Onboarding | ${getMarketingPageTitle().split("|")[0]?.trim()}`,
  description: "Client onboarding preview — local demo only",
};

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientStoreProvider>
      <OnboardingDemoBanner />
      <div className="pt-10">{children}</div>
    </ClientStoreProvider>
  );
}
