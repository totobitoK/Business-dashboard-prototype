import Link from "next/link";
import { Fragment } from "react";
import { HvacDashboardPreview } from "@/components/marketing/HvacDashboardPreview";
import {
  FragmentedToolsVisual,
  IntegrationsVisual,
  UnifiedMetricsVisual,
} from "@/components/marketing/MarketingSectionVisuals";
import { LayoutCustomizeVisualRotator } from "@/components/marketing/LayoutCustomizeVisualRotator";
import { MarketingCtaPair } from "@/components/marketing/MarketingCta";
import { RavenViewWordmark } from "@/components/RavenViewWordmark";
import { branding } from "@/lib/branding";
import { getDiscoverySchedulingUrl } from "@/lib/onboarding-config";
import {
  MARKETING_DATA_SOURCES,
  marketingConnectionsHref,
} from "@/lib/marketing-data-sources";
import {
  adminRoutes,
  clientRoutes,
  dashboardRoutes,
  marketingRoutes,
} from "@/lib/routes";

const navLinkClass =
  "text-base font-semibold text-ink transition-colors hover:text-purple lg:text-lg";

const HOW_IT_WORKS_STEPS = [
  {
    phase: "Onboarding",
    title: "Share your needs through onboarding",
    body: "Tell us about your business, the metrics you care about, and the tools you use today.",
    accent: "from-emerald-400 to-teal-500",
    titleColor: "text-emerald-700",
  },
  {
    phase: "Discovery",
    title: "Review requirements on a discovery call",
    body: "We walk through your goals together and clarify what belongs on the dashboard.",
    accent: "from-sky-400 to-blue-500",
    titleColor: "text-sky-800",
  },
  {
    phase: "Scope",
    title: "Agree on scope and customized pricing",
    body: "You receive a defined deliverable and pricing before any setup payment.",
    accent: "from-violet-400 to-purple-600",
    titleColor: "text-violet-700",
  },
  {
    phase: "Connect",
    title: "Authorize supported data connections with guidance",
    body: "You sign in with providers directly—we do not ask for account passwords.",
    accent: "from-purple-400 to-purple-dark",
    titleColor: "text-purple-dark",
  },
  {
    phase: "Launch",
    title: "Review the build and launch",
    body: "Preview the dashboard, confirm the view, and go live when you are ready.",
    accent: "from-fuchsia-400 to-purple-600",
    titleColor: "text-fuchsia-700",
  },
] as const;

/** Gradient stroke colors between adjacent steps (from → to). */
const HOW_IT_WORKS_ARROW_GRADIENTS = [
  { from: "#2dd4bf", to: "#38bdf8" },
  { from: "#38bdf8", to: "#7c3aed" },
  { from: "#8b5cf6", to: "#6d28d9" },
  { from: "#a855f7", to: "#e879f9" },
] as const;

export function MarketingHomePage() {
  const discoveryUrl = getDiscoverySchedulingUrl();

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-20 border-b border-purple-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 lg:h-16 lg:grid-cols-[1fr_auto_1fr]">
          <div className="justify-self-start self-center">
            <RavenViewWordmark linked href={marketingRoutes.home} size="lg" />
          </div>
          <nav
            className="col-start-2 row-start-1 hidden items-center justify-center gap-6 self-center lg:flex xl:gap-10"
            aria-label="Page sections"
          >
            <a href="#why-one-view" className={navLinkClass}>
              Why one view
            </a>
            <a href="#how-it-works" className={navLinkClass}>
              How it works
            </a>
            <a href="#integrations" className={navLinkClass}>
              Connections
            </a>
            <a href="#faq" className={navLinkClass}>
              FAQ
            </a>
          </nav>
          <Link
            href={clientRoutes.onboardingStart}
            className="col-start-2 row-start-1 inline-flex h-9 shrink-0 items-center justify-center justify-self-end self-center rounded-lg bg-purple px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-dark sm:h-10 sm:px-5 sm:text-base lg:col-start-3"
          >
            Start onboarding
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-purple-100">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:items-start lg:gap-12 lg:py-12">
            <div className="max-w-xl lg:pt-0.5">
              <p className="text-base font-semibold uppercase tracking-wider text-purple">
                Custom business dashboards
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl lg:text-[3rem]">
                Your business,
                <br />
                in one clear view.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-ink sm:text-xl">
                Bring revenue, outstanding invoices, and scheduling into a
                dashboard built around how you run your business.
              </p>
              <div className="mt-8">
                <MarketingCtaPair
                  discoveryUrl={discoveryUrl}
                  showPrimary={false}
                  size="compact"
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink sm:text-base">
                Starting onboarding does not charge you or commit you to a
                purchase. It helps us understand your needs before scope and
                pricing are confirmed.
              </p>
              <div className="mt-8 border-t border-purple-100 pt-6">
                <p className="text-sm font-semibold text-ink">
                  Sources we can connect
                </p>
                <p className="mt-1 text-sm text-ink">
                  Agreed in scope—{" "}
                  <a
                    href={marketingConnectionsHref}
                    className="font-semibold text-purple underline-offset-2 hover:underline"
                  >
                    see connection status
                  </a>
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {MARKETING_DATA_SOURCES.map((source) => (
                    <li key={source.id}>
                      <a
                        href={marketingConnectionsHref}
                        className="inline-block rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-purple hover:bg-purple-50 hover:text-purple"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <ul className="mt-6 space-y-2.5 text-sm font-medium text-ink">
                  <HeroTrustPoint>
                    Layout and metrics shaped to your business, not a template
                  </HeroTrustPoint>
                  <HeroTrustPoint>
                    Scope and pricing confirmed before any setup payment
                  </HeroTrustPoint>
                </ul>
              </div>
            </div>
            <div className="w-full min-w-0">
              <HvacDashboardPreview />
            </div>
          </div>
        </section>

        {/* Why one view */}
        <section id="why-one-view" className="scroll-mt-24 py-16 sm:py-20">
          <SplitSection visual={<FragmentedToolsVisual />}>
            <SectionEyebrow>Why one view</SectionEyebrow>
            <SectionTitle>
              Your business picture is split across too many tools
            </SectionTitle>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink sm:text-lg">
              <p>
                Revenue lives in accounting software. Appointments sit on the
                calendar. Follow-ups hide in inboxes and spreadsheets. When you
                need the full picture, you switch tabs, export CSV files, and
                rebuild the same report by hand—week after week.
              </p>
              <p>
                That fragmentation makes it harder to see what needs attention
                today: cash coming in, invoices still open, and what is on the
                schedule. You are not missing data—you are missing a single place
                to interpret it.
              </p>
            </div>
          </SplitSection>
        </section>

        {/* Built around your business */}
        <section className="border-y border-purple-100 bg-purple-50/25 py-16 sm:py-20">
          <SplitSection visual={<UnifiedMetricsVisual />} reverse>
            <SectionEyebrow>A dashboard built around your business</SectionEyebrow>
            <SectionTitle>
              Relevant metrics, agreed sources, one unified view
            </SectionTitle>
            <p className="mt-4 text-base leading-relaxed text-ink sm:text-lg">
              We design around the numbers and workflows you actually use—not a
              generic template. You keep working in QuickBooks, Google Calendar,
              spreadsheets, and the tools you already trust.
            </p>
            <ul className="mt-8 space-y-4">
              <ValueBlock
                title="Metrics that matter to you"
                body="Dashboards reflect your goals—revenue, receivables, schedule density, or operations-specific KPIs we define together."
              />
              <ValueBlock
                title="Sources you approve"
                body="Connections are chosen during scope review. We do not assume access to every tool in your stack."
              />
              <ValueBlock
                title="One place to orient"
                body="See the business at a glance without re-assembling reports from scratch each morning."
              />
            </ul>
          </SplitSection>
        </section>

        {/* Make the view your own */}
        <section className="py-16 sm:py-20">
          <SplitSection visual={<LayoutCustomizeVisualRotator />}>
            <SectionEyebrow>Make the view your own</SectionEyebrow>
            <SectionTitle>Planned customization controls</SectionTitle>
            <p className="mt-4 text-base leading-relaxed text-ink sm:text-lg">
              We are building ways for you to adjust appearance and layout after
              launch—colors, widget arrangement, and what each role can see.
              These controls are planned capabilities and are not available in
              this prototype yet; your initial build still reflects agreed scope
              from onboarding and discovery.
            </p>
          </SplitSection>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-t border-purple-100 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionEyebrow>How it works</SectionEyebrow>
            <SectionTitle>From intake to launch—with clear checkpoints</SectionTitle>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
              Five checkpoints from first intake to launch—each one explicit so
              you always know what happens next.
            </p>
            <HowItWorksFlow />
          </div>
        </section>

        {/* Data connections */}
        <section
          id="integrations"
          className="scroll-mt-24 border-t border-purple-100 bg-purple-50/20 py-16 sm:py-20"
        >
          <SplitSection visual={<IntegrationsVisual />}>
            <SectionEyebrow>Data connections</SectionEyebrow>
            <SectionTitle>Initial integrations in development</SectionTitle>
            <p className="mt-4 text-base leading-relaxed text-ink sm:text-lg">
              We are developing connections for QuickBooks Online and Google
              Calendar first, with Excel / CSV as a fallback when a direct
              connection is not the right fit. Other sources—such as Google
              Sheets and HubSpot—can be included when they match your agreed
              scope.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink sm:text-base">
              These integrations are not live or universally supported in this
              prototype. Availability depends on your systems and agreed scope.
              Stripe is used for payments to {branding.name}, not as a customer
              data connector for your dashboard.
            </p>
          </SplitSection>
        </section>

        {/* Final CTA */}
        <section className="border-t border-purple-100 bg-ink py-16 text-white sm:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Ready for a dashboard built around your business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white sm:text-lg">
              Tell us how you operate, which metrics matter, and which tools you
              rely on—we shape scope, sources, and layout around you, not a
              generic template. Start onboarding or book a discovery call today.
            </p>
            <div className="mt-8 flex justify-center">
              <MarketingCtaPair discoveryUrl={discoveryUrl} variant="dark" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-24 border-t border-purple-100 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <SectionTitle>Common questions</SectionTitle>
            <dl className="mt-8 divide-y divide-purple-100 text-left">
              <FaqItem
                q="Do I need to replace my current software?"
                a="No. You keep using the tools you already rely on. The dashboard brings agreed data into one view."
              />
              <FaqItem
                q="Is each dashboard customized?"
                a="Yes. Layout and metrics are shaped around your agreed needs and scope—not a one-size-fits-all template."
              />
              <FaqItem
                q="Do I share passwords with you?"
                a="No. Supported connections use provider authorization—you sign in with the vendor directly and approve access."
              />
              <FaqItem
                q="What does it cost?"
                a="Pricing is confirmed after we review scope together on a discovery call. There is no published price list yet."
              />
              <FaqItem
                q="Can I change the appearance or layout?"
                a="Planned customization controls (colors, widget arrangement, visibility) are on the roadmap and will be labeled when available."
              />
              <FaqItem
                q="Who is this for?"
                a="Small-business owners and operations managers who want a clearer operational picture. The HVAC example illustrates one industry—it does not limit who we work with."
              />
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-purple-100 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 sm:flex-row sm:items-center sm:px-8">
          <RavenViewWordmark size="lg" />
          <div className="flex flex-wrap gap-4 text-sm font-medium text-ink">
            <Link href={dashboardRoutes.home} className="hover:text-purple">
              Customer portal (demo)
            </Link>
            <Link href={adminRoutes.dashboard} className="hover:text-purple">
              Admin (prototype)
            </Link>
            <span>
              © {new Date().getFullYear()} {branding.fullName}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SplitSection({
  children,
  visual,
  reverse,
}: {
  children: React.ReactNode;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  const textCol = <div>{children}</div>;
  const visualCol = <div className="min-w-0">{visual}</div>;

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
      {reverse ? (
        <>
          {visualCol}
          {textCol}
        </>
      ) : (
        <>
          {textCol}
          {visualCol}
        </>
      )}
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold uppercase tracking-wider text-purple">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      {children}
    </h2>
  );
}

function HeroTrustPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 leading-snug">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple" aria-hidden />
      {children}
    </li>
  );
}

function ValueBlock({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-l-4 border-purple pl-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-base leading-relaxed text-ink">{body}</p>
    </li>
  );
}

function HowItWorksFlow() {
  return (
    <ol className="mt-10 flex list-none flex-col xl:flex-row xl:items-stretch">
      {HOW_IT_WORKS_STEPS.map((step, index) => (
        <Fragment key={step.title}>
          <ProcessStepCard step={step} />
          {index < HOW_IT_WORKS_STEPS.length - 1 && (
            <ProcessFlowArrow
              id={`how-it-works-arrow-${index}`}
              gradient={HOW_IT_WORKS_ARROW_GRADIENTS[index]}
            />
          )}
        </Fragment>
      ))}
    </ol>
  );
}

function ProcessStepCard({
  step,
}: {
  step: (typeof HOW_IT_WORKS_STEPS)[number];
}) {
  return (
    <li className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/30 shadow-card">
      <div className={`h-1.5 bg-gradient-to-r ${step.accent}`} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <p
          className={`text-xs font-bold uppercase tracking-wider ${step.titleColor}`}
        >
          {step.phase}
        </p>
        <h3
          className={`mt-2 text-base font-semibold leading-snug ${step.titleColor}`}
        >
          {step.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink">{step.body}</p>
      </div>
    </li>
  );
}

function ProcessFlowArrow({
  id,
  gradient,
}: {
  id: string;
  gradient: { from: string; to: string };
}) {
  const stroke = `url(#${id})`;

  return (
    <li
      className="flex list-none items-center justify-center py-4 xl:w-12 xl:shrink-0 xl:px-1 xl:py-0"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 rotate-90 xl:h-10 xl:w-10 xl:rotate-0"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1="4"
            y1="12"
            x2="20"
            y2="12"
          >
            <stop offset="0%" stopColor={gradient.from} />
            <stop offset="100%" stopColor={gradient.to} />
          </linearGradient>
        </defs>
        <path d="M5 12h12" stroke={stroke} />
        <path d="m13 6 6 6-6 6" stroke={stroke} />
      </svg>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="py-5">
      <dt className="text-lg font-semibold text-ink">{q}</dt>
      <dd className="mt-2 text-base leading-relaxed text-ink">{a}</dd>
    </div>
  );
}
