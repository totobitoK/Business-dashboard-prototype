import type { Metadata } from "next";
import { getAdminDescription, getAdminPageTitle } from "@/lib/branding";
import { ClientStoreProvider } from "@/lib/client-store";
import { SidebarProvider } from "@/lib/sidebar-context";
import { AppMain } from "@/components/AppMain";
import { DemoBanner } from "@/components/DemoBanner";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: getAdminPageTitle(),
  description: getAdminDescription(),
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientStoreProvider>
      <SidebarProvider>
        <DemoBanner />
        <Sidebar />
        <AppMain>{children}</AppMain>
      </SidebarProvider>
    </ClientStoreProvider>
  );
}
