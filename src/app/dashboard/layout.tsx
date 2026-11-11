export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { CustomerPortalWorkspaceGate } from "@/components/customer/CustomerPortalWorkspaceGate";
import { getAuthContext } from "@/lib/auth/authorization";
import { getMarketingPageTitle } from "@/lib/branding";
import { ClientStoreProvider } from "@/lib/client-store";
import { CustomerPortalProvider, CustomerPortalQuerySync } from "@/lib/customer-portal-context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Customer portal | ${getMarketingPageTitle().split("|")[0]?.trim()}`,
  description: "Your RavenView dashboard",
};

export default async function LiveDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    redirect("/login?next=/dashboard");
  }
  if (ctx.isPlatformAdmin) {
    redirect("/admin/clients");
  }
  if (ctx.companyIds.length === 0) {
    redirect("/login?error=no_company");
  }

  const companyId = ctx.companyIds[0];
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  const businessName =
    typeof company?.name === "string" && company.name.trim()
      ? company.name
      : "Your company";

  return (
    <ClientStoreProvider loadingLabel="Loading your dashboard…">
      <CustomerPortalProvider businessName={businessName}>
        <CustomerPortalQuerySync />
        <CustomerPortalShell fillScreen>
          <CustomerPortalWorkspaceGate>{children}</CustomerPortalWorkspaceGate>
        </CustomerPortalShell>
      </CustomerPortalProvider>
    </ClientStoreProvider>
  );
}
