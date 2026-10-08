import Link from "next/link";
import { clientRoutes } from "@/lib/routes";

export function MarketingCtaPair({
  discoveryUrl,
  variant = "light",
  showPrimary = true,
  size = "default",
}: {
  discoveryUrl: string;
  variant?: "light" | "dark";
  /** When false, only show discovery (e.g. hero when header has primary CTA). */
  showPrimary?: boolean;
  size?: "default" | "compact";
}) {
  const compact = size === "compact";

  const primary =
    variant === "dark"
      ? compact
        ? "inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-purple-50 sm:h-10 sm:px-5 sm:text-base"
        : "rounded-xl bg-white px-6 py-3 text-base font-semibold text-ink transition-colors hover:bg-purple-50"
      : compact
        ? "inline-flex h-9 items-center rounded-lg bg-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-purple-dark sm:h-10 sm:px-5 sm:text-base"
        : "rounded-xl bg-purple px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-purple-dark";

  const secondary =
    variant === "dark"
      ? compact
        ? "inline-flex h-9 items-center rounded-lg border border-white px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:h-10 sm:px-5 sm:text-base"
        : "rounded-xl border-2 border-white px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
      : compact
        ? "inline-flex h-9 items-center rounded-lg border border-purple px-4 text-sm font-semibold text-ink transition-colors hover:bg-purple-50 sm:h-10 sm:px-5 sm:text-base"
        : "rounded-xl border-2 border-purple px-6 py-3 text-base font-semibold text-ink transition-colors hover:bg-purple-50";

  return (
    <div className="flex flex-wrap gap-3">
      {showPrimary && (
        <Link href={clientRoutes.onboardingStart} className={primary}>
          Start onboarding
        </Link>
      )}
      <a
        href={discoveryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={secondary}
      >
        Book a discovery call
      </a>
    </div>
  );
}
