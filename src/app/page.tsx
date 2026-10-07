import Link from "next/link";
import { RavenViewWordmark } from "@/components/RavenViewWordmark";
import { branding, getTaglineParts } from "@/lib/branding";
import { adminRoutes, clientRoutes } from "@/lib/routes";

export default function LandingPage() {
  const { lead, accent } = getTaglineParts();

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-purple-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <RavenViewWordmark linked size="md" />
          <Link
            href={adminRoutes.dashboard}
            className="rounded-lg border border-purple-100 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-purple-50"
          >
            Admin login
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-purple">
            {branding.fullName}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {lead}{" "}
            {accent && <span className="text-purple">{accent}</span>}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            We build custom dashboards for growing businesses — so your team
            sees the numbers, workflows, and priorities that matter without
            jumping between spreadsheets and apps.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={clientRoutes.onboardingStart}
              className="rounded-lg bg-purple px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-dark"
            >
              Start onboarding
            </Link>
            <Link
              href={adminRoutes.dashboard}
              className="rounded-lg border border-purple-100 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-purple-50"
            >
              Admin
            </Link>
            <a
              href="mailto:hello@ravenview.com"
              className="rounded-lg border border-purple-100 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-purple-50"
            >
              Contact us
            </a>
          </div>
        </section>

        <section className="border-t border-purple-100 bg-purple-50/30 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-semibold text-ink">
              What {branding.name} delivers
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <FeatureCard
                title="Custom dashboards"
                description="Tailored to your business — not a generic template. We design around your KPIs, workflows, and brand."
              />
              <FeatureCard
                title="Connected data"
                description="Pull from the tools you already use — accounting, spreadsheets, calendars, and more — into one live view."
              />
              <FeatureCard
                title="Ongoing partnership"
                description="Setup, launch, and a monthly subscription that keeps your dashboard current as your business evolves."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-ink">How it works</h2>
          <ol className="mt-8 space-y-6">
            <Step
              number={1}
              title="Discovery & onboarding"
              description="We learn your business, data sources, and goals — through a guided onboarding flow or a direct kickoff if you're ready to move fast."
            />
            <Step
              number={2}
              title="Build & review"
              description="We configure your dashboard, connect your data, and iterate with you until the view is exactly right."
            />
            <Step
              number={3}
              title="Launch & support"
              description="Go live with a dashboard your team can rely on, backed by ongoing updates and support."
            />
          </ol>
        </section>

        <section className="border-t border-purple-100 bg-ink py-14 text-white">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-2xl font-semibold">
              Ready to see your business clearly?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/70">
              {branding.fullName} start at{" "}
              <span className="font-medium text-purple-light">$1,500</span> setup and{" "}
              <span className="font-medium text-purple-light">$249</span>/month. Every
              engagement includes a dashboard built for how you actually work.
            </p>
            <a
              href="mailto:hello@ravenview.com"
              className="mt-6 inline-block rounded-lg bg-purple px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-light"
            >
              Get in touch
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-purple-100 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 text-xs text-ink-subtle">
          <RavenViewWordmark size="sm" />
          <p>
            © {new Date().getFullYear()} {branding.fullName}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple">
        {number}
      </span>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
    </li>
  );
}
