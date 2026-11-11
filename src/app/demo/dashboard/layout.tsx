import type { Metadata } from "next";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { CustomerPortalQuerySync } from "@/lib/customer-portal-context";
import { CustomerPortalWorkspaceGate } from "@/components/customer/CustomerPortalWorkspaceGate";
import { ClientStoreProvider } from "@/lib/client-store";
import { CustomerPortalProvider } from "@/lib/customer-portal-context";
import { getMarketingPageTitle } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Customer portal | ${getMarketingPageTitle().split("|")[0]?.trim()}`,
  description: "Customer portal prototype — local demo only",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientStoreProvider>
      <CustomerPortalProvider>
        <CustomerPortalQuerySync />
        <div className="flex min-h-screen flex-col bg-white text-ink">
          <CustomerPortalShell fillScreen>
            <CustomerPortalWorkspaceGate>{children}</CustomerPortalWorkspaceGate>
          </CustomerPortalShell>
        </div>
      </CustomerPortalProvider>
    </ClientStoreProvider>
  );
}
