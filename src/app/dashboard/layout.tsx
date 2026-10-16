export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/authorization";
import { getMarketingPageTitle } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Customer portal | ${getMarketingPageTitle().split("|")[0]?.trim()}`,
  description: "Live customer workspace — read-only milestone",
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

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-purple-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <span className="text-sm font-semibold">Your RavenView project</span>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>Intake, scope, and preview review are live — payments and launch come later</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="text-sm font-medium text-purple hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-4xl px-4 pb-10 text-xs text-ink-muted sm:px-6">
        Prefer the interactive prototype?{" "}
        <Link href="/demo/dashboard" className="font-medium text-purple hover:underline">
          Open the local demo portal
        </Link>
      </footer>
    </div>
  );
}
