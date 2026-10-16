export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/authorization";
import { getAdminPageTitle } from "@/lib/branding";
import { adminRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Live admin | ${getAdminPageTitle()}`,
  description: "RavenView platform admin — live read-only milestone",
};

export default async function LiveAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    redirect("/login?next=/admin/clients");
  }
  if (!ctx.isPlatformAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-ink">
      <header className="border-b border-purple-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-ink">RavenView live admin</span>
            <nav className="flex gap-3 text-sm">
              <Link href={adminRoutes.clients} className="text-purple hover:underline">
                Projects
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>Read-only milestone — edits ship next release</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="text-sm font-medium text-purple hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
