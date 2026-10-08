import type { Metadata } from "next";
import { CustomerPortalBanner } from "@/components/customer/CustomerPortalBanner";
import { CustomerPortalNav } from "@/components/customer/CustomerPortalNav";
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
        <div className="min-h-screen bg-white text-ink">
          <CustomerPortalBanner />
          <CustomerPortalNav />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </div>
      </CustomerPortalProvider>
    </ClientStoreProvider>
  );
}
