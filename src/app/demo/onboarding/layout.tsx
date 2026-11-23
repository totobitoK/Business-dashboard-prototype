import type { Metadata } from "next";
import { ClientStoreProvider } from "@/lib/client-store";
import { getMarketingPageTitle } from "@/lib/branding";

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
    <ClientStoreProvider>{children}</ClientStoreProvider>
  );
}
